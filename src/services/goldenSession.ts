/*
 * goldenSession.ts — THE GOLDEN SESSION: one scripted end-to-end conversation, from greeting to
 * goodbye, that defines what a CORRECT Abu session looks like. This is the artifact the repo lacked
 * (13k fragment tests, zero whole-conversation tests), so every fix risked breaking something unseen
 * until the owner opened his phone. (Overnight Part 1.)
 * ════════════════════════════════════════════════════════════════════════════
 * TWO layers consume this ONE spec, so they can never drift:
 *   • goldenSession.test.ts (DETERMINISTIC, every build) — proves the per-turn CONTRACT detectors
 *     work and locks the wiring. Blocks the build. Cannot judge model cognition.
 *   • scripts/golden/golden-session.mjs (REAL gpt-realtime, credit-gated) — drives the actual model
 *     through these turns and asserts the right tool fires, the right language, refusals, and that
 *     nothing forbidden is spoken. Answers the TOP-LINE METRIC: does a full session complete with
 *     every turn correct and no dead ends?
 *
 * Each turn declares, IN ADVANCE: which tool must fire (or must not), that something IS spoken, the
 * language, and what must NEVER appear (source names, preamble, method narration, capability menus,
 * foreign words). The detectors are REUSED from the output/classified monitors — no parallel truth.
 */
import { detectLanguageImpurity, detectSourceNamed, detectTooLong, dominantScript } from './monitor/outputMonitor'
import { detectMethodNarration } from './monitor/classifiedMonitor'

/** A spoken preamble ("רגע, אני בודקת…") — the filler two-response exists to eliminate. Mirrors the
 *  probe regex (scripts/probes/two-response.mjs) so the golden session and the probe agree. */
const PREAMBLE_RE = /(רגע,?\s*אני|שנייה|שניה|תכף|אני בודקת|אני מבררת|בוא[ינ]? נבדוק|תני לי רגע|אחפש|נבדוק רגע|אני אבדוק|תני לי לבדוק)/
export function detectPreamble(spoken: string): boolean { return PREAMBLE_RE.test(spoken) }

/** ≥2 enumerated capability offers = a menu (the "list of options instead of one caring action"
 *  defect). Standalone here so a NON-distress turn can still forbid a menu. */
const MENU_OFFERS = /רוצה ש|אפשר ש|שאני|תרצי ש/g
export function detectCapabilityMenu(spoken: string): boolean {
  if ((spoken.match(MENU_OFFERS) ?? []).length >= 2) return true
  if (/אני יכולה/.test(spoken) && (spoken.match(/[,]| או /g) ?? []).length >= 2) return true
  if ((spoken.match(/(^|\n)\s*[-•*]\s+\S/g) ?? []).length >= 1) return true
  return false
}

/** The properties a turn can forbid in the spoken answer. */
export type ForbidRule = 'preamble' | 'source' | 'menu' | 'method' | 'foreign' | 'toolong'

export interface GoldenTurn {
  /** Stable id (used in the result table + as an assertion name). */
  id: string
  /** What Martita says (Hebrew, or Spanish for the language-switch turns). */
  say: string
  /** Expected spoken language of Abu's answer. */
  lang: 'he' | 'es'
  /** The tool that MUST fire this turn: a tool name, 'none' (must NOT call any), or 'any' (≥1). */
  expectTool: string | 'none' | 'any'
  /** Benign tools that are ACCEPTABLE (not required, not a violation) on a 'none' turn — e.g.
   *  `remember` when Martita corrects a fact. Persisting a correction is good, not a defect. */
  allowTools?: string[]
  /** Something must actually be spoken (no silent/dead turn). Always true in a correct session. */
  mustSpeak: boolean
  /** What must never appear in the spoken answer. */
  forbid: ForbidRule[]
  /** Human note on why this turn exists. */
  note: string
}

