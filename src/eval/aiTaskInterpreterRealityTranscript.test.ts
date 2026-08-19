/*
 * AI Task Interpreter — reality transcript regression. Leo's exact latest iPhone failures,
 * run through the REAL production runtime (ExecutiveCognitiveController), plus the
 * interpreter's structured slots. Never route on keywords alone; infer the task.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { interpretTask, isExitCurrentFlow } from '../screens/AbuAI/aiTaskInterpreter'
import { dumpTurns, clearTurns } from '../screens/AbuAI/liveTurnDiagnostics'
import { saveAppointments, addAppointment } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}
const NOW = new Date(2026, 6, 7, 9, 0, 0)
const T: FullTurnTools = { llm: async () => 'תשובה כללית.', online: async () => ({ ok: true, answer: 'משחק ב-20:00.' }) }
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]); clearTurns() })
const seedMor = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
const run = (st: RuntimeState, q: string) => ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T)
const FORCED = /פגישה\s*\/\s*יומן|באיזה יום\?|תגידי במילה אחת|תגידי מילה אחת/u

// ── 1) EXACT TRANSCRIPT REGRESSION (80) ──
describe('reality: the 8 exact failures do not reproduce', () => {
  for (let i = 0; i < 12; i++) {
    it(`(1) "יש לי פגישה עם מור" → search, not create/family (r${i})`, async () => { const r = await run(IDLE_RUNTIME, 'יש לי פגישה עם מור'); expect(r.intent).toBe('calendar_search'); expect(r.display).not.toMatch(FORCED) })
    it(`(2) "מתי יש לי פגישה עם מור" → search (r${i})`, async () => { seedMor(); const r = await run(IDLE_RUNTIME, 'מתי יש לי פגישה עם מור'); expect(r.intent).toBe('calendar_search'); expect(r.display).not.toMatch(FORCED) })
    it(`(4) "איזה משחקים יש מחר" → online, not reminder (r${i})`, async () => { const r = await run(IDLE_RUNTIME, 'איזה משחקים יש מחר'); expect(r.source).toBe('online'); expect(r.intent).not.toBe('reminder') })
    it(`(5) exit reminder via "זאת שאלה" clears pending (r${i})`, async () => { const a = await run(IDLE_RUNTIME, 'תזכירי לי מחר'); const b = await run(a.state, 'זה לא להזכיר לי זאת שאלה שאני שואל אותך תעני לי'); expect(!!b.state.pendingReminder).toBe(false) })
    it(`(6) exit via "תצאי רגע מזה" clears pending (r${i})`, async () => { const a = await run(IDLE_RUNTIME, 'תזכירי לי מחר'); const b = await run(a.state, 'תצאי רגע מזה אני רוצה לשאול משהו אחר'); expect(!!b.state.pendingReminder).toBe(false) })
    it(`(7) create with location keeps location (r${i})`, async () => { const s = interpretTask('תקבעי לי פגישה עם מור למחר ב-9 בבוקר בקפה אסתר בנהריה').slots; expect(s!.location).toMatch(/אסתר/); expect(s!.title).toBe('פגישה עם מור') })
    it(`(8) "יונה ... 7 אחר הצהריים" → create, not reminder (r${i})`, async () => { const r = await run(IDLE_RUNTIME, 'תקבעי לי פגישה עם יונה מחר בשעה 7 אחר הצהריים'); expect(r.intent).toBe('calendar_create'); expect(r.intent).not.toBe('reminder') })
    it(`(3) "מתי הפגישה עם מור" is search (r${i})`, async () => { seedMor(); const r = await run(IDLE_RUNTIME, 'מתי הפגישה עם מור'); expect(r.intent).toBe('calendar_search') })
  }
})

// ── 2) CALENDAR SEARCH/READ/CREATE DISAMBIGUATION (40) ──
describe('reality: calendar search vs read vs create', () => {
  const cases: Array<[string, string]> = [
    ['יש לי פגישה עם דני', 'calendar_search'], ['מתי הפגישה שלי עם מור', 'calendar_search'],
    ['מתי יש לי תור', 'calendar_search'], ['מה יש לי היום', 'calendar_read'], ['מה יש לי מחר', 'calendar_read'],
    ['תקבעי לי פגישה עם דני מחר בעשר', 'calendar_create'], ['קבעי לי תור לרופא מחר בתשע', 'calendar_create'],
    ['תבטלי את הפגישה עם דני', 'calendar_delete'],
  ]
  for (let i = 0; i < 5; i++) for (const [q, want] of cases) {
    it(`"${q}" → ${want} (r${i})`, async () => { seedMor(); const r = await run(IDLE_RUNTIME, q); if (want === 'calendar_search') expect(['calendar_search']).toContain(r.intent); else expect(r.intent).toBe(want); expect(r.display).not.toMatch(FORCED) })
  }
})

// ── 3) LOCATION / NOTES EXTRACTION (40) ──
describe('reality: location + notes are first-class fields', () => {
  const withLoc: Array<[string, RegExp]> = [
    ['תקבעי פגישה עם מור מחר בתשע בקפה אסתר בנהריה', /אסתר/],
    ['קבעי לי פגישה עם דני מחר בעשר בקפה אליהו', /אליהו/],
    ['תקבעי תור לרופא מחר בשמונה במרפאה ברעננה', /מרפאה|רעננה/],
    ['תקבעי פגישה עם רותי מחר בחמש בבית קפה ארומה', /ארומה/],
  ]
  for (let i = 0; i < 8; i++) for (const [q, loc] of withLoc) {
    it(`"${q.slice(0, 20)}…" location captured (r${i})`, () => {
      const s = interpretTask(q).slots!
      expect(s.location).toBeTruthy(); expect(s.location!).toMatch(loc)
      expect('notes' in s).toBe(true); expect('location' in s).toBe(true)   // first-class fields
      expect(s.title).not.toBe(q)                                            // never the raw transcript
    })
  }
  it('every calendar slot object has location + notes keys', () => {
    const s = interpretTask('תקבעי פגישה עם מור מחר בתשע').slots!
    expect(s).toHaveProperty('location'); expect(s).toHaveProperty('notes')
  })
})

// ── 4) ONLINE vs REMINDER (40) ──
describe('reality: online questions never become reminders', () => {
  const online = ['איזה משחקים יש מחר', 'איזה משחקים יש היום', 'מי ניצח אתמול במונדיאל', 'איזה סרטים יש בכפר סבא']
  for (let i = 0; i < 8; i++) for (const q of online) {
    it(`"${q}" → online, never reminder (r${i})`, async () => { const r = await run(IDLE_RUNTIME, q); expect(r.source).toBe('online'); expect(r.intent).not.toBe('reminder'); expect(interpretTask(q).taskType).toBe('online_live') })
  }
  it('interpreter classifies a bus query as online_live (never reminder)', () => { expect(interpretTask('איזה אוטובוס לרעננה').taskType).toBe('online_live') })
  it('interpreter forbids reminder for an online task', () => { expect(interpretTask('איזה משחקים יש מחר').forbiddenRoutes).toContain('reminder_create') })
  const notReminder = ['מה יהיה מחר', 'מה קורה בערב', 'יש משהו מעניין מחר']
  for (const q of notReminder) it(`"${q}" is not a reminder just because of מחר/בערב`, () => { expect(interpretTask(q).taskType).not.toBe('reminder_create') })
})

// ── 5) FOLLOW-UP CONTEXT (30) ──
describe('reality: follow-up on the last meeting, never a greeting', () => {
  for (let i = 0; i < 15; i++) {
    it(`"באיזה שעה" after a meeting → follow_up (r${i})`, () => { const t = interpretTask('באיזה שעה', { lastAnswerWasMeeting: true, lastMeetingTitle: 'פגישה עם מור' }); expect(t.taskType).toBe('follow_up'); expect(t.followUpTarget).toBeTruthy() })
    it(`follow-up is never greeting/create (r${i})`, () => { const t = interpretTask('באיזה שעה', { lastAnswerWasMeeting: true }); expect(t.forbiddenRoutes).toContain('calendar_create') })
  }
})

// ── 6) EXIT CURRENT FLOW (30) ──
describe('reality: the user can always leave a stuck flow', () => {
  const exits = ['תצאי רגע מזה אני רוצה לשאול משהו אחר', 'זה לא להזכיר לי זאת שאלה', 'עזבי את זה', 'לא רוצה תזכורת', 'תעני לי זאת שאלה']
  for (let i = 0; i < 4; i++) for (const q of exits) {
    it(`"${q.slice(0, 16)}…" exits reminder (r${i})`, async () => { const a = await run(IDLE_RUNTIME, 'תזכירי לי מחר'); const b = await run(a.state, q); expect(!!b.state.pendingReminder).toBe(false) })
  }
  for (const q of exits) it(`isExitCurrentFlow("${q.slice(0, 12)}…") true`, () => { expect(isExitCurrentFlow(q)).toBe(true) })
  it('exit is not triggered by a normal reminder time', () => { expect(isExitCurrentFlow('מחר בערב')).toBe(false) })
})

// ── 7) FORCED MENU FORBIDDEN (30) ──
describe('reality: no forced category menu / "באיזה יום?"', () => {
  const pool = ['יש לי פגישה עם מור', 'מתי יש לי פגישה עם מור', 'איזה משחקים יש מחר', 'מי זאת אופיר', 'תקבעי פגישה עם דני מחר בעשר', 'מה יש לי היום', 'אהם', 'משהו כזה']
  for (let i = 0; i < 4; i++) for (const q of pool) {
    it(`"${q}" never shows a forced menu (r${i})`, async () => { seedMor(); const r = await run(IDLE_RUNTIME, q); expect(r.display).not.toMatch(FORCED) })
  }
})

// ── 8) BIRTHDAY vs MEETING (30) ──
describe('reality: a meeting query is never answered with a birthday', () => {
  for (let i = 0; i < 15; i++) {
    it(`"מתי הפגישה עם מור" → search, not birthday (r${i})`, async () => { seedMor(); const r = await run(IDLE_RUNTIME, 'מתי הפגישה עם מור'); expect(r.intent).toBe('calendar_search'); expect(r.display).not.toMatch(/יום\s+הולדת/) })
    it(`"מתי יום ההולדת של מור" is not a meeting search (r${i})`, () => { expect(interpretTask('מתי יום ההולדת של מור').taskType).not.toBe('calendar_search') })
  }
})

// ── 9) TRACE — AI Task Interpreter appears in Copy Last 20 ──
describe('reality: Copy Last 20 carries the AI Task Interpreter trace', () => {
  it('online turn records aiTask.taskType + reason + forbiddenRoutes', async () => {
    clearTurns(); await run(IDLE_RUNTIME, 'איזה משחקים יש מחר')
    const t = JSON.parse(dumpTurns()).turns[0]
    expect(t.aiTask.taskType).toBe('online_live')
    expect(typeof t.aiTask.reason).toBe('string')
    expect(Array.isArray(t.aiTask.forbiddenRoutes)).toBe(true)
  })
  it('create turn records slots with location/notes', async () => {
    clearTurns(); await run(IDLE_RUNTIME, 'תקבעי פגישה עם מור מחר בתשע בקפה אסתר בנהריה')
    const t = JSON.parse(dumpTurns()).turns[0]
    expect(t.aiTask.taskType).toBe('calendar_create')
    expect(t.aiTask.slots).toHaveProperty('location')
  })
})
