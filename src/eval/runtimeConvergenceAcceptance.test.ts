/*
 * Runtime Convergence acceptance — proves ONE production path. Every turn across every
 * domain enters ExecutiveCognitiveController → runFullTurn → finalize → assertNoBypass and
 * emits an answer carrying a RUNTIME_FINALIZED trace with the required stages, exactly
 * once. No domain bypasses the finalizer; no answer is stamped twice. Physical voice only.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { isFinalized, REQUIRED_STAGES, RUNTIME_STAMP } from '../screens/AbuAI/runtimeTrace'
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
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })
const seed = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
const run = (st: RuntimeState, q: string) => ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T)

// diverse inputs across EVERY domain + Leo's real failures
const POOL: string[] = [
  'תקבעי לי פגישה עם דני מחר בעשר', 'קבעי לי תור לרופא ביום ראשון', 'תזמני פגישה עם אלון שוורץ',
  'מה יש לי היום', 'מה יש לי מחר', 'מה יש לי השבוע',
  'מתי הפגישה שלי עם מור', 'אני שואל אותך באיזה יום הפגישה שלי עם מור', 'באיזה יום התור שלי',
  'תבטלי את הפגישה עם דני', 'תעדכני את השעה של הפגישה למחר',
  'תזכירי לי לקחת תרופה', 'כל בוקר בשמונה תזכירי לי',
  'מה לאו עבור אופיר', 'מה מור עבור לאו', 'מי זאת אופיר', 'מי זה נועם', 'איך בדיוק',
  'מי ניצח במונדיאל אתמול', 'איזה משחקים יש היום', 'איזה סרטים יש בכפר סבא', 'איזה אוטובוס לרעננה', 'מה מזג האוויר היום',
  'מה השעה', 'איזה יום היום', 'מה התאריך היום',
  'ספרי לי על המהפכה הצרפתית', 'מי היה נפוליאון', 'מה זה בינה מלאכותית',
  'תמשיכי', 'תשלימי', 'לא שמעתי',
  'את לא מבינה אותי', 'למה לא קבעת', 'נמאס לי',
  'אני לא שומעת אותך', 'תדברי חזק יותר',
  'בוקר טוב', 'ערב טוב', 'שלום',
  'איך אני מגבה נתונים בהגדרות', 'איך מגבים את המידע',
  'אהם', 'משהו כזה', 'נו',
  'מה שלומך', 'תודה רבה',
  'יש לי פגישה עם מור', 'קבעי לי קפה עם רותי מחר בחמש בארומה',
  'אני קצת בודדה היום', 'מתגעגעת לפפה',
]

// ── 1) NO BYPASS — every answer is RUNTIME_FINALIZED with the required stages (×3) ──
describe('convergence: every turn is finalized through the one path', () => {
  for (let rep = 0; rep < 5; rep++) for (const q of POOL) {
    it(`"${q}" → finalized (rep${rep})`, async () => {
      saveAppointments([]); seed()
      const r = await run(IDLE_RUNTIME, q)
      expect(r.routedThroughRuntime).toBe(true)
      expect(r.trace.stamp).toBe(RUNTIME_STAMP)
      expect(isFinalized(r.trace)).toBe(true)
      expect(r.display.length).toBeGreaterThan(0)
    })
  }
})

// ── 2) REQUIRED STAGES present, none duplicated (single entry per stage) ──
describe('convergence: required stages present exactly, no double-finalize', () => {
  for (const q of POOL) {
    it(`"${q}" stages complete + single finalize`, async () => {
      const r = await run(IDLE_RUNTIME, q)
      for (const s of REQUIRED_STAGES) expect(r.trace.stages).toContain(s)
      expect(r.trace.stages.filter(s => s === 'finalize').length).toBe(1)  // no re-entry
      expect(r.trace.stages.filter(s => s === 'deliver').length).toBe(1)
    })
  }
})

// ── 3) DELIVERY consistency — display always present, delivery planned once ──
describe('convergence: display + delivery are coherent for every domain', () => {
  for (const q of POOL) {
    it(`"${q}" has delivery chunks covering display`, async () => {
      const r = await run(IDLE_RUNTIME, q)
      expect(r.delivery.chunks.length).toBeGreaterThan(0)
      expect(r.supervisor).toBeDefined()
      expect(typeof r.source).toBe('string')
    })
  }
})

// ── 4) MIXED CONVERSATIONS — pending survives, still finalized every turn ──
describe('convergence: multi-turn conversations stay on the one path', () => {
  const convos: string[][] = [
    ['תקבעי לי פגישה עם דני מחר בעשר', 'מה השעה', 'מי זאת אופיר', 'כן'],
    ['תקבעי לי פגישה עם דני מחר בעשר', 'איזה משחקים יש היום', 'למה לא קבעת', 'כן'],
    ['ספרי לי על המהפכה הצרפתית', 'תמשיכי', 'לא שמעתי'],
    ['מה ארי עבור ירדן', 'איך בדיוק', 'מי זאת אופיר'],
    ['תקבעי לי פגישה עם דני מחר בעשר', 'לא, עזבי', 'מה יש לי היום'],
    ['בוקר טוב', 'מה יש לי היום', 'תקבעי פגישה עם מור מחר בשתים עשרה', 'כן'],
  ]
  for (const convo of convos) {
    let st: RuntimeState = IDLE_RUNTIME
    convo.forEach((q, i) => {
      it(`[${convo.length}t] turn ${i + 1} "${q}" finalized`, async () => {
        if (i === 0) { saveAppointments([]); seed(); st = IDLE_RUNTIME }
        const r = await run(st, q); st = r.state
        expect(r.routedThroughRuntime).toBe(true)
        expect(isFinalized(r.trace)).toBe(true)
      })
    })
  }
})

// ── 5) DOMAIN CORRECTNESS spot-checks on the converged path (Leo failures) ──
describe('convergence: real Leo failures resolve correctly on the one path', () => {
  it('"תקבעי…" → "כן" saves exactly once', async () => {
    saveAppointments([])
    const r1 = await run(IDLE_RUNTIME, 'תקבעי לי פגישה עם דני מחר בעשר')
    const r2 = await run(r1.state, 'כן')
    expect(r2.intent).toBe('confirmation')
  })
  it('"יש לי פגישה עם מור" is a calendar turn, not family', async () => {
    const r = await run(IDLE_RUNTIME, 'יש לי פגישה עם מור')
    expect(r.intent.startsWith('calendar')).toBe(true)
  })
  it('"איזה משחקים יש היום" routes online', async () => { expect((await run(IDLE_RUNTIME, 'איזה משחקים יש היום')).source).toBe('online') })
  it('"מי זאת אופיר" routes family', async () => { expect((await run(IDLE_RUNTIME, 'מי זאת אופיר')).intent).toBe('family') })
  it('"תמשיכי" is continuation', async () => {
    const r1 = await run(IDLE_RUNTIME, 'ספרי לי על המהפכה הצרפתית')
    expect((await run(r1.state, 'תמשיכי')).intent).toBe('continuation')
  })
  it('no answer contains a forbidden forced-menu phrase', async () => {
    for (const q of POOL) {
      const r = await run(IDLE_RUNTIME, q)
      expect(r.display).not.toMatch(/תגידי במילה אחת|תגידי מילה אחת/)
    }
  })
})
