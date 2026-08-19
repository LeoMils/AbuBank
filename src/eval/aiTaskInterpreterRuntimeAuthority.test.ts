/*
 * AI Task Interpreter Runtime Authority — proves the interpreter is the authoritative
 * runtime decision layer: when confident it OVERRIDES the legacy router, and every final
 * answer carries the authority trace. All cases run through the REAL production runtime.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { interpretTask } from '../screens/AbuAI/aiTaskInterpreter'
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
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })
const seedMor = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
const run = (st: RuntimeState, q: string) => ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T)

// ── 1) DISAGREEMENT: the interpreter's decision is the executed route (120) ──
describe('authority: the interpreter decision is what the runtime executes', () => {
  const cases: Array<[string, string]> = [
    ['איזה אוטובוס מרעננה להוד השרון', 'online'], ['איזה משחקים יש מחר', 'online'], ['מי ניצח אתמול במונדיאל', 'online'],
    ['איזה סרטים יש בכפר סבא', 'online'], ['מה מזג האוויר מחר', 'online'],
    ['יש לי פגישה עם מור', 'calendar_search'], ['מתי יש לי פגישה עם דני', 'calendar_search'],
    ['תקבעי לי פגישה עם דני מחר בעשר', 'calendar_create'], ['תבטלי את הפגישה עם דני', 'calendar_delete'],
    ['תזכירי לי לקחת תרופה מחר', 'reminder'], ['מה יש לי היום', 'calendar_read'],
  ]
  for (let i = 0; i < 12; i++) for (const [q, want] of cases) {
    it(`"${q}" executes ${want} (r${i})`, async () => {
      seedMor()
      const r = await run(IDLE_RUNTIME, q)
      expect(r.runtimeExecutedTask).toBe(want)
      expect(typeof r.interpreterOverrodeRuntime).toBe('boolean')
    })
  }
})

// ── 2) ONLINE-vs-REMINDER override (40) ──
describe('authority: online_live can never execute as reminder', () => {
  const online = ['איזה משחקים יש מחר', 'איזה משחקים יש היום', 'מי ניצח אתמול במונדיאל', 'איזה אוטובוס מרעננה להוד השרון', 'מה מזג האוויר מחר']
  for (let i = 0; i < 8; i++) for (const q of online) {
    it(`"${q}" → online, not reminder (r${i})`, async () => {
      const r = await run(IDLE_RUNTIME, q)
      expect(r.source).toBe('online'); expect(r.runtimeExecutedTask).not.toBe('reminder')
      expect(interpretTask(q).forbiddenRoutes).toContain('reminder_create')
    })
  }
})

// ── 3) CALENDAR SEARCH-vs-CREATE override (40) ──
describe('authority: a search query never executes as a create', () => {
  const searches = ['יש לי פגישה עם מור', 'מתי יש לי פגישה עם מור', 'מתי הפגישה שלי עם מור', 'יש לי פגישה עם דני']
  for (let i = 0; i < 8; i++) for (const q of searches) {
    it(`"${q}" → search, not create (r${i})`, async () => { seedMor(); const r = await run(IDLE_RUNTIME, q); expect(r.runtimeExecutedTask).toBe('calendar_search'); expect(r.runtimeExecutedTask).not.toBe('calendar_create') })
  }
  const creates = ['תקבעי לי פגישה עם דני מחר בעשר', 'קבעי לי תור לרופא מחר בתשע']
  for (let i = 0; i < 4; i++) for (const q of creates) {
    it(`"${q}" → create (r${i})`, async () => { const r = await run(IDLE_RUNTIME, q); expect(r.runtimeExecutedTask).toBe('calendar_create') })
  }
})

// ── 4) FOLLOW-UP authority (30) ──
describe('authority: follow-up on the last meeting, never greeting/new intent', () => {
  for (let i = 0; i < 30; i++) {
    it(`"באיזה שעה" after a meeting → follow_up (r${i})`, () => {
      const t = interpretTask('באיזה שעה', { lastAnswerWasMeeting: true, lastMeetingTitle: 'פגישה עם מור' })
      expect(t.taskType).toBe('follow_up'); expect(t.followUpTarget).toBeTruthy()
      expect(t.forbiddenRoutes).toContain('calendar_create')
    })
  }
})

// ── 5) EXIT-FLOW authority (30) ──
describe('authority: exit clears the pending flow', () => {
  const exits = ['תצאי רגע מזה אני רוצה לשאול משהו אחר', 'זה לא להזכיר לי זאת שאלה שאני שואל אותך תעני לי', 'עזבי את זה', 'לא רוצה תזכורת', 'תעני לי זאת שאלה']
  for (let i = 0; i < 6; i++) for (const q of exits) {
    it(`"${q.slice(0, 14)}…" clears pending reminder (r${i})`, async () => {
      const a = await run(IDLE_RUNTIME, 'תזכירי לי מחר')
      const b = await run(a.state, q)
      expect(!!b.state.pendingReminder).toBe(false)
    })
  }
})

// ── 6) TRANSPORT / LIVE ONLINE (30) ──
describe('authority: transport/live questions route online', () => {
  const t = ['איזה אוטובוס מרעננה להוד השרון', 'איזה אוטובוס לרעננה', 'מתי הרכבת הבאה מתל אביב', 'מה מזג האוויר מחר', 'איזה משחקים יש מחר']
  for (let i = 0; i < 6; i++) for (const q of t) {
    it(`"${q}" → online (r${i})`, async () => { const r = await run(IDLE_RUNTIME, q); expect(r.source).toBe('online'); expect(interpretTask(q).taskType).toBe('online_live') })
  }
})

// ── 7) BIRTHDAY vs MEETING (30) ──
describe('authority: a meeting query never returns a birthday', () => {
  for (let i = 0; i < 15; i++) {
    it(`"מתי הפגישה עם מור" → search, no birthday (r${i})`, async () => { seedMor(); const r = await run(IDLE_RUNTIME, 'מתי הפגישה עם מור'); expect(r.runtimeExecutedTask).toBe('calendar_search'); expect(r.display).not.toMatch(/יום\s+הולדת/) })
    it(`"יש לי פגישה עם מור" → search, no birthday (r${i})`, async () => { seedMor(); const r = await run(IDLE_RUNTIME, 'יש לי פגישה עם מור'); expect(r.display).not.toMatch(/יום\s+הולדת/) })
  }
})

// ── 8) TRACE / ASSERTION (30) ──
describe('authority: every final answer carries the authority trace', () => {
  const pool = ['איזה משחקים יש מחר', 'יש לי פגישה עם מור', 'תקבעי לי פגישה עם דני מחר בעשר', 'מה יש לי היום', 'איזה אוטובוס מרעננה להוד השרון', 'ספרי לי על נפוליאון']
  for (let i = 0; i < 5; i++) for (const q of pool) {
    it(`"${q}" trace has aiTask + executed + overrode (r${i})`, async () => {
      const r = await run(IDLE_RUNTIME, q)
      expect(typeof r.aiTask.taskType).toBe('string')
      expect(typeof r.aiTask.confidence).toBe('number')
      expect(typeof r.aiTask.reason).toBe('string')
      expect('slots' in r.aiTask).toBe(true)
      expect(typeof r.runtimeExecutedTask).toBe('string')
      expect(typeof r.interpreterOverrodeRuntime).toBe('boolean')
    })
  }
  it('bus query overrides legacy (interpreterOverrodeRuntime true)', async () => {
    expect((await run(IDLE_RUNTIME, 'איזה אוטובוס מרעננה להוד השרון')).interpreterOverrodeRuntime).toBe(true)
  })
  it('confident search overrides legacy general', async () => {
    seedMor(); expect((await run(IDLE_RUNTIME, 'יש לי פגישה עם מור')).interpreterOverrodeRuntime).toBe(true)
  })
})

// ── 9) STRESS — random disagreements: interpreter wins, no forbidden route executes ──
describe('authority: stress invariants', () => {
  it('300 mixed turns: a high-confidence interpreter decision is always executed; forbidden routes never run', async () => {
    const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000 }
    const POOL: Array<[string, string | null]> = [
      ['איזה משחקים יש מחר', 'online'], ['איזה אוטובוס מרעננה להוד השרון', 'online'], ['מי ניצח אתמול במונדיאל', 'online'],
      ['יש לי פגישה עם מור', 'calendar_search'], ['מתי יש לי פגישה עם דני', 'calendar_search'],
      ['תקבעי לי פגישה עם דני מחר בעשר', 'calendar_create'], ['מה יש לי היום', 'calendar_read'],
      ['תזכירי לי לקחת תרופה מחר', 'reminder'], ['ספרי לי על נפוליאון', null],
    ]
    for (let c = 0; c < 300; c++) {
      const r = rng(c + 1); const [q, want] = POOL[Math.floor(r() * POOL.length)]!
      saveAppointments([]); seedMor()
      const res = await run(IDLE_RUNTIME, q)
      const task = interpretTask(q, {})
      // a high-confidence decisive interpreter task is the executed route
      if (want) expect(res.runtimeExecutedTask).toBe(want)
      // no interpreter-forbidden route ever executes
      const executedTask = res.runtimeExecutedTask
      if (task.forbiddenRoutes.includes('reminder_create')) expect(executedTask).not.toBe('reminder')
      if (task.forbiddenRoutes.includes('calendar_create')) expect(executedTask).not.toBe('calendar_create')
      // trace always present
      expect(typeof res.interpreterOverrodeRuntime).toBe('boolean')
      expect(res.display).not.toMatch(/תגידי במילה אחת|פגישה\s*\/\s*יומן/)
    }
  }, 120000)
})
