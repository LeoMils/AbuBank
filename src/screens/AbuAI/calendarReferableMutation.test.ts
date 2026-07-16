/**
 * CALENDAR REFERABLE MUTATION — "cancel it" / "move it" bind to the event, and the
 * readback is a human date (not raw ISO). Completes the referable-CRUD flow.
 * ══════════════════════════════════════════════════════════════════════════════
 * Found by driving runCognitiveTurn over a TWO-event store (mechanism-first):
 *   • "תבטלי אותה" (cancel IT — pronoun, no noun) classified as `general` → needsLLM,
 *     DISPLAY=null, event NOT deleted. isDeleteIntent missed the pronoun form, so the
 *     mandate's exact "cancel it" dead-ended to the LLM (principle B).
 *   • "תעבירי אותה ליום ראשון" moved the right event but read back a RAW ISO date
 *     ("ל-2026-06-28") — unreadable for an 80+ user (divergence #2).
 *
 * Evidence class: CODE (drives the real single runtime + real store round-trip).
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { loadAppointments } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday
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

function drive(lines: string[]) {
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
const RAW_ISO = /\d{4}-\d{2}-\d{2}/
const titles = () => loadAppointments().map(a => a.title)

const TWO = [
  'תקבעי פגישה עם רפי מחר בשלוש', 'כן',                     // רפי, Thu 06-25 15:00
  'תקבעי פגישה עם גבי מחרתיים בארבע אחר הצהריים', 'כן',      // גבי, Fri 06-26 16:00
]

describe('CALENDAR REFERABLE MUTATION — "move it" / "cancel it"', () => {
  it('single event: "תבטלי אותה" deletes the just-created event (not a dead-end)', () => {
    const { last } = drive(['תקבעי פגישה עם רפי מחר בשלוש', 'כן', 'תבטלי אותה'])
    expect(last.needsLLM).toBe(false)
    expect(last.intent).toBe('calendar_delete')
    expect(last.sideEffect).toBe('deleted')
    expect(loadAppointments().length).toBe(0)
  })

  it('"תעבירי אותה ליום ראשון" moves the referent and reads back a HUMAN date (no raw ISO)', () => {
    const { last } = drive([...TWO, 'תעבירי אותה ליום ראשון'])
    expect(last.intent).toBe('calendar_update')
    expect(last.sideEffect).toBe('updated')
    expect(last.display ?? '').toContain('גבי')      // the referent (last created)
    expect(last.display ?? '').toContain('ביוני')    // friendly Hebrew month
    expect(last.display ?? '').not.toMatch(RAW_ISO)  // never a bare 2026-06-28
    // גבי moved off Friday 06-26; רפי untouched.
    const gabi = loadAppointments().find(a => a.title.includes('גבי'))!
    expect(gabi.date).not.toBe('2026-06-26')
    expect(loadAppointments().find(a => a.title.includes('רפי'))!.date).toBe('2026-06-25')
  })

  it('after the move, "תבטלי אותה" cancels the referent (גבי), and רפי survives', () => {
    const { last } = drive([...TWO, 'תעבירי אותה ליום ראשון', 'תבטלי אותה'])
    expect(last.needsLLM).toBe(false)
    expect(last.intent).toBe('calendar_delete')
    expect(last.sideEffect).toBe('deleted')
    expect(titles().some(t => t.includes('גבי'))).toBe(false)
    expect(titles().some(t => t.includes('רפי'))).toBe(true)
  })

  it('"תבטלי את הפגישה האחרונה" cancels the last meeting', () => {
    const { last } = drive([...TWO, 'תבטלי את הפגישה האחרונה'])
    expect(last.intent).toBe('calendar_delete')
    expect(last.sideEffect).toBe('deleted')
    expect(titles().some(t => t.includes('גבי'))).toBe(false)
    expect(titles().some(t => t.includes('רפי'))).toBe(true)
  })
})
