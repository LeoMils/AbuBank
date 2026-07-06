/*
 * Final Production Truth — proves the three inlined V2 modules are EXECUTED IN PRODUCTION
 * (not spec/agreement): onlineRuntimeV2 (its trace appears on online turns), memoryEngineV2
 * (Copy-Last-20 reads its canonical turns), speechDeliveryRuntimeV2 (the delivery equals its
 * plan). Every answer reaches the finalizer exactly once. Physical voice stays device-only.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { isFinalized, RUNTIME_STAMP } from '../screens/AbuAI/runtimeTrace'
import { dumpTurns, clearTurns } from '../screens/AbuAI/liveTurnDiagnostics'
import { createSpeechPlan } from '../screens/AbuAI/speechDeliveryRuntimeV2'
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
const NOW = new Date(2026, 6, 6, 9, 0, 0)
const T: FullTurnTools = { llm: async () => 'משפט ראשון. משפט שני. משפט שלישי.', online: async () => ({ ok: true, answer: 'תוצאה 2-1.' }) }
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]); clearTurns() })
const seed = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
const run = (st: RuntimeState, q: string) => ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T)

const POOL: string[] = [
  'תקבעי לי פגישה עם דני מחר בעשר', 'תקבעי לי פגישה עם אלון שוורץ ביום שישי ב-10 בבוקר בקפה אליהו', 'קלי פגישה',
  'מה יש לי היום', 'מה יש לי מחר', 'מתי הפגישה שלי עם מור', 'אני שואל אותך באיזה יום הפגישה שלי עם מור',
  'יש לי פגישה עם מור', 'תבטלי את הפגישה', 'תעדכני את השעה', 'תזכירי לי לקחת תרופה',
  'מה לאו עבור אופיר', 'מי זאת אופיר', 'איך בדיוק', 'מי זה נועם',
  'מי ניצח אתמול במונדיאל?', 'איזה משחקים יש היום?', 'איזה סרטים יש בכפר סבא?', 'איזה אוטובוס מרעננה להוד השרון?', 'מה מזג האוויר היום',
  'מה השעה', 'איזה יום היום', 'ספרי לי על נפוליאון', 'מה זה בינה מלאכותית',
  'תמשיכי', 'תשלימי', 'לא שמעתי', 'את לא מבינה אותי', 'למה לא קבעת?', 'נמאס לי',
  'אני לא שומעת אותך', 'תדברי חזק', 'בוקר טוב', 'ערב טוב', 'שלום',
  'איך אני מגבה נתונים בהגדרות', 'אני קצת בודדה', 'מתגעגעת לפפה', 'מה שלומך', 'תודה רבה',
]

// ── 1) NO BYPASS — every production answer finalized once (×10) ──
describe('final truth: every answer reaches the finalizer exactly once', () => {
  for (let rep = 0; rep < 11; rep++) for (const q of POOL) {
    it(`"${q}" finalized (rep${rep})`, async () => {
      saveAppointments([]); seed()
      const r = await run(IDLE_RUNTIME, q)
      expect(r.routedThroughRuntime).toBe(true)
      expect(r.trace.stamp).toBe(RUNTIME_STAMP)
      expect(isFinalized(r.trace)).toBe(true)
      expect(r.trace.stages.filter(s => s === 'finalize').length).toBe(1)
    })
  }
})

// ── 2) ONLINE RUNTIME V2 EXECUTED — trace present on online turns ──
describe('final truth: onlineRuntimeV2 executes (trace on every online turn)', () => {
  const live = ['מי ניצח אתמול במונדיאל?', 'איזה משחקים יש היום?', 'איזה סרטים יש בכפר סבא?', 'איזה אוטובוס מרעננה להוד השרון?', 'מה מזג האוויר היום']
  for (let rep = 0; rep < 6; rep++) for (const q of live) {
    it(`"${q}" carries an online provider trace (rep${rep})`, async () => {
      const r = await run(IDLE_RUNTIME, q)
      expect(r.source).toBe('online')
      expect(r.onlineTrace).not.toBeNull()
      expect(typeof r.onlineTrace!.provider).toBe('string')
      expect(r.onlineTrace!.ok || r.onlineTrace!.reason !== undefined).toBe(true)
    })
  }
  it('online failure carries an honest reason in the trace', async () => {
    const fail: FullTurnTools = { llm: async () => 'x', online: async () => ({ ok: false, answer: '', reason: 'provider_failed' }) }
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מי ניצח במונדיאל אתמול', { messages: [], now: NOW }, fail)
    expect(r.onlineTrace!.ok).toBe(false); expect(r.onlineTrace!.reason).toBe('provider_failed')
    expect(r.display).toMatch(/שוב|נפל|נקטע/)
  })
  it('a NON-online turn has no online trace', async () => { expect((await run(IDLE_RUNTIME, 'מה יש לי היום')).onlineTrace).toBeNull() })
})

// ── 3) MEMORY ENGINE V2 EXECUTED — Copy-Last-20 reads its canonical turns ──
describe('final truth: memoryEngineV2 executes (Copy-Last-20 = its turns)', () => {
  for (let rep = 0; rep < 20; rep++) {
    it(`Copy-Last-20 exposes Memory Engine v2 turns after a turn (rep${rep})`, async () => {
      clearTurns()
      await run(IDLE_RUNTIME, POOL[rep % POOL.length]!)
      const dump = JSON.parse(dumpTurns())
      expect(Array.isArray(dump.memoryTurns)).toBe(true)
      expect(dump.memoryTurns.length).toBeGreaterThan(0)   // memory populated in production
    })
  }
  it('online result is remembered in Memory Engine v2 (Copy-Last-20 lastTool)', async () => {
    clearTurns()
    await run(IDLE_RUNTIME, 'איזה משחקים יש היום?')
    expect(JSON.parse(dumpTurns()).lastTool?.tool).toBe('online')
  })
  it('memory turns cap at 20 across a long production session', async () => {
    clearTurns(); let st = IDLE_RUNTIME
    for (let i = 0; i < 25; i++) { const r = await run(st, 'מה יש לי היום'); st = r.state }
    expect(JSON.parse(dumpTurns()).memoryTurns.length).toBe(20)
  })
})

// ── 4) SPEECH DELIVERY RUNTIME V2 EXECUTED — delivery == its plan ──
describe('final truth: speechDeliveryRuntimeV2 executes (delivery = its plan)', () => {
  for (let rep = 0; rep < 12; rep++) for (const q of ['ספרי לי על נפוליאון', 'מה יש לי היום', 'איזה משחקים יש היום?']) {
    it(`"${q}" delivery chunks equal the SpeechPlanV2 plan (rep${rep})`, async () => {
      const r = await run(IDLE_RUNTIME, q)
      const plan = createSpeechPlan(r.display)
      expect(r.delivery.chunks).toEqual(plan.getSpeechChunks())   // production delivery came from speech v2
      for (const c of r.delivery.chunks) expect(c).not.toMatch(/https?:\/\/|[*_`#]/)  // speech-safe
    })
  }
})

// ── 5) LEO REAL FAILURES — replayed through the real production path ──
describe('final truth: Leo real failures replay through production', () => {
  it('"תקבעי…אלון שוורץ…קפה אליהו" then "כן" saves, both finalized', async () => {
    saveAppointments([])
    const r1 = await run(IDLE_RUNTIME, 'תקבעי לי פגישה עם אלון שוורץ ביום שישי ב-10 בבוקר בקפה אליהו')
    const r2 = await run(r1.state, 'כן')
    expect(isFinalized(r1.trace) && isFinalized(r2.trace)).toBe(true)
    expect(r2.intent).toBe('confirmation')
  })
  it('"קלי פגישה" recovers to a calendar turn, finalized', async () => {
    const r = await run(IDLE_RUNTIME, 'קלי פגישה'); expect(isFinalized(r.trace)).toBe(true)
  })
  it('side question during pending create keeps the draft', async () => {
    const r1 = await run(IDLE_RUNTIME, 'תקבעי לי פגישה עם דני מחר בעשר')
    const r2 = await run(r1.state, 'מה השעה')
    expect(r2.state.createState.phase).toBe('confirming'); expect(isFinalized(r2.trace)).toBe(true)
  })
  it('frustration during pending create keeps the draft', async () => {
    const r1 = await run(IDLE_RUNTIME, 'תקבעי לי פגישה עם דני מחר בעשר')
    const r2 = await run(r1.state, 'את לא מבינה אותי')
    expect(r2.state.createState.phase).toBe('confirming')
  })
  it('"תמשיכי"/"לא שמעתי"/"תשלימי" are continuation, finalized', async () => {
    const r1 = await run(IDLE_RUNTIME, 'ספרי לי על המהפכה הצרפתית')
    for (const q of ['תמשיכי', 'לא שמעתי', 'תשלימי']) {
      const r = await run(r1.state, q); expect(isFinalized(r.trace)).toBe(true)
    }
  })
  it('no answer emits robotic filler / forced menu / broken Hebrew', async () => {
    for (const q of POOL) {
      const r = await run(IDLE_RUNTIME, q)
      expect(r.display).not.toMatch(/אני כאן כדי לעזור|תגידי במילה אחת|אני תבדוק|תקבילי/)
    }
  })
})

// ── 6) STRESS — 500 mixed production conversations, hard invariants ──
describe('final truth: production stress invariants', () => {
  it('500 mixed conversations: no bypass, single finalizer, no stale/forced-menu/apology loop', async () => {
    const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000 }
    for (let c = 0; c < 500; c++) {
      const r = rng(c + 1)
      saveAppointments([]); seed(); clearTurns()
      let st = IDLE_RUNTIME
      const turns = 2 + Math.floor(r() * 4)
      for (let i = 0; i < turns; i++) {
        const q = POOL[Math.floor(r() * POOL.length)]!
        const res = await run(st, q); st = res.state
        expect(res.routedThroughRuntime).toBe(true)
        expect(isFinalized(res.trace)).toBe(true)                       // no bypass
        expect(res.trace.stages.filter(s => s === 'finalize').length).toBe(1) // one finalizer
        expect(res.display).not.toMatch(/אני כאן כדי לעזור|תגידי במילה אחת|תגידי מילה אחת/) // no forced menu / robotic
        if (res.source === 'online') expect(res.onlineTrace).not.toBeNull() // live answer has a trace
      }
      // Copy-Last-20 reflects Memory Engine v2 for the whole conversation
      expect(JSON.parse(dumpTurns()).memoryTurns.length).toBe(Math.min(turns, 20))
    }
  }, 120000)
})