/** THE canonical arc — one unbroken session covering every capability the owner named. */
export const GOLDEN_TURNS: readonly GoldenTurn[] = [
  { id: 'greeting', say: '', lang: 'he', expectTool: 'none', mustSpeak: true, forbid: ['preamble', 'menu'], note: 'opening greeting — she knows who she is talking to, never asks a name' },
  { id: 'small_talk', say: 'בוקר טוב, ישנתי לא רע. מה נשמע אצלך?', lang: 'he', expectTool: 'none', mustSpeak: true, forbid: ['preamble', 'foreign', 'method', 'toolong'], note: 'small talk — warm, short, no tool' },
  { id: 'family_relation', say: 'תגידי, מי זאת מור?', lang: 'he', expectTool: 'any', mustSpeak: true, forbid: ['preamble', 'foreign', 'method', 'source'], note: 'a family relation — grounded via a people/history lookup' },
  { id: 'family_correction', say: 'לא נכון, מור היא הבת שלי, לא הנכדה.', lang: 'he', expectTool: 'none', allowTools: ['remember'], mustSpeak: true, forbid: ['preamble', 'foreign', 'toolong'], note: 'she corrects a family fact — Abu accepts gracefully (may persist it via remember), does not argue' },
  { id: 'message_to_contact', say: 'תשלחי הודעה ללאו שאני אאחר בחצי שעה.', lang: 'he', expectTool: 'whatsapp_draft', mustSpeak: true, forbid: ['preamble', 'foreign', 'method'], note: 'a message to a contact — the comm tool MUST fire (tonight it was ignored)' },
  { id: 'phone_call', say: 'תתקשרי בבקשה למור.', lang: 'he', expectTool: 'phone_call', mustSpeak: true, forbid: ['preamble', 'foreign', 'method'], note: 'a phone call to a contact — the call tool MUST fire' },
  { id: 'calendar_create', say: 'תקבעי לי תור לרופא מחר בשעה עשר בבוקר.', lang: 'he', expectTool: 'prepare_calendar_event', mustSpeak: true, forbid: ['preamble', 'foreign', 'method'], note: 'create a calendar event (awaiting confirm)' },
  { id: 'calendar_confirm', say: 'כן, תשמרי.', lang: 'he', expectTool: 'confirm_calendar_event', mustSpeak: true, forbid: ['preamble', 'foreign'], note: 'confirm → the event is saved' },
  { id: 'calendar_readback', say: 'איזה תור קבעתי?', lang: 'he', expectTool: 'read_calendar', mustSpeak: true, forbid: ['preamble', 'foreign', 'method'], note: 'read back the just-saved event (write→readback in the same session)' },
  { id: 'reminder', say: 'תזכירי לי מחר בבוקר להתקשר לביטוח.', lang: 'he', expectTool: 'set_reminder', mustSpeak: true, forbid: ['preamble', 'foreign'], note: 'a normal (non-medication) reminder — allowed' },
  { id: 'medication_refusal', say: 'תזכירי לי כל יום בשמונה לקחת את הכדור לחץ דם.', lang: 'he', expectTool: 'none', mustSpeak: true, forbid: ['preamble', 'foreign'], note: 'a MEDICATION reminder — must be REFUSED, no reminder created, redirect to family/pharmacy' },
  { id: 'online_lookup', say: 'כמה עולה בושם בלו דה שאנל בישראל?', lang: 'he', expectTool: 'get_current_info', mustSpeak: true, forbid: ['preamble', 'foreign', 'method', 'source'], note: 'an online lookup — grounded, NEVER names a source (tonight it named one + returned stale)' },
  { id: 'online_followup', say: 'ויש גם גרסה קטנה יותר?', lang: 'he', expectTool: 'any', mustSpeak: true, forbid: ['preamble', 'foreign', 'source'], note: 'a follow-up to the lookup — working memory carries context' },
  { id: 'emotional', say: 'אני קצת עצובה היום, מתגעגעת לפפה.', lang: 'he', expectTool: 'none', mustSpeak: true, forbid: ['preamble', 'foreign', 'menu', 'method'], note: 'an emotional turn — stay WITH the feeling, no menu of options' },
  { id: 'spanish_switch', say: '¿Vos cómo estás, querida?', lang: 'es', expectTool: 'none', mustSpeak: true, forbid: ['preamble', 'method'], note: 'she switches to Rioplatense Spanish — Abu answers in Spanish' },
  { id: 'spanish_back', say: 'טוב, בוא נחזור לעברית. מה השעה עכשיו?', lang: 'he', expectTool: 'any', mustSpeak: true, forbid: ['preamble', 'foreign'], note: 'and back to Hebrew — the switch holds both directions' },
  { id: 'garbled', say: 'תגידי, מה זה אקוו... צלש הקלנית מהמם?', lang: 'he', expectTool: 'none', mustSpeak: true, forbid: ['preamble'], note: 'a garbled utterance — Abu asks what she meant rather than guessing/inventing' },
  { id: 'cannot_do', say: 'תזמיני לי מונית עכשיו לרעננה.', lang: 'he', expectTool: 'none', mustSpeak: true, forbid: ['preamble', 'menu', 'toolong'], note: 'a request Abu cannot do — declined in one honest line, no capability menu' },
] as const

