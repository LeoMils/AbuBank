/*
 * LEDGER SOFT-CONFIRM — the "one soft in-flow confirmation" door (Constitution §1).
 * Proves end-to-end via the REAL controller: a plainly-stated family fact (NO "תזכרי")
 * gets ONE Hebrew confirm prompt; the NEXT "כן" commits it (gated) and it is answerable;
 * "לא" abandons it; the flow never hijacks the calendar "כן".
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

const FIXED = new Date('2026-07-19T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
  saveAppointments([])
})
const TOOLS: FullTurnTools = { llm: async () => '[[LLM]]', online: async () => ({ ok: true, answer: 'x', reason: null }) }
async function run(seq: string[]) {
  let state: RuntimeState = IDLE_RUNTIME
  const out: Array<{ input: string; source: string; display: string }> = []
  for (const text of seq) {
    const r = await ExecutiveCognitiveController.handleTurn(state, text, { messages: [], now: FIXED }, TOOLS)
    state = r.state
    out.push({ input: text, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() })
  }
  return out
}

describe('LEDGER SOFT-CONFIRM — stated fact → prompt → "כן" commits → answerable', () => {
  it('a plainly-stated fact asks to confirm, then "כן" writes it and it is answerable', async () => {
    const [stated, confirmed, read] = await run(['רותי היא אשתו של דני', 'כן', 'מי אשתו של דני'])
    expect(stated!.display).toContain('לרשום')     // the soft-confirm prompt
    expect(stated!.display).not.toContain('רשמתי:') // NOT yet written
    expect(confirmed!.display).toContain('רשמתי')   // the "כן" committed it
    expect(read!.source).not.toBe('llm')
    expect(read!.display).toContain('רותי')          // answerable from the ledger
  })

  it('"לא" abandons the pending fact (nothing written)', async () => {
    const [stated, declined, read] = await run(['רותי היא אשתו של דני', 'לא', 'מי אשתו של דני'])
    expect(stated!.display).toContain('לרשום')
    expect(declined!.display).toContain('לא רשמתי')
    // Not written → the ledger read finds nothing (falls through to the honest family reply).
    expect(read!.display).not.toContain('רותי')
  })

  it('the soft-confirm "כן" NEVER hijacks a calendar confirmation', async () => {
    // A calendar create's "כן" must still save the meeting (no ledger interference).
    const [, , confirm] = await run(['תקבעי פגישה עם רפי מחר בשלוש', /* create */ 'כן'])
    // (only two turns; the create prompt then the calendar "כן")
    void confirm
    const [created, saved] = await run(['תקבעי פגישה עם רפי מחר בשלוש', 'כן'])
    expect(created!.display).toContain('נכון')       // calendar confirm prompt
    expect(saved!.display).toContain('קבוע')          // calendar saved (not a ledger reply)
    expect(saved!.display).not.toContain('רשמתי:')
  })
})
