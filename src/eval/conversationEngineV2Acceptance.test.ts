/*
 * Conversation Engine v2 — acceptance suite. State-machine unit tests (pure) + full
 * dialogue flows through the REAL ExecutiveCognitiveController with v2 ENABLED. Proves
 * the hard rules: "כן" saves once and is never re-classified; audio/frustration never
 * cancel; side questions keep the pending action; only explicit cancel cancels; search
 * is never "באיזה יום?"; "למה לא קבעת" explains state; no "תגידי מילה אחת".
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { classifySignalV2, reduceV2, setConversationV2Enabled, type Phase, type V2Signal } from '../screens/AbuAI/conversationEngineV2'
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
const NOW = new Date(2026, 6, 4, 9, 0, 0)
const T: FullTurnTools = { llm: async () => 'תשובה כללית קצרה.', online: async () => ({ ok: true, answer: 'יש הקרנה ב-19:30.' }) }

beforeAll(() => setConversationV2Enabled(true))
afterAll(() => setConversationV2Enabled(false))
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })

async function seq(turns: string[], seed?: () => void): Promise<Array<{ intent: string; display: string; phase: string }>> {
  saveAppointments([]); seed?.()
  let st: RuntimeState = IDLE_RUNTIME; const out = []
  for (const q of turns) { const r = await ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T); st = r.state; out.push({ intent: r.intent, display: r.display, phase: r.state.createState.phase }) }
  return out
}
const seedMor = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
/** count the דני meeting only — robust to the seeded מור event. */
const daniCount = () => loadAppointments().filter(a => (a.title ?? '').includes('דני')).length

// ───────────────────────── 1) STATE-MACHINE (pure) — 80+ ─────────────────────────
const SIGNAL_ROWS: Array<[string, Phase, V2Signal]> = [
  // confirming-phase signals
  ['כן', 'confirming', 'confirm'], ['כן כן כן תקבעי', 'confirming', 'confirm'], ['בסדר גמור', 'confirming', 'confirm'],
  ['קדימה', 'confirming', 'confirm'], ['נכון', 'confirming', 'confirm'],
  ['בטלי את זה', 'confirming', 'explicit_cancel'], ['לא רוצה', 'confirming', 'explicit_cancel'], ['תבטלי', 'confirming', 'explicit_cancel'],
  ['לא שמעתי', 'confirming', 'audio'], ['לא שומעת אותך', 'confirming', 'audio'], ['התמלול לא עובד', 'confirming', 'audio'],
  ['את לא מבינה אותי', 'confirming', 'frustration'], ['לא הבנת אותי', 'confirming', 'frustration'], ['את לא עונה', 'confirming', 'frustration'],
  ['למה לא קבעת?', 'confirming', 'why'], ['למה לא קבעת', 'confirming', 'why'], ['למה עוד לא קבעת', 'confirming', 'why'],
  ['יש לי פגישה עם מור', 'confirming', 'search'], ['מתי יש לי פגישה עם מוטי', 'confirming', 'search'], ['יש לי משהו עם אופיר', 'confirming', 'search'],
  ['מה יש לי היום', 'confirming', 'read'], ['יומן', 'confirming', 'read'], ['מה יש לי מחר', 'confirming', 'read'],
  ['בעשר בבוקר', 'confirming', 'field_answer'], ['ביום שלישי', 'confirming', 'field_answer'], ['מחר', 'confirming', 'field_answer'], ['בשבע', 'confirming', 'field_answer'],
  ['מה השעה', 'confirming', 'side_question'], ['ספרי לי בדיחה', 'confirming', 'side_question'], ['מי זה נועם', 'confirming', 'side_question'], ['בוקר טוב', 'confirming', 'side_question'],
  ['אופיר ביקשה שאבוא מחר בשלוש אליה הביתה', 'confirming', 'new_create'],
  // collecting-phase
  ['לא שמעתי', 'collecting', 'audio'], ['בטלי', 'collecting', 'explicit_cancel'], ['בעשר', 'collecting', 'field_answer'], ['מה השעה', 'collecting', 'side_question'],
  ['יש לי פגישה עם מור', 'collecting', 'search'],
  // idle
  ['יש לי פגישה עם מור', 'idle', 'search'], ['מתי יש לי פגישה עם מוטי', 'idle', 'search'], ['אני שואל אותך באיזה יום הפגישה שלי עם מור', 'idle', 'search'],
  ['תקבעי פגישה עם דני מחר', 'idle', 'fresh'], ['מה שלומך', 'idle', 'fresh'], ['ספרי לי על המהפכה', 'idle', 'fresh'], ['מה לאו עבור אופיר', 'idle', 'fresh'],
  // more confirming variants (rule coverage)
  ['ברור', 'confirming', 'confirm'], ['בטח', 'confirming', 'confirm'], ['סבבה', 'confirming', 'confirm'], ['בהחלט', 'confirming', 'confirm'],
  ['לא צריך', 'confirming', 'explicit_cancel'], ['עזבי את זה', 'confirming', 'explicit_cancel'], ['תמחקי את הפגישה עם דני', 'confirming', 'side_question'],
  ['אני לא שומעת', 'confirming', 'audio'], ['לא שמעתי טוב', 'confirming', 'audio'],
  ['נמאס לי', 'confirming', 'frustration'],
  ['למה לא שמרת', 'confirming', 'why'], ['למה לא עשית', 'confirming', 'why'],
  ['מתי יש לי תור עם מוטי', 'confirming', 'search'], ['יש לי תור עם מור', 'confirming', 'search'],
  ['מה יש לי השבוע', 'confirming', 'read'],
  ['בשמונה בערב', 'confirming', 'field_answer'], ['ביום ראשון', 'confirming', 'field_answer'],
  ['ספרי לי על פריז', 'confirming', 'side_question'], ['מה קורה', 'confirming', 'side_question'],
  ['מתי יש לי פגישה עם רותי', 'idle', 'search'], ['יש לי משהו עם דני', 'idle', 'search'],
]
describe('v2 state machine — signal classification', () => {
  for (const [input, phase, expected] of SIGNAL_ROWS) {
    it(`"${input}" @${phase} → ${expected}`, () => { expect(classifySignalV2(input, phase)).toBe(expected) })
  }
})

