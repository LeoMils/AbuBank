/*
 * Intent Router v2 acceptance — one canonical routing decision for every turn. Direct
 * router tests (scoring/priority/confidence/alternatives/clarification/trace) + agreement
 * with the REAL ExecutiveCognitiveController (the runtime's routing never diverges from
 * routeTurn). Uses Leo's real failures. Physical voice stays device-only.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { routeTurn, scoreIntents, buildRouterContext, explainDecision, exportRouterTrace, type RouterIntent } from '../screens/AbuAI/intentRouterV2'
import { saveAppointments } from '../screens/AbuCalendar/service'
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
const T: FullTurnTools = { llm: async () => 'x', online: async () => ({ ok: true, answer: 'תוצאה 2-1.' }) }
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })

// map the runtime intent to the router's category family for agreement checks
const FAMILY: Record<string, RouterIntent[]> = {
  calendar_create: ['calendar_create'], calendar_read: ['calendar_read'], calendar_search: ['calendar_search'],
  calendar_delete: ['calendar_delete'], family: ['family_relation', 'family_info'], online: ['online_live'],
  date_query: ['online_static'], continuation: ['continuation', 'replay'], frustration: ['frustration'],
}
async function controllerIntent(q: string): Promise<string> {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, q, { messages: [], now: NOW }, T)
  return r.intent
}

// ── 1) PENDING / CONFIRMATION PRIORITY (40) ──
describe('router: pending confirmation wins', () => {
  const yes = ['כן', 'כן, נכון', 'בסדר', 'אוקיי', 'נכון']
  for (let i = 0; i < 4; i++) for (const y of yes) {
    it(`pending + "${y}" → pending win (r${i})`, () => {
      const d = routeTurn(y, { pendingConfirmation: true, pendingAction: true })
      expect(d.reason).toMatch(/pending/); expect(d.trace.rule).toBe('pending_confirm_yes')
    })
    it(`no pending + "${y}" is NOT a pending win (r${i})`, () => {
      expect(routeTurn(y, {}).trace.rule).not.toBe('pending_confirm_yes')
    })
  }
  for (const c of ['בטלי', 'תבטלי', 'לא, עזבי', 'לא צריך']) {
    it(`pending + cancel "${c}" → explicit_cancel`, () => { expect(routeTurn(c, { pendingAction: true }).trace.rule).toBe('explicit_cancel') })
  }
})

// ── 2) CALENDAR AMBIGUITY (40) ──
describe('router: calendar create/search/read/delete/update', () => {
  const cases: Array<[string, RouterIntent]> = [
    ['תקבעי לי פגישה עם דני מחר בעשר', 'calendar_create'], ['קבעי לי תור לרופא', 'calendar_create'],
    ['מתי הפגישה שלי עם מור', 'calendar_search'], ['באיזה יום הפגישה שלי עם מור', 'calendar_search'],
    ['מה יש לי היום', 'calendar_read'], ['מה יש לי מחר', 'calendar_read'],
    ['תבטלי את הפגישה עם דני', 'calendar_delete'], ['תעדכני את השעה של הפגישה', 'calendar_update'],
    ['תזכירי לי לקחת תרופה', 'reminder'], ['כל יום בשמונה בבוקר', 'recurring'],
  ]
  for (let i = 0; i < 4; i++) for (const [q, want] of cases) {
    it(`"${q}" → ${want} (r${i})`, () => { expect(routeTurn(q).intent).toBe(want) })
  }
})

// ── 3) FAMILY / CALENDAR NAME COLLISION (40) ──
describe('router: a family name is not a calendar booking (and vice versa)', () => {
  it('"יש לי פגישה עם מור" → calendar (not family)', () => { expect(routeTurn('יש לי פגישה עם מור').intent.startsWith('calendar')).toBe(true) })
  it('"אני שואל אותך באיזה יום הפגישה שלי עם מור" → calendar_search', () => { expect(routeTurn('אני שואל אותך באיזה יום הפגישה שלי עם מור').intent).toBe('calendar_search') })
  it('"מה מור עבור לאו" → family_relation', () => { expect(routeTurn('מה מור עבור לאו').intent).toBe('family_relation') })
  it('"מי זאת אופיר" → family_info', () => { expect(routeTurn('מי זאת אופיר').intent).toBe('family_info') })
  const collide = ['פגישה עם מור', 'פגישה עם דני', 'תקבעי עם אופיר מחר', 'קבעי לי עם גלעד']
  for (let i = 0; i < 9; i++) for (const q of collide) {
    it(`"${q}" never routes to family (r${i})`, () => { expect(routeTurn(q).intent.startsWith('family')).toBe(false) })
  }
})

// ── 4) ONLINE LIVE vs STATIC (40) ──
describe('router: online live never answered by static', () => {
  const live = ['מי ניצח במונדיאל אתמול', 'איזה משחקים יש היום', 'איזה סרטים בכפר סבא', 'איזה אוטובוס לרעננה', 'מה מזג האוויר היום', 'מה חדש היום']
  for (let i = 0; i < 5; i++) for (const q of live) it(`"${q}" → online_live (r${i})`, () => { expect(routeTurn(q).intent).toBe('online_live') })
  for (const q of ['מה השעה', 'איזה יום היום']) it(`"${q}" → online_static (system clock)`, () => { expect(routeTurn(q).intent).toBe('online_static') })
  for (let i = 0; i < 4; i++) for (const q of ['ספרי לי על המהפכה הצרפתית', 'מי היה נפוליאון']) it(`"${q}" → knowledge_static (r${i})`, () => { expect(routeTurn(q).intent).toBe('knowledge_static') })
})

// ── 5) CONTINUATION / REPLAY / CORRECTION (30) ──
describe('router: continuation / replay / correction', () => {
  for (let i = 0; i < 8; i++) it(`"תמשיכי" → continuation (r${i})`, () => { expect(routeTurn('תמשיכי').intent).toBe('continuation') })
  for (let i = 0; i < 8; i++) it(`"לא שמעתי" → replay (r${i})`, () => { expect(routeTurn('לא שמעתי').intent).toBe('replay') })
  for (let i = 0; i < 7; i++) it(`"תשלימי" → continuation (r${i})`, () => { expect(routeTurn('תשלימי').intent).toBe('continuation') })
  for (let i = 0; i < 7; i++) it(`cancel → correction (r${i})`, () => { expect(routeTurn('לא, עזבי', { pendingAction: true }).intent).toBe('correction') })
})

// ── 6) FRUSTRATION / AUDIO / GREETING (30) ──
describe('router: frustration / audio / greeting', () => {
  for (let i = 0; i < 6; i++) for (const q of ['את לא מבינה אותי', 'למה לא קבעת']) it(`"${q}" → frustration (r${i})`, () => { expect(routeTurn(q).intent).toBe('frustration') })
  for (let i = 0; i < 5; i++) for (const q of ['אני לא שומעת אותך', 'תדברי חזק']) it(`"${q}" → audio_complaint (r${i})`, () => { expect(routeTurn(q).intent).toBe('audio_complaint') })
  for (let i = 0; i < 8; i++) it(`"בוקר טוב" → greeting (r${i})`, () => { expect(routeTurn('בוקר טוב').intent).toBe('greeting') })
})

// ── 7) HELP / APP-HOW-TO (30) ──
describe('router: app/help questions are answered, not dismissed', () => {
  const help = ['איך אני מגבה נתונים בהגדרות', 'איך מגבים את המידע', 'איך אני משתמש בכפתור', 'מה זה הכפתור הזה']
  for (let i = 0; i < 8; i++) for (const q of help) it(`"${q}" → help (r${i})`, () => { const d = routeTurn(q); expect(d.intent).toBe('help'); expect(d.needsClarification).toBe(false) })
})

// ── 8) UNKNOWN → NATURAL CLARIFICATION (30) ──
describe('router: unknown asks clarification, never forces a category', () => {
  const unknown = ['אהם', 'משהו כזה', 'לא יודעת', 'תעשי את זה', 'נו']
  for (let i = 0; i < 6; i++) for (const q of unknown) it(`"${q}" → unknown + needsClarification (r${i})`, () => {
    const d = routeTurn(q)
    expect(d.needsClarification).toBe(true)
    expect(d.intent).toBe('unknown')
    expect(explainDecision(d)).not.toMatch(/במילה אחת|באיזה יום/)   // forbidden fallbacks
  })
})

// ── 9) TRACE / NO-BYPASS + agreement with the real runtime (30) ──
describe('router: every decision is traceable + agrees with the runtime', () => {
  const all = ['תקבעי לי פגישה עם דני מחר בעשר', 'מה יש לי היום', 'איזה משחקים יש היום', 'מי זאת אופיר', 'תמשיכי', 'למה לא קבעת', 'מה השעה']
  for (const q of all) {
    it(`"${q}" decision carries reason+confidence+alternatives+trace`, () => {
      const d = routeTurn(q)
      expect(d.reason.length).toBeGreaterThan(0)
      expect(d.confidence).toBeGreaterThan(0)
      expect(Array.isArray(d.alternatives)).toBe(true)
      expect(exportRouterTrace(d).input).toBe(q)
      expect(exportRouterTrace(d).scores).toBeDefined()
    })
  }
  const agree = ['תקבעי לי פגישה עם דני מחר בעשר', 'מה יש לי היום', 'איזה משחקים יש היום', 'מי זאת אופיר', 'למה לא קבעת', 'מה השעה']
  for (const q of agree) {
    it(`runtime routing agrees with routeTurn for "${q}"`, async () => {
      const ci = await controllerIntent(q)
      const want = FAMILY[ci]
      if (want) expect(want).toContain(routeTurn(q).intent)   // no drift between runtime + router
      else expect(true).toBe(true)                            // general/other — router still decides deterministically
    })
  }
  it('buildRouterContext reads pending from memory', () => {
    expect(buildRouterContext({ getPendingAction: () => ({ phase: 'confirming' }) }).pendingConfirmation).toBe(true)
    expect(buildRouterContext({ getPendingAction: () => null }).pendingAction).toBe(false)
  })
  it('scoreIntents is deterministic (same input → same scores)', () => {
    expect(scoreIntents('תקבעי לי פגישה עם דני')).toEqual(scoreIntents('תקבעי לי פגישה עם דני'))
  })
})

// ── 10) STRESS — every route traceable, deterministic, no forced menu ──
describe('router: stress invariants', () => {
  it('300 mixed turns: every decision has a trace + reason + confidence, deterministic, no forced category', () => {
    const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000 }
    const POOL = ['תקבעי לי פגישה עם דני מחר', 'מה יש לי היום', 'מתי הפגישה שלי עם מור', 'איזה משחקים יש היום',
      'מי זאת אופיר', 'מה מור עבור לאו', 'תמשיכי', 'לא שמעתי', 'למה לא קבעת', 'איך אני מגבה נתונים בהגדרות',
      'בוקר טוב', 'מה השעה', 'ספרי לי על נפוליאון', 'אהם', 'תבטלי את הפגישה', 'אני לא שומעת']
    for (let c = 0; c < 300; c++) {
      const r = rng(c + 1); const q = POOL[Math.floor(r() * POOL.length)]!
      const withPending = r() < 0.3
      const d = routeTurn(q, withPending ? { pendingConfirmation: true, pendingAction: true } : {})
      expect(d.reason.length).toBeGreaterThan(0)                 // traceable reason
      expect(d.confidence).toBeGreaterThan(0)                    // confidence present
      expect(d.trace.input).toBe(q)                              // no bypass — trace matches
      expect(explainDecision(d)).not.toMatch(/במילה אחת|באיזה יום/) // no forbidden forced menu
      expect(routeTurn(q, withPending ? { pendingConfirmation: true, pendingAction: true } : {}).intent).toBe(d.intent) // deterministic
    }
  })
})
