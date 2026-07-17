/**
 * CALENDAR REFERABILITY — the assistant's own just-created event is referable.
 * ═════════════════════════════════════════════════════════════════════════
 * Leo's flow: create a meeting → "where do I meet HIM?" → "move IT" → "cancel IT".
 * The pronoun ("אותו"/"אותה"/"איתו") must resolve to the event in FOCUS and be
 * answered from the store — never dead-end to the LLM (mandate principle B: the
 * deterministic engine CAN answer, so punting to the LLM is a false dead-end).
 *
 * First divergence found by driving runCognitiveTurn (mechanism-first): a property
 * question carrying a pronoun ("איפה אני פוגשת אותו?") classified as `general` →
 * needsLLM, DISPLAY=null, even with focus={calendar_event, רפי}. The bare-form gate
 * CAL_PROPERTY_RE did not match the pronoun phrasing.
 *
 * Evidence class: CODE (drives the real single runtime, real store round-trip).
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'

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

/** Drive a session and return the state + the last decision. */
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

const CREATE = ['תקבעי פגישה עם רפי מחר בשלוש בבית קפה מרוקו', 'כן']

describe('CALENDAR REFERABILITY — pronoun resolves to the focused event', () => {
  it('after save the focus is the created event', () => {
    const { st } = session(CREATE)
    expect(st.focus).toEqual({ kind: 'calendar_event', label: 'רפי' })
  })

  it('"איפה אני פוגשת אותו?" is answered from the store (WHERE), not the LLM', () => {
    const { last } = session([...CREATE, 'איפה אני פוגשת אותו?'])
    expect(last.needsLLM).toBe(false)
    expect(last.intent).toBe('calendar_read')
    expect(last.display ?? '').toContain('מרוקו')
  })

  it('"עם מי הפגישה?" is answered with the person (WHO), not the LLM', () => {
    const { last } = session([...CREATE, 'עם מי הפגישה?'])
    expect(last.needsLLM).toBe(false)
    expect(last.display ?? '').toContain('רפי')
  })

  it('"מתי אני נפגשת איתו?" is answered with the time (WHEN), not the LLM', () => {
    const { last } = session([...CREATE, 'מתי אני נפגשת איתו?'])
    expect(last.needsLLM).toBe(false)
    expect(last.display ?? '').toContain('15:00')
  })

  it('chained property questions keep the focus (no re-search, no dead-end)', () => {
    const { last, st } = session([...CREATE, 'איפה אני פוגשת אותו?', 'ובאיזו שעה?'])
    expect(last.needsLLM).toBe(false)
    expect(last.display ?? '').toContain('15:00')
    expect(st.focus).toEqual({ kind: 'calendar_event', label: 'רפי' })
  })

  it('GUARD: a property question naming a DIFFERENT person re-searches, not focus-read', () => {
    const { last } = session([...CREATE, 'מתי הפגישה עם גבי?'])
    expect(last.needsLLM).toBe(false)
    expect(last.intent).toBe('calendar_search')
    // It must NOT leak the focused event's data as if it were Gabi's.
    expect(last.display ?? '').toContain('גבי')
    expect(last.display ?? '').not.toContain('מרוקו')
  })

  // The deployed UI resolves a pronoun to the person NAME before the runtime
  // ("איפה אני פוגשת אותו?" → "איפה אני פוגשת את רפי?"). This form must STILL bind to
  // the focused event — the divergence that only showed on the preview.
  it('UI-RESOLVED pronoun ("...את רפי?") still reads from the focused event', () => {
    const { last } = session([...CREATE, 'איפה אני פוגשת את רפי?'])
    expect(last.needsLLM).toBe(false)
    expect(last.intent).toBe('calendar_read')
    expect(last.display ?? '').toContain('מרוקו')
  })

  it('after a resolved-name read, focus persists so "תבטלי אותה" still cancels it', () => {
    const { last, st } = session([...CREATE, 'איפה אני פוגשת את רפי?', 'תבטלי אותה'])
    expect(last.needsLLM).toBe(false)
    expect(last.intent).toBe('calendar_delete')
    expect(st.focus === null || st.focus?.kind === 'calendar_event').toBe(true)
  })
})
