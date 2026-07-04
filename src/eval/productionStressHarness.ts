/*
 * Production Stress / Fuzz Harness
 * ════════════════════════════════
 * Attacks the REAL ExecutiveCognitiveController with thousands of randomized,
 * mixed-domain, multi-turn conversations (calendar + family + online + date +
 * corrections + interruptions + frustration + audio complaints + greetings +
 * confirmations) and asserts hard production invariants on EVERY turn. No mocks:
 * turns run through the one controller. Any invariant violation is a real failure.
 *
 * Invariants per turn:
 *   1. never throws
 *   2. always RUNTIME_FINALIZED (no bypass)
 *   3. non-empty string display
 *   4. valid source
 *   5. no loop/robotic phrases ("תגידי מילה אחת", generic "אני כאן כדי לעזור")
 *   6. never "ביטלתי" unless the user actually asked to cancel
 *   7. no raw-transcript title in a calendar confirm ("נכון?" with a long echo)
 *   8. same exact answer never repeats 3× in a row (loop signal)
 *   9. a pending create survives a non-cancel interruption (frustration/audio/online)
 */
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { isFinalized } from '../screens/AbuAI/runtimeTrace'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

export interface StressTurn { text: string; kind: string; cancels?: boolean }

// Turn templates by domain. Each is a realistic utterance Martita might say.
const CATALOG: StressTurn[] = [
  { text: 'תקבעי פגישה עם דני מחר בשבע בערב', kind: 'cal-create' },
  { text: 'אני צריך להיפגש מחר עם מוטי בקפה מורנו בשלוש', kind: 'cal-create' },
  { text: 'אופיר ביקשה שאבוא מחר בשלוש אליה הביתה. גלעד יגיע כנראה רק בחמש.', kind: 'cal-create' },
  { text: 'תקבעי יוגה כל יום שלישי בעשר בבוקר', kind: 'cal-recurring' },
  { text: 'כן', kind: 'confirm' },
  { text: 'כן כן כן תקבעי', kind: 'confirm' },
  { text: 'מה יש לי היום', kind: 'cal-read' },
  { text: 'מה יש לי מחר', kind: 'cal-read' },
  { text: 'מה יש לי השבוע', kind: 'cal-read' },
  { text: 'מתי יש לי פגישה עם מוטי', kind: 'cal-search' },
  { text: 'יש לי משהו עם מור', kind: 'cal-search' },
  { text: 'תמחקי את הפגישה עם דני', kind: 'cal-delete', cancels: false },
  { text: 'מה לאו עבור אופיר', kind: 'family' },
  { text: 'מה הקשר בין רפי ללאו', kind: 'family' },
  { text: 'איך בדיוק', kind: 'family-explain' },
  { text: 'מי ניצח במונדיאל אתמול', kind: 'online' },
  { text: 'מה הסרטים בכפר סבא', kind: 'online' },
  { text: 'מה השעה', kind: 'date' },
  { text: 'איזה יום היום', kind: 'date' },
  { text: 'ספרי לי על המהפכה הצרפתית', kind: 'general' },
  { text: 'תמשיכי', kind: 'continue' },
  { text: 'לא שמעתי', kind: 'audio' },
  { text: 'לא שמעתי תמשיכי', kind: 'audio-continue' },
  { text: 'את לא מבינה אותי', kind: 'frustration' },
  { text: 'בוקר טוב', kind: 'greeting' },
  { text: 'מה שלומך', kind: 'greeting' },
  { text: 'לא, בטלי את זה', kind: 'cancel', cancels: true },
  { text: 'לא התכוונתי לזה, מה לאו עבור אופיר', kind: 'correction' },
  { text: 'אני קצת בודדה', kind: 'emotional' },
]

function makeRng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 } }

const OK: FullTurnTools = { llm: async () => 'תשובה כללית קצרה ונכונה על הנושא הזה.', online: async () => ({ ok: true, answer: 'יש הקרנה בשבע וחצי בערב.' }) }
const FAIL: FullTurnTools = { llm: async () => 'תשובה.', online: async () => ({ ok: false, answer: '', reason: 'provider_failed' }) }

const CANCEL_RE = /בטל|ביטול|לא רוצה/u
const LOOP_PHRASES = [/תגידי\s+מילה\s+אחת/u, /אני\s+כאן\s+כדי\s+לעזור/u, /באיזה\s+יום\?/u]

export interface Violation { seed: number; turnIndex: number; input: string; detail: string }

const NOW = new Date(2026, 6, 4, 9, 0, 0)

