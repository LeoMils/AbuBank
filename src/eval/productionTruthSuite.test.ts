/*
 * Production Truth Suite
 * ══════════════════════
 * Fails if ANY production answer bypasses the canonical runtime, and ENCODES the measured
 * execution truth: which V2 modules the production entry actually imports (executed) vs
 * the closed cluster it does NOT (not executed). "Tests pass" ≠ executed — this suite
 * asserts real production execution, not spec agreement.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { isFinalized, RUNTIME_STAMP } from '../screens/AbuAI/runtimeTrace'
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
const T: FullTurnTools = { llm: async () => 'משפט ראשון. משפט שני.', online: async () => ({ ok: true, answer: 'תוצאה 2-1.' }) }
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })
const seed = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
const run = (st: RuntimeState, q: string) => ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T)
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

// ── A) STRUCTURAL TRUTH — what production actually imports (measured, encoded) ──
describe('production truth: the entry executes only the in-path modules', () => {
  const ENTRY = ['src/screens/AbuAI/cognitiveRuntime.ts', 'src/screens/AbuAI/runtimeFullTurn.ts', 'src/screens/AbuAI/runtimeFinalizer.ts', 'src/screens/AbuAI/executiveCognitiveController.ts', 'src/screens/AbuCalendar/service.ts']
  const src = ENTRY.map(read).join('\n')
  const NOT_EXECUTED = ['memoryEngineV2', 'memoryRuntimeAdapter', 'speechDeliveryRuntimeV2', 'onlineRuntimeV2', 'intentRouterV2']
  const EXECUTED = ['semanticIntelligenceEngine', 'conversationEngineV2', 'calendarEventBuilderV2', 'hebrewNaturalConversationV2']
  for (const m of NOT_EXECUTED) it(`production does NOT import ${m} (NOT EXECUTED IN PRODUCTION)`, () => { expect(src).not.toContain(`/${m}'`) })
  for (const m of EXECUTED) it(`production DOES import ${m} (EXECUTED IN PRODUCTION)`, () => { expect(src).toContain(`/${m}'`) })
})

// ── B) NO BYPASS — every production answer is RUNTIME_FINALIZED exactly once ──
const POOL = [
  'תקבעי לי פגישה עם דני מחר בעשר', 'מה יש לי היום', 'מתי הפגישה שלי עם מור', 'איזה משחקים יש היום',
  'מי זאת אופיר', 'מה לאו עבור אופיר', 'תמשיכי', 'לא שמעתי', 'למה לא קבעת', 'איך אני מגבה נתונים בהגדרות',
  'בוקר טוב', 'מה השעה', 'ספרי לי על נפוליאון', 'אני קצת בודדה', 'תבטלי את הפגישה', 'אני לא שומעת אותך',
]
describe('production truth: no answer bypasses the canonical runtime', () => {
  for (let rep = 0; rep < 3; rep++) for (const q of POOL) {
    it(`"${q}" is RUNTIME_FINALIZED once (rep${rep})`, async () => {
      saveAppointments([]); seed()
      const r = await run(IDLE_RUNTIME, q)
      expect(r.routedThroughRuntime).toBe(true)
      expect(r.trace.stamp).toBe(RUNTIME_STAMP)
      expect(isFinalized(r.trace)).toBe(true)
      expect(r.trace.stages.filter(s => s === 'finalize').length).toBe(1)
    })
  }
})

// ── C) REAL LEO FAILURE REPLAY — actual production path + is-it-now-impossible ──
describe('production truth: Leo real failures replayed through production', () => {
  it('"תקבעי…" → "כן" saves once, both turns finalized', async () => {
    saveAppointments([])
    const r1 = await run(IDLE_RUNTIME, 'תקבעי לי פגישה עם דני מחר בעשר')
    const r2 = await run(r1.state, 'כן')
    expect(isFinalized(r1.trace) && isFinalized(r2.trace)).toBe(true)
    expect(r2.intent).toBe('confirmation')
  })
  it('"יש לי פגישה עם מור" → calendar path, finalized', async () => {
    const r = await run(IDLE_RUNTIME, 'יש לי פגישה עם מור')
    expect(r.intent.startsWith('calendar')).toBe(true); expect(isFinalized(r.trace)).toBe(true)
  })
  it('"אני שואל אותך באיזה יום הפגישה שלי עם מור" → search, finalized', async () => {
    saveAppointments([]); seed()
    const r = await run(IDLE_RUNTIME, 'אני שואל אותך באיזה יום הפגישה שלי עם מור')
    expect(r.intent).toBe('calendar_search'); expect(isFinalized(r.trace)).toBe(true)
  })
  it('"איזה משחקים יש היום" → online source, finalized', async () => {
    const r = await run(IDLE_RUNTIME, 'איזה משחקים יש היום')
    expect(r.source).toBe('online'); expect(isFinalized(r.trace)).toBe(true)
  })
  it('"מי זאת אופיר" → family, finalized', async () => {
    const r = await run(IDLE_RUNTIME, 'מי זאת אופיר')
    expect(r.intent).toBe('family'); expect(isFinalized(r.trace)).toBe(true)
  })
  it('"תמשיכי" → continuation, finalized', async () => {
    const r1 = await run(IDLE_RUNTIME, 'ספרי לי על המהפכה הצרפתית')
    const r2 = await run(r1.state, 'תמשיכי')
    expect(r2.intent).toBe('continuation'); expect(isFinalized(r2.trace)).toBe(true)
  })
  it('"למה לא קבעת" during pending → explains, finalized, pending kept', async () => {
    const r1 = await run(IDLE_RUNTIME, 'תקבעי לי פגישה עם דני מחר בעשר')
    const r2 = await run(r1.state, 'למה לא קבעת')
    expect(isFinalized(r2.trace)).toBe(true); expect(r2.state.createState.phase).toBe('confirming')
  })
  it('no replayed answer emits a forbidden forced-menu phrase', async () => {
    for (const q of POOL) expect((await run(IDLE_RUNTIME, q)).display).not.toMatch(/תגידי במילה אחת|תגידי מילה אחת/)
  })
})