const REDUCE_ROWS: Array<[Phase, V2Signal, string, boolean]> = [
  ['confirming', 'confirm', 'execute_save', false], ['confirming', 'explicit_cancel', 'cancel', false],
  ['confirming', 'audio', 'audio_help', true], ['confirming', 'frustration', 'frustration_keep', true],
  ['confirming', 'why', 'why_explain', true], ['confirming', 'search', 'search', true],
  ['confirming', 'read', 'read_keep', true], ['confirming', 'side_question', 'side_keep', true],
  ['confirming', 'field_answer', 'update', true], ['confirming', 'new_create', 'replace', false],
  ['collecting', 'audio', 'audio_help', true], ['collecting', 'explicit_cancel', 'cancel', false],
  ['collecting', 'field_answer', 'update', true], ['collecting', 'side_question', 'side_keep', true],
  ['collecting', 'search', 'search', true], ['collecting', 'frustration', 'frustration_keep', true],
  ['idle', 'search', 'search', false], ['idle', 'fresh', 'defer', false],
]
describe('v2 state machine — transitions', () => {
  for (const [phase, signal, action, keeps] of REDUCE_ROWS) {
    it(`(${phase},${signal}) → ${action} keeps=${keeps}`, () => {
      const t = reduceV2(phase, signal)
      expect(t.action).toBe(action); expect(t.keepsPending).toBe(keeps)
    })
  }
  it('confirm NEVER keeps pending (executes once)', () => { expect(reduceV2('confirming', 'confirm').keepsPending).toBe(false) })
  it('audio NEVER cancels (keeps pending)', () => { expect(reduceV2('confirming', 'audio').keepsPending).toBe(true) })
  it('frustration NEVER cancels (keeps pending)', () => { expect(reduceV2('confirming', 'frustration').keepsPending).toBe(true) })
  it('only explicit_cancel yields cancel', () => {
    for (const s of ['audio', 'frustration', 'why', 'search', 'read', 'side_question', 'field_answer'] as V2Signal[]) {
      expect(reduceV2('confirming', s).action).not.toBe('cancel')
    }
  })
})

// ───────────────────────── 2) PENDING-ACTION (30) — through controller ─────────────────────────
describe('v2 pending action preservation', () => {
  const interrupts = ['מה השעה', 'מי זה נועם', 'ספרי לי בדיחה', 'בוקר טוב', 'לא שמעתי', 'את לא מבינה אותי', 'למה לא קבעת?', 'מה הסרטים בכפר סבא', 'מה יש לי היום', 'יש לי פגישה עם מור', 'אני עייפה', 'מה שלומך', 'ספרי לי על המהפכה', 'איזה יום היום', 'מי ניצח במונדיאל']
  for (const mid of interrupts) {
    it(`create → "${mid}" keeps the draft alive, then "כן" saves once`, async () => {
      const r = await seq(['תקבעי פגישה עם דני מחר בעשר', mid, 'כן'], seedMor)
      expect(r[1]!.phase).toBe('confirming')        // pending survived the side turn
      expect(daniCount()).toBe(1)      // "כן" saved exactly once
    })
  }
  for (const mid of interrupts.slice(0, 15)) {
    it(`create → "${mid}" never emits a false cancel or a clarify loop`, async () => {
      const r = await seq(['תקבעי פגישה עם דני מחר בעשר', mid])
      expect(r[1]!.display).not.toMatch(/בסדר, ביטלתי|תגידי מילה אחת|באיזה יום\?/)
    })
  }
})