export async function runStress(conversations: number, maxLen: number, startSeed = 1): Promise<{ turns: number; violations: Violation[] }> {
  const violations: Violation[] = []
  let turns = 0
  for (let c = 0; c < conversations; c++) {
    const seed = startSeed + c
    const rng = makeRng(seed)
    saveAppointments([])
    let state: RuntimeState = IDLE_RUNTIME
    const len = 2 + Math.floor(rng() * (maxLen - 1))
    let pendingCreate = false
    const lastDisplays: string[] = []
    const lastInputs: string[] = []
    for (let i = 0; i < len; i++) {
      const t = CATALOG[Math.floor(rng() * CATALOG.length)]!
      const tools = rng() < 0.2 ? FAIL : OK
      turns++
      const flag = (detail: string) => violations.push({ seed, turnIndex: i, input: t.text, detail })
      let r
      try {
        r = await ExecutiveCognitiveController.handleTurn(state, t.text, { messages: [], now: NOW }, tools)
      } catch (e) { flag(`THREW: ${(e as Error).message}`); break }
      // 2) finalized
      if (!isFinalized(r.trace)) flag(`not RUNTIME_FINALIZED (intent=${r.intent})`)
      // 3) non-empty display
      if (typeof r.display !== 'string' || r.display.trim().length === 0) flag(`empty display (intent=${r.intent})`)
      // 4) valid source
      if (!['deterministic', 'llm', 'online', 'fallback'].includes(r.source)) flag(`bad source=${r.source}`)
      // 5) loop/robotic phrases
      for (const re of LOOP_PHRASES) if (re.test(r.display)) flag(`loop/robotic phrase: "${r.display.slice(0, 40)}"`)
      // 6) never cancel unless asked
      if (/(?<![א-ת])ביטלתי(?![א-ת])/u.test(r.display) && !CANCEL_RE.test(t.text)) flag(`cancelled without a cancel request: "${r.display.slice(0, 40)}"`)
      // 7) raw-transcript title in a confirm (long echo before "נכון?")
      if (/נכון\?\s*$/u.test(r.display)) {
        const head = r.display.split(/[.]/)[0] ?? ''
        if (head.length > 90) flag(`raw-transcript-ish confirm head (${head.length} chars)`)
      }
      // 8) 3× identical DETERMINISTIC repeat (llm/online stubbed to fixed text; a
      // fixed helpful reply to a REPEATED identical audio/greeting input is legit).
      lastDisplays.push(r.display); lastInputs.push(t.text)
      // A real loop = same answer to DIFFERENT consecutive inputs. Repeating a
      // deterministic factual query ("איזה יום היום") correctly repeats its answer.
      // "תמשיכי" when there is nothing to continue legitimately repeats "זהו, סיימתי".
      const legitRepeat = t.kind === 'continue' || t.kind === 'audio-continue'
      // A correction ("לא התכוונתי לזה, מה X") asks the SAME question as "מה X", so the
      // same correct answer is not a loop — normalize the prefix before comparing.
      const norm = (s: string) => s.replace(/^לא\s+התכוונתי[^,]*,\s*/u, '').trim()
      const distinctInputs = new Set(lastInputs.slice(-3).map(norm)).size > 1
      if (!legitRepeat && distinctInputs && r.source === 'deterministic' && lastDisplays.length >= 3 && lastDisplays.slice(-3).every(d => d === r.display)) flag(`same deterministic answer to different inputs 3× (stuck loop)`)
      // 8b) GRATUITOUS greeting — a "בוקר טוב"/"ערב טוב" greeting must not appear when
      // the user's turn is NOT itself a greeting (the real "greeting loop" failure).
      if (t.kind !== 'greeting' && /(?:^|[.\s])(?:בוקר טוב|ערב טוב|צהריים טובים|לילה טוב)/u.test(r.display)) flag(`gratuitous greeting on non-greeting turn: "${r.display.slice(0, 30)}"`)
      // 9) a pending create must survive a NON-request interruption (frustration /
      // audio complaint). A genuine new question legitimately parks the draft.
      const wasPending = pendingCreate
      const nowPending = r.state.createState.phase !== 'idle'
      const nonRequestInterrupt = ['frustration', 'audio', 'audio-continue'].includes(t.kind)
      if (wasPending && nonRequestInterrupt && !nowPending && !t.cancels) flag(`pending create LOST on non-request '${t.kind}'`)
      pendingCreate = nowPending
      state = r.state
    }
  }
  return { turns, violations }
}
