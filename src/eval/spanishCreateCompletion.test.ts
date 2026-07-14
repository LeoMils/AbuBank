/*
 * GOLD REPLAY — the Spanish create completes end-to-end (§20.2), including an
 * AM/PM-ambiguous bare hour and a Spanish cancel.
 * ═══════════════════════════════════════════════════════════════════════════════
 * Two real gaps this locks (both left the mandatory es create unusable):
 *  1. AMBIGUOUS ES HOUR: "anotá una cita el viernes a las diez" — "a las diez" (10) is
 *     AM/PM-ambiguous (7–11). The Hebrew smart layer resolves this for Hebrew, but a
 *     single-utterance es create is not routed through it, so the create stayed "creating",
 *     asked "¿A qué hora?", and "dale" dead-ended in the loop-breaker — nothing saved.
 *     Fix (es analog of 0.68.0): accept the default reading and move to confirming.
 *  2. SPANISH CANCEL: a Spanish "no" at confirm punted to the LLM instead of cancelling.
 *
 * Evidence class: CODE (deterministic runtime, LLM/online stubbed). Not device-proven.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments } from '../screens/AbuCalendar/service'
import { isCancel } from '../screens/AbuAI/calendarCreate'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

class MemoryLocalStorage {
  private s = new Map<string, string>()
  getItem(k: string) { return this.s.has(k) ? this.s.get(k)! : null }
  setItem(k: string, v: string) { this.s.set(k, String(v)) }
  removeItem(k: string) { this.s.delete(k) }
  clear() { this.s.clear() }
  key(i: number) { return [...this.s.keys()][i] ?? null }
  get length() { return this.s.size }
}
const tools: FullTurnTools = { llm: async (i: string) => `[LLM] ${i.slice(0, 40)}`, online: async (q: string) => ({ ok: true, answer: `online: ${q}` }) }
interface TurnResult { say: string; intent: string; source: string; phase: string; sideEffect: unknown; display: string }
const HEBREW = /[֐-׿]/

async function replay(turns: string[]): Promise<TurnResult[]> {
  ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  saveAppointments([])
  let state: RuntimeState = IDLE_RUNTIME
  const messages: Array<{ role: string; content: string }> = []
  const now = new Date('2026-06-24T20:00:00')
  const out: TurnResult[] = []
  for (const say of turns) {
    messages.push({ role: 'user', content: say })
    const r = await ExecutiveCognitiveController.handleTurn({ ...state, conv: state.conv }, say, { messages: [...messages], now }, tools)
    state = r.state
    messages.push({ role: 'assistant', content: r.display })
    out.push({ say, intent: r.intent, source: r.source, phase: r.state.createState.phase, sideEffect: r.sideEffect, display: r.display })
  }
  return out
}

describe('isCancel understands Spanish (bare rejection only)', () => {
  it('bare Spanish cancels are recognized', () => {
    for (const w of ['no', 'No', 'mejor no', 'no importa', 'cancelá', 'cancelalo', 'dejá', 'dejalo', 'olvidate', 'olvidalo', 'nada']) {
      expect(isCancel(w)).toBe(true)
    }
  })
  it('a correction that merely starts with "no" is NOT a cancel', () => {
    expect(isCancel('no, a las cuatro')).toBe(false)
    expect(isCancel('no de la mañana')).toBe(false)
  })
  it('Hebrew cancel still works', () => {
    expect(isCancel('לא')).toBe(true)
    expect(isCancel('עזבי')).toBe(true)
  })
})

describe('GOLD REPLAY — Spanish create completes with an ambiguous hour', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
  afterEach(() => { vi.useRealTimers(); delete (globalThis as { localStorage?: unknown }).localStorage })

  it('"anotá una cita el viernes a las diez" → confirm → "dale" saves once at 10:00', async () => {
    const log = await replay(['anotá una cita el viernes a las diez', 'dale'])
    for (const t of log) expect(t.source).not.toBe('llm')
    // Reaches confirming in one turn (no "¿A qué hora?" reprompt), in Spanish.
    expect(log[0]!.phase).toBe('confirming')
    expect(log[0]!.display).not.toMatch(HEBREW)
    // The confirm/save read as first-class Spanish: the schedulable noun ("una cita"),
    // NOT the raw request echoed back ("anotá una cita el viernes a las diez").
    expect(log[0]!.display).toContain('una cita')
    expect(log[0]!.display).not.toMatch(/anot[áa]/i)
    // "dale" completes exactly once at the default reading (10:00).
    expect(log[log.length - 1]!.sideEffect).toBe('saved_appointment')
    expect(log[log.length - 1]!.display).not.toMatch(HEBREW)
    expect(log[log.length - 1]!.display).not.toMatch(/anot[áa]/i)
    const appts = loadAppointments()
    expect(appts).toHaveLength(1)
    expect(appts[0]!.time).toBe('10:00')
  })

  it('the schedulable noun keeps correct Spanish gender ("un turno", "una cita")', async () => {
    const turno = await replay(['anotá un turno el lunes a las nueve', 'dale'])
    expect(turno[0]!.display).toMatch(/un turno/)
    expect(turno[0]!.display).not.toMatch(/una turno/)
    const cita = await replay(['anotá una cita el lunes a las nueve', 'dale'])
    expect(cita[0]!.display).toMatch(/una cita/)
  })

  it('other ambiguous es hours (ocho/nueve/once) also complete', async () => {
    for (const [word, time] of [['ocho', '08:00'], ['nueve', '09:00'], ['once', '11:00']] as const) {
      const log = await replay([`agendá una reunión con Gabi mañana a las ${word}`, 'dale'])
      expect(log[log.length - 1]!.sideEffect).toBe('saved_appointment')
      expect(loadAppointments()[0]!.time).toBe(time)
    }
  })
})

describe('GOLD REPLAY — Spanish "no" cancels the create', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
  afterEach(() => { vi.useRealTimers(); delete (globalThis as { localStorage?: unknown }).localStorage })

  it('"agendá … a las tres" then "no" → cancels in Spanish, nothing saved', async () => {
    const log = await replay(['agendá una reunión con Gabi mañana a las tres', 'no'])
    const last = log[log.length - 1]!
    expect(last.source).not.toBe('llm')          // not punted to the model
    expect(last.sideEffect).not.toBe('saved_appointment')
    expect(last.display).not.toMatch(HEBREW)     // Spanish cancel copy, not Hebrew
    expect(last.display).toMatch(/cancel|Dale/i)
    expect(loadAppointments()).toHaveLength(0)
  })
})
