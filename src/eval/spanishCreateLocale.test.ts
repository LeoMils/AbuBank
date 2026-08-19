/*
 * GOLD REPLAY — the Spanish create must STAY in Spanish end-to-end (§20.2).
 * ═══════════════════════════════════════════════════════════════════════════
 * After 0.69.0 the mandatory Spanish scenario SAVES, but every AbuAI turn was still
 * Hebrew: the clarify ("באיזו שעה?"), the confirm ("...נכון?"), and the save line
 * ("קבוע —"). §20.2 requires AbuAI to "remain in Spanish unless Martita switches
 * language." This locks the clarify + confirm + save (and cross-turn continuity) in
 * Spanish, while a Hebrew create is unchanged.
 *
 * Continuity note: a bare Spanish time answer ("a las cuatro") detects as Hebrew on its
 * own, so the create's language must be REMEMBERED on the draft, not re-detected per turn.
 * Evidence class: CODE (deterministic runtime, LLM/online stubbed). Not device-proven.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments } from '../screens/AbuCalendar/service'
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
const tools: FullTurnTools = { llm: async (i: string) => `[LLM] ${i.slice(0, 40)}`, online: async (q: string) => ({ ok: true, answer: `online: ${q}` }) }
interface TurnResult { say: string; intent: string; display: string; eff: unknown }
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
    out.push({ say, intent: r.intent, display: r.display, eff: r.sideEffect })
  }
  return out
}

describe('GOLD REPLAY — Spanish create stays in Spanish (§20.2)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
  afterEach(() => { vi.useRealTimers(); delete (globalThis as { localStorage?: unknown }).localStorage })

  it('the CONFIRM question is Spanish, not Hebrew', async () => {
    const log = await replay(['agendá una reunión con Gabi mañana a las tres'])
    const confirm = log[0]!.display
    expect(confirm).not.toMatch(HEBREW)               // no Hebrew characters at all
    expect(confirm).toMatch(/¿Está bien\?|¿lo agendo\?/i)
    expect(confirm).toContain('Gabi')
  })

  it('the CLARIFY question (missing time) is Spanish', async () => {
    const log = await replay(['agendá una reunión con Gabi mañana'])
    expect(log[0]!.display).not.toMatch(HEBREW)
    expect(log[0]!.display).toMatch(/¿A qué hora\?/i)
  })

  it('the SAVE confirmation is Spanish and saves exactly once', async () => {
    const log = await replay(['agendá una reunión con Gabi mañana a las tres', 'dale'])
    const saved = log[log.length - 1]!
    expect(saved.eff).toBe('saved_appointment')
    expect(saved.display).not.toMatch(HEBREW)
    expect(saved.display).toMatch(/Listo|agend/i)
    expect(loadAppointments()).toHaveLength(1)
    expect(loadAppointments()[0]!.time).toBe('15:00')
  })

  it('CONTINUITY: a bare Spanish time answer keeps the flow in Spanish', async () => {
    // "a las cuatro" detects as Hebrew on its own — the create must remember it is Spanish.
    const log = await replay(['agendá una reunión con Gabi mañana', 'a las cuatro', 'dale'])
    const clarify = log[0]!.display, confirm = log[1]!.display, saved = log[2]!.display
    expect(clarify).not.toMatch(HEBREW)     // ¿A qué hora?
    expect(confirm).not.toMatch(HEBREW)     // Spanish confirm even though "a las cuatro" is he
    expect(confirm).toMatch(/¿Está bien\?|¿lo agendo\?/i)
    expect(saved).not.toMatch(HEBREW)
    expect(log[2]!.eff).toBe('saved_appointment')
    expect(loadAppointments()[0]!.time).toBe('16:00')
  })

  it('a HEBREW create is unaffected (still Hebrew confirm + save)', async () => {
    const log = await replay(['תקבעי פגישה עם מור מחר בשלוש', 'כן'])
    expect(log[0]!.display).toContain('נכון?')          // Hebrew confirm intact
    expect(log[1]!.display).toContain('קבוע')           // Hebrew save intact
    expect(log[1]!.eff).toBe('saved_appointment')
  })
})
