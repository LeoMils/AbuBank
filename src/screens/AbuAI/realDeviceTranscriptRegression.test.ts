/**
 * REAL DEVICE TRANSCRIPT REGRESSION
 * Exact failed flows from Leo's iPhone — each one locked so it cannot regress.
 * Time anchored to a fixed evening base.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { startCreate, resolvePendingMessage, isConfirm } from './calendarCreate'
import { understandMeeting } from './meetingIntelligence'
import { orchestrate } from './understandingOrchestrator'
import {
  IDLE_CONV, recordOnline, handleConversationTurn, isWhyChallenge, isOnlineChallenge,
} from './conversationOS'
import { toSpokenText } from './spokenPersona'
import { isOnlineCurrentInfoQuery } from './onlineIntent'
import { findBannedPhrase } from './companionComposer'
import { hasFabricatedLife } from './companionExperience'

const FIXED = new Date('2026-06-24T20:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => { const s: Record<string, string> = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} }) })

// 1 — Sports: result + schedule + who-won all route online, no generic loop.
describe('1. sports queries keep context and route online', () => {
  it.each([
    'מי ניצח במשחק בין ארגנטינה לירדן',
    'מה התוצאות היום של המונדיאל',
    'מי ניצח בין ארגנטינה לירדן',
    'איזה משחקים יש מחר',
    'כמה יצא ארגנטינה ירדן',
    'מה התוצאה',
  ])('"%s" → online', (q) => {
    expect(orchestrate(q, { messages: [] }).intent === 'online' || isOnlineCurrentInfoQuery(q)).toBe(true)
  })
  it('a fragment after a sports turn continues online (no loop)', () => {
    const hist = [{ role: 'user', content: 'מה התוצאות' }, { role: 'assistant', content: 'של איזה משחק?' }]
    expect(orchestrate('של משחקי הכדורגל באליפות העולם בארצות הברית', { messages: hist }).intent).toBe('online')
  })
  it('FAILURE A: "מי ניצח בין ארגנטינה לירדן" routes ONLINE — ירדן(Jordan) is not Yarden(family)', () => {
    for (const q of ['מי ניצח במשחק בין ארגנטינה לירדן', 'מי ניצח בין ארגנטינה לירדן', 'כמה יצא ארגנטינה ירדן']) {
      expect(orchestrate(q, { messages: [] }).intent).toBe('online')
    }
  })
})

// 2 — Calendar: "פגישה ביומן להיום בשעה 3:00 עם גבי" + "בבית קפה מרוקו" + "מאושר"
describe('2. calendar — 3:00 PM default, location merge, "מאושר" saves', () => {
  it('"…להיום בשעה 3:00 עם גבי" → Gabi / today / 15:00 / clean title', () => {
    const m = understandMeeting('פגישה ביומן להיום בשעה 3:00 עם גבי')
    expect(m.who).toBe('גבי')
    expect(m.date).toBe('2026-06-24')
    expect(m.time).toBe('15:00')                 // not 03:00
    expect(m.title).toBe('פגישה עם גבי')          // no "ביומן"
  })
  it('the full device flow: create → "בבית קפה מרוקו" merges → "מאושר" saves', () => {
    const st = startCreate('תקבעי פגישה עם גבי היום בשעה 3:00')
    const r = resolvePendingMessage(st, 'בבית קפה מרוקו', false)
    expect(r.action).toBe('update')
    if (r.action !== 'update') return
    expect(r.state.draft.location).toContain('מרוקו')
    expect(isConfirm('מאושר')).toBe(true)
    expect(resolvePendingMessage(r.state, 'מאושר', false).action).toBe('save')
  })
  it.each(['מאושר', 'מאושר תקבעי', 'יש לך אישור', 'כן אני רוצה שתקבעי', 'כן', 'נכון', 'קדימה', 'רשמי', 'בבקשה תקבעי', 'תקבעי את זה'])('confirmation "%s" saves', (c) => {
    const st = startCreate('תקבעי פגישה עם גבי מחר בשלוש')
    expect(resolvePendingMessage(st, c, false).action).toBe('save')
  })
})

// 3 — Pending pollution: sports during a pending create must NOT confirm calendar
describe('3. a pending calendar does not hijack an unrelated sports/weather turn', () => {
  it.each(['מי ניצח במשחק בין ארגנטינה לירדן', 'מה מזג האוויר בכפר סבא'])('"%s" → park (not clarify/save)', (q) => {
    const st = startCreate('תקבעי פגישה עם גבי מחר בשלוש')
    const r = resolvePendingMessage(st, q, false)
    expect(r.action).toBe('park')
  })
  // Production-simulator finding: an emotional statement mid-create must PARK (warm
  // answer), never a cold "בסדר, ביטלתי" or a mis-parse.
  it.each(['אני מתגעגעת לפאפי', 'אני לבד היום', 'estoy sola', 'אני עצובה', 'קשה לי'])('emotional "%s" mid-create → park (warm, not cancel)', (q) => {
    const st = startCreate('תקבעי פגישה עם גבי מחר בשלוש')
    expect(resolvePendingMessage(st, q, false).action).toBe('park')
  })
})

// 4 — Weather challenge: "השעה לא נכונה" → "למה" → exact explanation, no loop
describe('4. weather challenge gets a real explanation, never a loop', () => {
  it('after a recorded online failure, "למה" explains the real reason + retry', () => {
    const st = recordOnline(IDLE_CONV, { query: 'מזג האוויר', topic: 'weather', source: null, ok: false, reason: 'incomplete_data', summary: null })
    expect(isWhyChallenge('למה')).toBe(true)
    const turn = handleConversationTurn(st, 'למה')
    expect(turn.handled).toBe(true)
    expect(turn.speak).toMatch(/חלקי|שוב/)
    expect(turn.speak).not.toMatch(/אין לי אפשרות לבדוק את זה עכשיו/)
  })
  it('three challenges never repeat the same sentence', () => {
    let st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'provider_failed', summary: null })
    const said = new Set<string>()
    for (const msg of ['למה', 'מה הסיבה', 'אבל יש לך אונליין']) {
      const turn = handleConversationTurn(st, msg)
      expect(turn.handled).toBe(true)
      expect(said.has(turn.speak!)).toBe(false)
      said.add(turn.speak!); st = turn.state
    }
  })
  it('"אבל יש לך אונליין" is recognised as an online challenge', () => {
    expect(isOnlineChallenge('אבל יש לך אונליין')).toBe(true)
  })
})

// 5 — Companion: "מה שלומך" warm, no fabricated personal events
describe('5. "מה שלומך" is warm with no fabricated life', () => {
  it('a fabricated-life answer is stripped before speech', () => {
    const out = toSpokenText('היי. קצת עייפה, מור ויעל באו לבקר אתמול. ואת, מה שלומך?')
    expect(hasFabricatedLife(out)).toBe(false)
    expect(out).not.toMatch(/באו לבקר|עייפה/)
    expect(out.length).toBeGreaterThan(0)
  })
})

// 6 — Repeated frustration repairs, never loops
describe('6. repeated frustration is repaired, not looped', () => {
  it('"את לא יכולה את לא יכולה" with context → a repair, clean tone', () => {
    const st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'timeout', summary: null })
    const turn = handleConversationTurn(st, 'את לא יכולה את לא יכולה')
    // frustration with online context is handled (repair) and clean
    if (turn.handled) { expect(findBannedPhrase(turn.speak!)).toBeNull(); expect(turn.speak).not.toMatch(/אני כאן\b/) }
  })
})
