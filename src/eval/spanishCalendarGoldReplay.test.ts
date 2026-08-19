/*
 * GOLD CONVERSATION REPLAY — the MANDATORY Spanish calendar scenario (§20.2 / §39 #9).
 * ═══════════════════════════════════════════════════════════════════════════════════
 * "Agendá una reunión con Gabi mañana a las tres." → create exactly once at 15:00,
 * accept a Spanish confirmation ("dale"), and recall it later.
 *
 * Real failure this locks: the Hebrew STT-recovery dedup rule
 * (semanticIntelligenceEngine.recoverTranscript) used a HEBREW-ONLY word boundary, so on
 * Spanish text it matched the trailing "a" of "mañana" + the standalone preposition "a"
 * as a duplicated word ("a a" → "a"), turning "mañana a las tres" into "mañana las tres".
 * The ES clock regex needs "a las", so the time no longer parsed → the runtime asked
 * "באיזו שעה?" (in Hebrew) and "dale" dead-ended. Nothing was ever created — the mandatory
 * scenario was broken end-to-end even though the parser worked in isolation.
 *
 * First divergence: recoverTranscript corrupts "mañana a las" → "mañana las" (drops "a").
 * Evidence class: CODE (deterministic runtime, LLM/online stubbed). Not device-proven.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments, type Appointment } from '../screens/AbuCalendar/service'
import { recoverTranscript } from '../screens/AbuAI/semanticIntelligenceEngine'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import type { ChatMessage } from '../screens/AbuAI/types'

class MemoryLocalStorage {
  private s = new Map<string, string>()
  getItem(k: string) { return this.s.has(k) ? this.s.get(k)! : null }
  setItem(k: string, v: string) { this.s.set(k, String(v)) }
  removeItem(k: string) { this.s.delete(k) }
  clear() { this.s.clear() }
  key(i: number) { return [...this.s.keys()][i] ?? null }
  get length() { return this.s.size }
}
const tools: FullTurnTools = {
  llm: async (input: string) => `[LLM] ${input.slice(0, 40)}`,
  online: async (q: string) => ({ ok: true, answer: `online: ${q}` }),
}
interface TurnResult { say: string; intent: string; source: string; phase: string; sideEffect: unknown; display: string }
async function replay(turns: string[]): Promise<TurnResult[]> {
  ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  saveAppointments([])
  let state: RuntimeState = IDLE_RUNTIME
  const messages: Array<{ role: string; content: string }> = []
  const now = new Date('2026-06-24T20:00:00') // Wed, pinned
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

describe('recoverTranscript does not corrupt Spanish (locale integrity)', () => {
  it('keeps the Spanish preposition "a" in "mañana a las tres"', () => {
    expect(recoverTranscript('agendá una reunión con Gabi mañana a las tres').text)
      .toBe('agendá una reunión con Gabi mañana a las tres')
    expect(recoverTranscript('mañana a las tres').text).toBe('mañana a las tres')
  })
  it('still collapses a genuine Hebrew duplicated word', () => {
    expect(recoverTranscript('תקבעי פגישה פגישה עם מור').text).toBe('תקבעי פגישה עם מור')
  })
  it('still collapses a genuine Latin duplicated word', () => {
    expect(recoverTranscript('reunión reunión con Gabi').text).toBe('reunión con Gabi')
  })
})

describe('GOLD REPLAY — mandatory Spanish calendar scenario (§20.2)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
  afterEach(() => { vi.useRealTimers(); delete (globalThis as { localStorage?: unknown }).localStorage })

  it('"Agendá una reunión con Gabi mañana a las tres" → confirm → "dale" saves exactly once at 15:00', async () => {
    const log = await replay(['agendá una reunión con Gabi mañana a las tres', 'dale'])
    // The create must be recognized and NOT punted to the LLM.
    for (const t of log) expect(t.source).not.toBe('llm')
    // "dale" completes and saves.
    expect(log[log.length - 1]!.sideEffect).toBe('saved_appointment')
    const appts: Appointment[] = loadAppointments()
    expect(appts).toHaveLength(1)
    expect(appts[0]!.time).toBe('15:00')          // "a las tres" = 15:00 (meeting default)
    expect(appts[0]!.date).toBe('2026-06-25')     // mañana
    expect(appts[0]!.title).toContain('Gabi')
  })

  it('the create reaches confirming in ONE turn (time parsed, no "what time?" reprompt)', async () => {
    const log = await replay(['agendá una reunión con Gabi mañana a las tres'])
    expect(log[0]!.intent).toBe('calendar_create')
    expect(log[0]!.phase).toBe('confirming')       // NOT stuck in "creating" asking for time
  })
})
