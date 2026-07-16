/**
 * CALENDAR READ — named weekday ("מה יש לי ביום חמישי?").
 * ════════════════════════════════════════════════════════
 * Divergence #3 in the referable-CRUD flow: after moving/creating an event on
 * Thursday, "מה יש לי ביום חמישי?" answered "אין כלום ביומן" — confidently WRONG
 * (the event IS on Thursday). calendarReadReasoner parsed only היום/מחר/מחרתיים/
 * השבוע and otherwise read TODAY. A read that hides a real event is a dead-end.
 *
 * Fix: resolve a named weekday to its next occurrence and read THAT day. Honest
 * empty ("ביום שישי אין כלום") is preserved — the point is truth, not noise.
 *
 * Evidence class: CODE (drives the real runtime + real store round-trip).
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday → tomorrow (06-25) is Thursday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
  })
  vi.stubGlobal('navigator', { onLine: true })
})

function session(lines: string[]) {
  let st: RuntimeState = IDLE_RUNTIME
  const msgs: Array<{ role: string; content: string }> = []
  let last!: ReturnType<typeof runCognitiveTurn>
  for (const text of lines) {
    last = runCognitiveTurn(st, text, { messages: msgs, now: new Date() })
    st = last.state
    msgs.push({ role: 'user', content: text })
    if (last.display) msgs.push({ role: 'assistant', content: last.display })
  }
  return { st, last }
}

const CREATE_THU = ['תקבעי פגישה עם רפי מחר בשלוש', 'כן'] // saved on Thursday 2026-06-25

describe('CALENDAR READ — named weekday resolves to the right day', () => {
  it('"מה יש לי ביום חמישי?" surfaces the Thursday event (not a false "nothing")', () => {
    const { last } = session([...CREATE_THU, 'מה יש לי ביום חמישי?'])
    expect(last.needsLLM).toBe(false)
    expect(last.intent).toBe('calendar_read')
    expect(last.display ?? '').toContain('רפי')
    expect(last.display ?? '').not.toContain('אין כלום')
  })

  it('"מה יש לי ביום שישי?" is honestly empty (no event that day, and not today’s data)', () => {
    const { last } = session([...CREATE_THU, 'מה יש לי ביום שישי?'])
    expect(last.needsLLM).toBe(false)
    expect(last.display ?? '').not.toContain('רפי')
    expect(last.display ?? '').toMatch(/אין כלום|שקט/)
  })
})