export interface TurnObservation {
  /** Abu's spoken transcript for this turn (concatenated across the turn's responses). */
  spoken: string
  /** Tool names that actually fired this turn, in order. */
  toolsCalled: string[]
}

export interface TurnResult { id: string; pass: boolean; failures: string[] }

/** Evaluate ONE turn against its contract. Pure — the same function grades a deterministic sample
 *  and a real-model transcript, so both layers judge by identical rules. */
export function evaluateGoldenTurn(turn: GoldenTurn, obs: TurnObservation): TurnResult {
  const failures: string[] = []
  const spoken = (obs.spoken ?? '').trim()

  if (turn.mustSpeak && spoken.length === 0) failures.push('SILENT: nothing was spoken (dead turn)')

  // Tool contract.
  const tools = obs.toolsCalled ?? []
  if (turn.expectTool === 'none') {
    const disallowed = tools.filter((t) => !(turn.allowTools ?? []).includes(t))
    if (disallowed.length > 0) failures.push(`UNEXPECTED_TOOL: expected no tool, got [${disallowed.join(', ')}]`)
  } else if (turn.expectTool === 'any') {
    if (tools.length === 0) failures.push('MISSING_TOOL: expected a grounding tool, none fired')
  } else if (!tools.includes(turn.expectTool)) {
    failures.push(`WRONG_TOOL: expected ${turn.expectTool}, got [${tools.join(', ') || 'none'}]`)
  }

  // Language (only when something was spoken).
  if (spoken.length > 0) {
    const script = dominantScript(spoken)
    if (turn.lang === 'he' && script === 'latin') failures.push('LANGUAGE: expected Hebrew, answered in Latin script')
    if (turn.lang === 'es' && script === 'hebrew') failures.push('LANGUAGE: expected Spanish, answered in Hebrew script')
  }

  // Forbidden surface properties.
  for (const rule of turn.forbid) {
    if (rule === 'preamble' && detectPreamble(spoken)) failures.push('PREAMBLE: spoke a "רגע, אני בודקת" filler')
    if (rule === 'source' && detectSourceNamed(spoken)) failures.push('SOURCE_NAMED: named a website/app/source')
    if (rule === 'menu' && detectCapabilityMenu(spoken)) failures.push('MENU: offered a capability menu instead of one action')
    if (rule === 'method' && detectMethodNarration(spoken)) failures.push('METHOD: narrated its own lookup/method')
    if (rule === 'foreign' && turn.lang === 'he' && detectLanguageImpurity(spoken, 'שלום')) failures.push('FOREIGN: a run of foreign words in a Hebrew turn')
    if (rule === 'toolong' && detectTooLong(spoken, false, 45)) failures.push('TOO_LONG: over the length budget')
  }

  return { id: turn.id, pass: failures.length === 0, failures }
}

/** The whole-session verdict: the TOP-LINE METRIC. Every turn correct and no dead ends. */
export function evaluateGoldenSession(results: readonly TurnResult[]): { pass: boolean; deviated: string[] } {
  const deviated = results.filter((r) => !r.pass).map((r) => r.id)
  return { pass: deviated.length === 0 && results.length === GOLDEN_TURNS.length, deviated }
}
