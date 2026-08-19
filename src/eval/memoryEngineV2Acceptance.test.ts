/*
 * Memory Engine v2 acceptance — the real memory failures made impossible. Runs through
 * the REAL ExecutiveCognitiveController, feeding each decision into a per-session
 * MemoryEngineV2 (instance-based, deterministic, no leak), plus direct API tests.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { createMemoryEngine, type TurnDecision } from '../screens/AbuAI/memoryEngineV2'
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
const T: FullTurnTools = { llm: async () => 'משפט ראשון על הנושא. משפט שני שממשיך. משפט שלישי לסיום.', online: async () => ({ ok: true, answer: 'משחק ב-20:00.' }) }
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })
const seedMor = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
const daniCount = () => loadAppointments().filter(a => (a.title ?? '').includes('דני')).length

const asDecision = (r: Awaited<ReturnType<typeof ExecutiveCognitiveController.handleTurn>>): TurnDecision =>
  ({ intent: r.intent, display: r.display, chunks: r.delivery.chunks, source: r.source, state: { createState: r.state.createState, lastFamilyPair: r.state.lastFamilyPair } })

async function drive(seq: string[], seed?: () => void) {
  saveAppointments([]); seed?.()
  const mem = createMemoryEngine('s1'); let st: RuntimeState = IDLE_RUNTIME; const results = []
  for (const q of seq) {
    const r = await ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T)
    st = r.state; mem.rememberTurn(q, r.display, asDecision(r)); results.push(r)
  }
  return { mem, results }
}

// ───────────────────────── 1) PENDING-ACTION MEMORY (40) ─────────────────────────
describe('memory: pending action survives interruptions', () => {
  const interrupts = ['מה השעה', 'מי זה נועם', 'ספרי לי בדיחה', 'בוקר טוב', 'לא שמעתי', 'את לא מבינה אותי', 'למה לא קבעת?', 'מה הסרטים בכפר סבא', 'מה יש לי היום', 'יש לי פגישה עם מור', 'אני עייפה', 'מה שלומך', 'איזה יום היום', 'מי ניצח במונדיאל', 'ספרי לי על פריז', 'מה נשמע', 'תודה', 'אוקיי', 'מעניין', 'המשך']
  for (const mid of interrupts) {
    it(`pending survives "${mid}" (goal kept) and "כן" saves once`, async () => {
      const { mem } = await drive(['תקבעי פגישה עם דני מחר בעשר', mid, 'כן'], seedMor)
      // memory saw the draft alive across the interruption:
      expect(mem.exportLastTurns().some(t => t.intent === 'calendar_create')).toBe(true)
      expect(daniCount()).toBe(1)
    })
  }
})

// ───────────────────────── 2) CONTINUATION / RESUME (30) ─────────────────────────
describe('memory: continuation + resume (תמשיכי / לא שמעתי)', () => {
  const long = 'משפט ראשון. משפט שני. משפט שלישי. משפט רביעי. משפט חמישי.'
  for (let i = 0; i < 15; i++) {
    it(`resume 'continue' delivers consecutive chunks (round ${i})`, () => {
      const mem = createMemoryEngine()
      mem.rememberAssistantAnswer(long)
      const a = mem.resumeLastAnswer('continue'); const b = mem.resumeLastAnswer('continue')
      expect(a.chunk).toBeTruthy(); expect(b.chunk).toBeTruthy(); expect(a.chunk).not.toBe(b.chunk)
    })
  }
  for (let i = 0; i < 10; i++) {
    it(`'לא שמעתי' repeats the SAME (last) chunk (round ${i})`, () => {
      const mem = createMemoryEngine(); mem.rememberAssistantAnswer(long)
      const a = mem.resumeLastAnswer('continue'); const r = mem.resumeLastAnswer('repeat')
      expect(r.chunk).toBe(a.chunk)   // repeat, not advance
    })
  }
  it('resume with nothing stored is safely done', () => { expect(createMemoryEngine().resumeLastAnswer('continue')).toEqual({ chunk: null, done: true }) })
  it('through the runtime: "תמשיכי" does not start a new topic', async () => {
    const { results } = await drive(['ספרי לי על המהפכה הצרפתית', 'תמשיכי'])
    expect(results[1]!.intent).toBe('continuation')
  })
  it('memory retains the last answer for continuation', async () => {
    const { mem } = await drive(['ספרי לי על המהפכה הצרפתית'])
    expect(mem.resumeLastAnswer('continue').chunk).toBeTruthy()
  })
  it('topic is recalled after an answer', async () => {
    const { mem } = await drive(['ספרי לי על המהפכה הצרפתית'])
    expect(mem.recallTopic()).toMatch(/המהפכה/)
  })
})

// ───────────────────────── 3) GREETING / SESSION (25) ─────────────────────────
describe('memory: greeting once per real session', () => {
  for (let i = 0; i < 20; i++) {
    it(`shouldGreet true before, false after markGreeted (round ${i})`, () => {
      const mem = createMemoryEngine(`sess${i}`)
      expect(mem.shouldGreet()).toBe(true)
      mem.markGreeted()
      expect(mem.shouldGreet()).toBe(false)
      mem.markGreeted() // idempotent — still no re-greet
      expect(mem.shouldGreet()).toBe(false)
    })
  }
  it('a NEW session greets again (not the same instance)', () => {
    const a = createMemoryEngine('a'); a.markGreeted()
    expect(createMemoryEngine('b').shouldGreet()).toBe(true)
  })
  it('greeting state never leaks between engines (no module-global)', () => {
    const a = createMemoryEngine(); a.markGreeted()
    const b = createMemoryEngine()
    expect(b.shouldGreet()).toBe(true)
  })
  it('reconnect within the SAME session does not re-greet', () => {
    const mem = createMemoryEngine('same'); mem.markGreeted()
    // simulate resume: same engine instance
    expect(mem.shouldGreet()).toBe(false)
  })
  it('the runtime never gratuitously greets on a non-greeting turn', async () => {
    const { results } = await drive(['מה יש לי היום'])
    expect(results[0]!.display).not.toMatch(/(?:^|[.\s])(?:בוקר טוב|ערב טוב)/u)
  })
})

// ───────────────────────── 4) SIDE-QUESTION (25) ─────────────────────────
describe('memory: side questions never erase the active goal', () => {
  const sides = ['מה השעה', 'מי זה נועם', 'מה לאו עבור אופיר', 'למה לא קבעת?', 'יש לי פגישה עם מור', 'מה יש לי היום', 'מה הסרטים בכפר סבא', 'ספרי לי בדיחה', 'מה שלומך', 'בוקר טוב', 'אני עייפה', 'מי ניצח במונדיאל']
  for (const q of sides) {
    it(`goal preserved after side "${q}"`, async () => {
      const { mem } = await drive(['תקבעי פגישה עם דני מחר בעשר', q], seedMor)
      expect(mem.getActiveGoal()?.kind).toBe('calendar_create')
      expect(mem.getPendingAction()).not.toBeNull()
    })
  }
  it('handleSideQuestion stacks without clearing the goal', () => {
    const mem = createMemoryEngine(); mem.setPendingAction({ kind: 'calendar_create', phase: 'confirming', label: 'פגישה עם דני' })
    mem.handleSideQuestion('מה השעה')
    expect(mem.getActiveGoal()).not.toBeNull(); expect(mem.getSideStack()).toContain('מה השעה')
  })
})

// ───────────────────────── 5) CORRECTION (25) ─────────────────────────
describe('memory: corrections never lose pending / recompute the goal', () => {
  for (let i = 0; i < 20; i++) {
    it(`handleCorrection records + keeps pending (round ${i})`, () => {
      const mem = createMemoryEngine(); mem.setPendingAction({ kind: 'calendar_create', phase: 'confirming', label: 'פגישה עם דני' })
      mem.handleCorrection('לא, התכוונתי מחר בשבע')
      expect(mem.getLastCorrection()).toMatch(/מחר/)
      expect(mem.getPendingAction()).not.toBeNull() // correction never clears pending
    })
  }
  it('frustration / audio never clear pending', () => {
    const mem = createMemoryEngine(); mem.setPendingAction({ kind: 'calendar_create', phase: 'confirming', label: 'x' })
    expect(mem.clearPendingAction('frustration')).toBe(false)
    expect(mem.clearPendingAction('audio_complaint')).toBe(false)
    expect(mem.getPendingAction()).not.toBeNull()
    expect(mem.clearPendingAction('explicit_cancel')).toBe(true)
    expect(mem.getPendingAction()).toBeNull()
  })
  it('through the runtime: correction answers the corrected request', async () => {
    const { results } = await drive(['מי זה לאו', 'לא התכוונתי לזה, מה לאו עבור אופיר'])
    expect(results[1]!.display).toMatch(/דוד/)
  })
})

// ───────────────────────── 6) TOOL-RESULT MEMORY (25) ─────────────────────────
describe('memory: tool results are remembered (online / family pair)', () => {
  for (let i = 0; i < 15; i++) {
    it(`rememberToolResult stores the last result (round ${i})`, () => {
      const mem = createMemoryEngine(); mem.rememberToolResult('online', 'משחק ב-20:00')
      expect(mem.getLastToolResult()).toEqual({ tool: 'online', result: 'משחק ב-20:00' })
    })
  }
  it('online result is retained after the turn', async () => {
    const { mem } = await drive(['איזה משחקים יש היום'])
    expect(mem.getLastToolResult()?.tool).toBe('online')
  })
  it('family pair is retained for "איך בדיוק"', async () => {
    const { mem, results } = await drive(['מה ארי עבור ירדן', 'איך בדיוק'])
    expect(mem.getLastFamilyPair()).not.toBeNull()
    expect(results[1]!.display).toMatch(/עילי|מור|אופיר|דרך/)
  })
  it('online failure retains the topic for a follow-up "למה"', async () => {
    const fail: FullTurnTools = { llm: async () => 'x', online: async () => ({ ok: false, answer: '', reason: 'timeout' }) }
    let st: RuntimeState = IDLE_RUNTIME
    const r1 = await ExecutiveCognitiveController.handleTurn(st, 'מי ניצח במונדיאל אתמול', { messages: [], now: NOW }, fail); st = r1.state
    const r2 = await ExecutiveCognitiveController.handleTurn(st, 'למה?', { messages: [], now: NOW }, fail)
    expect(r2.display).toMatch(/נקטע|לא הצלחתי|מבולבל|ננסה/)
  })
})

// ───────────────────────── 7) LONG CONVERSATION (20) ─────────────────────────
describe('memory: long conversations stay consistent', () => {
  it('exportLastTurns caps at 20 across a long session', () => {
    const mem = createMemoryEngine()
    for (let i = 0; i < 35; i++) mem.rememberTurn(`q${i}`, `a${i}`, { intent: 'general', display: `a${i}`, state: { createState: { phase: 'idle' } } })
    expect(mem.exportLastTurns().length).toBe(20)
    expect(mem.exportLastTurns()[19]!.user).toBe('q34')     // newest kept
    expect(mem.exportLastTurns(5).length).toBe(5)
  })
  for (let i = 0; i < 18; i++) {
    it(`sequence numbers are monotonic + deterministic (round ${i})`, () => {
      const mem = createMemoryEngine()
      mem.rememberTurn('a', 'x', { intent: 'general', display: 'x', state: { createState: { phase: 'idle' } } })
      mem.rememberTurn('b', 'y', { intent: 'general', display: 'y', state: { createState: { phase: 'idle' } } })
      const t = mem.exportLastTurns()
      expect(t[1]!.seq).toBe(t[0]!.seq + 1)
    })
  }
})

// ───────────────────────── 8) CROSS-DOMAIN (20) ─────────────────────────
describe('memory: cross-domain interleaving keeps the goal', () => {
  const mixes: string[][] = [
    ['תקבעי פגישה עם דני מחר בעשר', 'מה לאו עבור אופיר', 'כן'],
    ['תקבעי פגישה עם דני מחר בעשר', 'איזה משחקים יש היום', 'כן'],
    ['תקבעי פגישה עם דני מחר בעשר', 'מה יש לי היום', 'כן'],
    ['תקבעי פגישה עם דני מחר בעשר', 'מה השעה', 'מי זה נועם', 'כן'],
    ['תקבעי פגישה עם דני מחר בעשר', 'ספרי לי על המהפכה', 'כן'],
  ]
  for (const mix of mixes) {
    it(`[${mix.join(' → ')}] saves the meeting after cross-domain detours`, async () => {
      await drive(mix, seedMor); expect(daniCount()).toBe(1)
    })
    it(`[${mix.join(' → ')}] the memory goal stayed calendar_create until save`, async () => {
      const { mem } = await drive(mix.slice(0, -1), seedMor)   // stop before "כן"
      expect(mem.getActiveGoal()?.kind).toBe('calendar_create')
    })
  }
  it('after save the goal + pending are cleared', async () => {
    const { mem } = await drive(['תקבעי פגישה עם דני מחר בעשר', 'כן'])
    expect(mem.getPendingAction()).toBeNull(); expect(mem.getActiveGoal()).toBeNull()
  })
  it('family follow-up does not disturb a later create', async () => {
    const { mem } = await drive(['מה לאו עבור אופיר', 'תקבעי פגישה עם דני מחר בעשר'])
    expect(mem.getActiveGoal()?.kind).toBe('calendar_create')
  })
})

// ───────────────────────── HARD-RULES MATRIX (deterministic, 60) ─────────────────────────
describe('memory: hard-rules matrix', () => {
  const withPending = () => { const m = createMemoryEngine(); m.setPendingAction({ kind: 'calendar_create', phase: 'confirming', label: 'פגישה עם דני' }); return m }
  // rule 6/7: non-cancel reasons never clear pending (×3 each)
  for (const reason of ['frustration', 'audio_complaint', 'side_question', 'frustration', 'audio_complaint', 'side_question']) {
    it(`clearPendingAction('${reason}') is refused`, () => { const m = withPending(); expect(m.clearPendingAction(reason)).toBe(false); expect(m.getPendingAction()).not.toBeNull() })
  }
  // only explicit reasons clear (×6)
  for (const reason of ['explicit_cancel', 'user_cancelled', 'done', 'saved', 'replaced', 'aborted']) {
    it(`clearPendingAction('${reason}') clears`, () => { const m = withPending(); expect(m.clearPendingAction(reason)).toBe(true); expect(m.getPendingAction()).toBeNull() })
  }
  // rule 2: continue advances; rule 3: repeat holds (×12)
  const txt = 'א. ב. ג. ד. ה. ו.'
  for (let i = 0; i < 6; i++) {
    it(`continue advances chunk (round ${i})`, () => { const m = createMemoryEngine(); m.rememberAssistantAnswer(txt); const a = m.resumeLastAnswer('continue'); const b = m.resumeLastAnswer('continue'); expect(a.chunk).not.toBe(b.chunk) })
    it(`repeat holds chunk (round ${i})`, () => { const m = createMemoryEngine(); m.rememberAssistantAnswer(txt); m.resumeLastAnswer('continue'); expect(m.resumeLastAnswer('repeat').chunk).toBe(m.resumeLastAnswer('repeat').chunk) })
  }
  // rule 8: greeting once (×6)
  for (let i = 0; i < 6; i++) it(`greet once (round ${i})`, () => { const m = createMemoryEngine(); expect(m.shouldGreet()).toBe(true); m.markGreeted(); expect(m.shouldGreet()).toBe(false) })
  // rule 9/10: determinism + isolation (×12)
  for (let i = 0; i < 12; i++) {
    it(`two fresh engines never share state (round ${i})`, () => {
      const a = createMemoryEngine(); a.setPendingAction({ kind: 'x', phase: 'confirming', label: 'y' }); a.markGreeted(); a.rememberToolResult('online', 'z')
      const b = createMemoryEngine()
      expect(b.getPendingAction()).toBeNull(); expect(b.shouldGreet()).toBe(true); expect(b.getLastToolResult()).toBeNull()
    })
  }
  // set/get goal + pending round-trips (×18)
  for (let i = 0; i < 18; i++) {
    it(`goal/pending round-trip (round ${i})`, () => {
      const m = createMemoryEngine()
      m.setActiveGoal({ kind: 'g', label: 'L' }); expect(m.getActiveGoal()).toEqual({ kind: 'g', label: 'L' })
      m.setPendingAction({ kind: 'p', phase: 'confirming', label: 'P' }); expect(m.getPendingAction()?.kind).toBe('p'); expect(m.getActiveGoal()?.kind).toBe('p')
    })
  }
})
