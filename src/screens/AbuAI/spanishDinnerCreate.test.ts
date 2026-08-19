/*
 * Regression: Spanish meal-create ("agendá una cena…") (Cycle 18, RED-first)
 * ═════════════════════════════════════════════════════════════════════════
 * Widened-probe gap: "agendá una cena con Anabel el viernes a las ocho" fell to the LLM,
 * while "anotá una cita …" works. CREATE_INTENT_ES recognized cita/reunión/turno/evento
 * but not meal nouns (cena/almuerzo/desayuno). And, like the Hebrew dinner bug (C4), a
 * bare "a las ocho" for a cena would default to 08:00 (an 8 AM dinner).
 *
 * now = Wed 2026-07-15; "el viernes" = Fri 2026-07-17. Drives the REAL controller. CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_HANDLE_A_CREATE]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('Spanish meal-create routes to the calendar, dinner in the evening', () => {
  it('"agendá una cena con Anabel el viernes a las ocho" → create, Anabel, 20:00 not 08:00', async () => {
    const r = await ask('agendá una cena con Anabel el viernes a las ocho')
    expect(r.intent).toBe('calendar_create')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('Anabel')
    expect(r.display).toContain('20:00')
    expect(r.display).not.toContain('08:00')
  })

  it('"anotá un almuerzo con Mor el sábado a la una" → create (lunch)', async () => {
    const r = await ask('anotá un almuerzo con Mor el sábado a la una')
    expect(r.intent).toBe('calendar_create')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('Mor')
  })

  it('existing "anotá una cita con el médico mañana a las tres" still works', async () => {
    const r = await ask('anotá una cita con el médico mañana a las tres de la tarde')
    expect(r.intent).toBe('calendar_create')
    expect(r.source).not.toBe('llm')
  })
})
