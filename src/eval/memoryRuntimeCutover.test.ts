/*
 * Memory Runtime Cutover — proves Memory Engine v2 (via memoryRuntimeAdapter) is the
 * single canonical accessor over the runtime carrier: the projected memory MIRRORS the
 * runtime state exactly (no drift), each turn writes exactly once, Copy-Last-20 reads
 * the same canonical memory, and separate instances never leak.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { memoryFromState, SessionMemory } from '../screens/AbuAI/memoryRuntimeAdapter'
import { createMemoryEngine, type TurnDecision } from '../screens/AbuAI/memoryEngineV2'
import { lastTurns, clearTurns } from '../screens/AbuAI/liveTurnDiagnostics'
import { saveAppointments, loadAppointments, addAppointment } from '../screens/AbuCalendar/service'
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
const T: FullTurnTools = { llm: async () => 'משפט ראשון. משפט שני. משפט שלישי.', online: async () => ({ ok: true, answer: 'משחק ב-20:00.' }) }
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]); clearTurns() })
const seedMor = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
const daniCount = () => loadAppointments().filter(a => (a.title ?? '').includes('דני')).length
const asDecision = (r: Awaited<ReturnType<typeof ExecutiveCognitiveController.handleTurn>>): TurnDecision =>
  ({ intent: r.intent, display: r.display, chunks: r.delivery.chunks, source: r.source, state: { createState: r.state.createState, lastFamilyPair: r.state.lastFamilyPair } })

async function drive(seq: string[], seed?: () => void) {
  saveAppointments([]); seed?.(); clearTurns()
  const sm = new SessionMemory('s'); let st: RuntimeState = IDLE_RUNTIME; const results = []
  for (const q of seq) {
    const r = await ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T)
    st = r.state
    sm.record(q, asDecision(r))
    // NOTE: the controller ALREADY records to liveTurnDiagnostics once per turn (the
    // single last-20 writer) — we do NOT double-write here. The consistency test below
    // proves that controller-fed diagnostics and the session memory are one view.
    results.push(r)
  }
  return { sm, st, results }
}

const SEQUENCES: string[][] = [
  ['תקבעי פגישה עם דני מחר בעשר', 'מה השעה', 'כן'],
  ['תקבעי פגישה עם דני מחר בעשר', 'מי זה נועם', 'כן'],
  ['תקבעי פגישה עם דני מחר בעשר', 'יש לי פגישה עם מור', 'כן'],
  ['תקבעי פגישה עם דני מחר בעשר', 'למה לא קבעת?', 'כן'],
  ['תקבעי פגישה עם דני מחר בעשר', 'לא שמעתי', 'כן'],
  ['תקבעי פגישה עם דני מחר בעשר', 'את לא מבינה אותי', 'כן'],
  ['מה ארי עבור ירדן', 'איך בדיוק'],
  ['ספרי לי על המהפכה הצרפתית', 'תמשיכי'],
  ['תקבעי פגישה עם דני מחר בעשר', 'מה הסרטים בכפר סבא', 'מי זה נועם', 'כן'],
  ['מה יש לי היום', 'תקבעי פגישה עם דני מחר בעשר', 'כן'],
]

// ── 1) MIRRORING: adapter view === runtime carrier, every turn (no drift) ──
describe('cutover: memory mirrors the runtime carrier (no drift)', () => {
  for (const seq of SEQUENCES) {
    it(`[${seq.join(' → ')}] adapter mirrors createState/family every turn`, async () => {
      saveAppointments([]); seedMor()
      let st: RuntimeState = IDLE_RUNTIME
      for (const q of seq) {
        const r = await ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T); st = r.state
        const view = memoryFromState(st)
        expect(view.hasPending()).toBe(st.createState.phase !== 'idle')
        expect(view.getPendingLabel()).toBe(st.createState.phase !== 'idle' ? (st.createState.draft.title ?? null) : null)
        expect(view.getLastFamilyPair()).toEqual(st.lastFamilyPair ?? null)
      }
    })
    it(`[${seq.join(' → ')}] SessionMemory pending agrees with the carrier at the end`, async () => {
      const { sm, st } = await drive(seq, seedMor)
      expect(!!sm.getPendingAction()).toBe(st.createState.phase !== 'idle')
    })
    it(`[${seq.join(' → ')}] SessionMemory family pair agrees with the carrier`, async () => {
      const { sm, st } = await drive(seq, seedMor)
      expect(sm.getLastFamilyPair()).toEqual(st.lastFamilyPair ?? null)
    })
  }
})

// ── 2) WRITE-ONCE per turn (hard rule 6) ──
describe('cutover: exactly one memory write per turn', () => {
  for (const seq of SEQUENCES) {
    it(`[${seq.length} turns] writes == turns`, async () => { const { sm } = await drive(seq, seedMor); expect(sm.writes()).toBe(seq.length) })
    it(`[${seq.length} turns] lastTurns count == min(turns,20)`, async () => { const { sm } = await drive(seq, seedMor); expect(sm.lastTurns().length).toBe(Math.min(seq.length, 20)) })
  }
})

// ── 3) REQUIRED FLOWS through the canonical memory ──
describe('cutover: required flows through Memory Engine v2', () => {
  it('"כן" saves exactly once through memory', async () => { await drive(['תקבעי פגישה עם דני מחר בעשר', 'כן']); expect(daniCount()).toBe(1) })
  it('side question preserves the pending draft', async () => { const { st } = await drive(['תקבעי פגישה עם דני מחר בעשר', 'מה השעה']); expect(memoryFromState(st).hasPending()).toBe(true) })
  it('calendar search during create does not destroy the draft', async () => { const { st } = await drive(['תקבעי פגישה עם דני מחר בעשר', 'יש לי פגישה עם מור'], seedMor); expect(memoryFromState(st).hasPending()).toBe(true) })
  it('"למה לא קבעת?" explains the pending state from memory', async () => { const { results } = await drive(['תקבעי פגישה עם דני מחר בעשר', 'למה לא קבעת?']); expect(results[1]!.display).toMatch(/מחכה לאישור|עוד לא קבעתי/) })
  it('"תמשיכי" continues the exact next chunk from memory', () => { const e = createMemoryEngine(); e.rememberAssistantAnswer('א. ב. ג. ד.'); const a = e.resumeLastAnswer('continue'); const b = e.resumeLastAnswer('continue'); expect(a.chunk).not.toBe(b.chunk) })
  it('"לא שמעתי" repeats/resumes the correct chunk from memory', () => { const e = createMemoryEngine(); e.rememberAssistantAnswer('א. ב. ג. ד.'); const a = e.resumeLastAnswer('continue'); expect(e.resumeLastAnswer('repeat').chunk).toBe(a.chunk) })
  it('reconnect in the same session does not greet again', () => { const sm = new SessionMemory('same'); expect(sm.shouldGreet()).toBe(true); sm.markGreeted(); expect(sm.shouldGreet()).toBe(false) })
  it('family "איך בדיוק?" uses the last family pair from memory', async () => { const { sm, results } = await drive(['מה ארי עבור ירדן', 'איך בדיוק']); expect(sm.getLastFamilyPair()).not.toBeNull(); expect(results[1]!.display).toMatch(/עילי|מור|אופיר|דרך/) })
  it('online follow-up remembers the online result', async () => { const { sm } = await drive(['איזה משחקים יש היום']); expect(sm.engine.getLastToolResult()?.tool).toBe('online') })
})

// ── 4) COPY LAST 20: diagnostics buffer == canonical session memory ──
describe('cutover: Copy Last 20 reads the same canonical memory', () => {
  for (const seq of SEQUENCES) {
    it(`[${seq.length} turns] liveTurnDiagnostics mirrors SessionMemory`, async () => {
      const { sm } = await drive(seq, seedMor)
      const diag = lastTurns().map(t => t.input)
      const canon = sm.lastTurns().map(t => t.user)
      expect(diag).toEqual(canon)  // same inputs, same order → no drift
    })
  }
})

// ── 5) INSTANCE ISOLATION — no module-global live-memory leak (hard rule 5) ──
describe('cutover: separate instances never leak', () => {
  for (let i = 0; i < 30; i++) {
    it(`fresh SessionMemory carries no prior state (round ${i})`, () => {
      const a = new SessionMemory('a'); a.record('x', { intent: 'calendar_create', display: 'd', state: { createState: { phase: 'confirming', draft: { title: 'פגישה עם דני' } } } }); a.markGreeted()
      const b = new SessionMemory('b')
      expect(b.getPendingAction()).toBeNull(); expect(b.shouldGreet()).toBe(true); expect(b.writes()).toBe(0)
    })
  }
})

// ── 7) ACCESSOR PROJECTION — memoryFromState is an exact projection of the carrier ──
describe('cutover: memoryFromState projects the carrier exactly', () => {
  const mk = (phase: string, title: string | null, pair: { a: string; b: string } | null): RuntimeState =>
    ({ ...IDLE_RUNTIME, createState: { ...IDLE_RUNTIME.createState, phase: phase as never, draft: { ...IDLE_RUNTIME.createState.draft, title } }, lastFamilyPair: pair })
  const cases: Array<[string, string | null, { a: string; b: string } | null]> = [
    ['idle', null, null], ['confirming', 'פגישה עם דני', null], ['collecting', 'פגישה עם מור', null],
    ['confirming', 'פגישה עם אלון', { a: 'ארי', b: 'ירדן' }], ['idle', null, { a: 'לאו', b: 'אופיר' }],
    ['confirming', null, null], ['collecting', 'קפה עם רותי', { a: 'מור', b: 'לאו' }],
  ]
  for (let i = 0; i < 6; i++) for (const [phase, title, pair] of cases) {
    it(`projection (${phase},${title},${pair ? pair.a : '-'}) round ${i}`, () => {
      const v = memoryFromState(mk(phase, title, pair))
      expect(v.hasPending()).toBe(phase !== 'idle')
      expect(v.getPendingLabel()).toBe(phase !== 'idle' ? title : null)
      expect(v.getActiveGoal() ? v.getActiveGoal()!.kind : null).toBe(phase !== 'idle' ? 'calendar_create' : null)
      expect(v.getLastFamilyPair()).toEqual(pair)
    })
  }
})

// ── 8) MEMORY STRESS — randomized: goal survives, greeting ≤ 1, no leak ──
describe('cutover: memory stress invariants', () => {
  it('across 120 randomized conversations: pending survives non-cancel turns, greeting ≤ 1/session, no leak', async () => {
    const SIDES = ['מה השעה', 'מי זה נועם', 'ספרי לי בדיחה', 'לא שמעתי', 'את לא מבינה אותי', 'למה לא קבעת?', 'מה הסרטים בכפר סבא', 'יש לי פגישה עם מור', 'מה שלומך', 'בוקר טוב']
    const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000 }
    let prevEngineHadState = false
    for (let c = 0; c < 120; c++) {
      const r = rng(c + 1)
      saveAppointments([]); seedMor()
      const sm = new SessionMemory(`c${c}`)
      // fresh session must never inherit the previous session's memory (no leak)
      if (prevEngineHadState) { expect(sm.getPendingAction()).toBeNull(); expect(sm.shouldGreet()).toBe(true) }
      let st: RuntimeState = IDLE_RUNTIME
      // start a create, then random non-cancel side turns, then confirm
      const start = await ExecutiveCognitiveController.handleTurn(st, 'תקבעי פגישה עם דני מחר בעשר', { messages: [], now: NOW }, T); st = start.state; sm.record('c', asDecision(start))
      sm.markGreeted()
      const n = 1 + Math.floor(r() * 4)
      for (let i = 0; i < n; i++) {
        const side = SIDES[Math.floor(r() * SIDES.length)]!
        const rr = await ExecutiveCognitiveController.handleTurn(st, side, { messages: [], now: NOW }, T); st = rr.state; sm.record(side, asDecision(rr))
        expect(memoryFromState(st).hasPending()).toBe(true)  // goal never disappears on a side turn
        expect(sm.shouldGreet()).toBe(false)                 // greeting ≤ 1 per session
      }
      const yes = await ExecutiveCognitiveController.handleTurn(st, 'כן', { messages: [], now: NOW }, T); st = yes.state; sm.record('כן', asDecision(yes))
      expect(daniCount()).toBe(1)                            // completed exactly once
      expect(memoryFromState(st).hasPending()).toBe(false)   // cleared after completion
      prevEngineHadState = true
    }
  }, 120000)
})

// ── 6) CLEAR CORRECTNESS — clearing one action never clears unrelated memory ──
describe('cutover: clearing one pending action never clears unrelated session memory', () => {
  for (let i = 0; i < 15; i++) {
    it(`clearing pending keeps topic/tool/family memory (round ${i})`, () => {
      const e = createMemoryEngine()
      e.setPendingAction({ kind: 'calendar_create', phase: 'confirming', label: 'x' })
      e.rememberToolResult('online', 'משחק'); e.rememberAssistantAnswer('א. ב.')
      e.clearPendingAction('explicit_cancel')
      expect(e.getPendingAction()).toBeNull()
      expect(e.getLastToolResult()?.result).toBe('משחק')      // unrelated memory intact
      expect(e.resumeLastAnswer('continue').chunk).toBeTruthy()
    })
  }
})