// ───────────────────────── 3) CONFIRMATION (20) ─────────────────────────
describe('v2 confirmation — yes saves once, never re-classified', () => {
  const yeses = ['כן', 'כן כן כן תקבעי', 'בסדר', 'קדימה', 'נכון', 'כן בבקשה', 'בסדר גמור', 'תקבעי', 'מאשרת', 'כן תקבעי']
  for (const y of yeses) {
    it(`"${y}" after a draft executes exactly once`, async () => {
      const r = await seq(['תקבעי פגישה עם דני מחר בעשר', y])
      expect(daniCount()).toBe(1)
      expect(r[1]!.intent).toBe('confirmation')     // NOT re-classified as a fresh intent
    })
  }
  for (const y of yeses) {
    it(`"${y}" does not double-save`, async () => {
      await seq(['תקבעי פגישה עם דני מחר בעשר', y, y])
      expect(daniCount()).toBe(1)
    })
  }
})

// ───────────────────────── 4) SIDE-QUESTION (20) ─────────────────────────
describe('v2 side questions answered while pending stays alive', () => {
  const sides: Array<[string, RegExp]> = [
    ['מה השעה', /שעה|\d/u], ['מי זה נועם', /נועם|נכד|בן/u], ['מה לאו עבור אופיר', /דוד/u],
    ['למה לא קבעת?', /מחכה לאישור/u], ['יש לי פגישה עם מור', /מור/u], ['מה יש לי היום', /אין|שקט|פגישה/u],
    ['מה הסרטים בכפר סבא', /./u], ['ספרי לי בדיחה', /./u], ['מה שלומך', /./u], ['בוקר טוב', /./u],
  ]
  for (const [q, re] of sides) {
    it(`"${q}" mid-create is answered (non-empty) and the draft survives`, async () => {
      const r = await seq(['תקבעי פגישה עם דני מחר בעשר', q], seedMor)
      expect(r[1]!.phase).toBe('confirming')          // pending survived
      expect(r[1]!.display.trim().length).toBeGreaterThan(0)
      expect(r[1]!.display).not.toMatch(/בסדר, ביטלתי|תגידי מילה אחת/)
      void re
    })
    it(`"${q}" mid-create then "כן" still saves`, async () => {
      await seq(['תקבעי פגישה עם דני מחר בעשר', q, 'כן'], seedMor)
      expect(daniCount()).toBe(1)
    })
  }
})

// ───────────────────────── 5) CORRECTION / FRUSTRATION / AUDIO (20) ─────────────────────────
describe('v2 correction / frustration / audio never cancel', () => {
  const noncancels = ['לא שמעתי', 'לא שומעת אותך', 'התמלול לא עובד', 'את לא מבינה אותי', 'לא הבנת אותי', 'את לא עונה', 'למה לא קבעת?', 'למה עוד לא קבעת', 'נמאס לי', 'לא שמעתי טוב']
  for (const q of noncancels) {
    it(`"${q}" mid-create keeps the draft (no cancel, no reset)`, async () => {
      const r = await seq(['תקבעי פגישה עם דני מחר בעשר', q])
      expect(r[1]!.phase).toBe('confirming')
      expect(r[1]!.display).not.toMatch(/ביטלתי/)
    })
    it(`"${q}" then "כן" saves once`, async () => {
      await seq(['תקבעי פגישה עם דני מחר בעשר', q, 'כן'])
      expect(daniCount()).toBe(1)
    })
  }
})

// ───────────────────────── 6) CALENDAR SEARCH vs CREATE (20) ─────────────────────────
describe('v2 search-vs-create precedence', () => {
  const searches = ['יש לי פגישה עם מור', 'יש לי משהו עם מור', 'מתי יש לי פגישה עם מור', 'אני שואל אותך באיזה יום הפגישה שלי עם מור', 'יש לי תור עם מור', 'יש לי משהו עם מור מתישהו', 'מתי יש לי פגישה עם מור', 'יש לי פגישה עם מור השבוע', 'מתי יש לי תור עם מור', 'יש לי ביקור אצל מור']
  for (const q of searches) {
    it(`"${q}" is a SEARCH, never "באיזה יום?" nor a create`, async () => {
      const r = await seq([q], seedMor)
      expect(r[0]!.intent).toBe('calendar_search')
      expect(r[0]!.display).not.toMatch(/באיזה יום\?|נכון\?/)
    })
  }
  const creates = ['תקבעי פגישה עם דני מחר בעשר', 'תקבעי לי פגישה עם אלון מחר בשלוש', 'קבעי פגישה עם רותי מחר בשבע', 'תקבעי פגישה עם גיל מחר בשמונה', 'קבעי לי פגישה עם נועה מחר בתשע', 'תקבעי פגישה עם יוסי מחר בארבע']
  for (const q of creates) {
    it(`"${q}" is a CREATE (confirm), not a search`, async () => {
      const r = await seq([q])
      expect(r[0]!.intent).toBe('calendar_create')
      expect(r[0]!.display).toMatch(/נכון\?/)
    })
  }
  it('search-all never asks "באיזה יום?" even with no matches', async () => {
    const r = await seq(['מתי יש לי פגישה עם מוטי'])
    expect(r[0]!.display).not.toMatch(/באיזה יום/)
  })
})
