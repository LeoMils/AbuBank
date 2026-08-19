/*
 * Cognitive Runtime v2 — the single central pipeline
 * ══════════════════════════════════════════════════
 * WHY THIS EXISTS
 * The old AbuAI response flow was fragmented: `orchestrate()` was advisory only,
 * and `handleSend` routed through a ~700-line if-cascade with ~20 independent
 * answer-emit points, with a second copy in the voice handler. There was no single
 * pipeline every turn passed through, no Response Verifier, and no single Hebrew
 * Composer — so the deployed product failed in real conversation while unit tests
 * stayed green. This runtime is the kill-switch replacement: ONE function every
 * user turn passes through before any answer is displayed or spoken.
 *
 * It does NOT reimplement the proven reasoners — it COMPOSES them as tools:
 *   calendarCreate · meetingIntelligence · familyReasoning · familyGraph · tools
 *   (calendar reads) · conversationOS (continuation/repair) · onlineIntent ·
 *   AbuCalendar/service (real save+verify) · responseShaper/spokenPersona (Hebrew).
 *
 * The 9 layers (mission spec):
 *   1. Input Normalizer      2. Conversation State Manager
 *   3. Intent + Goal Planner 4. Tool/Reasoning Router
 *   5. Domain Reasoners      6. Action Executor (real save + verify)
 *   7. Response Verifier     8. Hebrew Response Composer
 *   9. TTS-Safe Output
 *
 * Determinism: the synchronous core takes an injected `now` so date reasoning and
 * staleness are testable. The LLM and online layers cannot run inside a pure
 * function, so the runtime RETURNS a decision (`needsLLM` / `needsOnline`); the
 * caller executes the async work and MUST feed the result back through
 * `finalizeExternalAnswer`, which runs layers 7–9. That guarantees no answer —
 * not even an LLM answer — reaches the UI/TTS without passing the verifier and
 * composer. There is no direct LLM bypass.
 */
import {
  type ConvState, IDLE_CONV, recordAnswer, recordOnline, continueAnswer,
  isContinuation, isFrustration, isWhyChallenge, isOnlineChallenge, repair,
  planSpokenChunks,
} from './conversationOS'
import {
  type CalendarCreateState, IDLE_STATE, startCreate, resolvePendingMessage, updateCreate, isBareCreateOpener,
  isCreateIntent, isDeleteIntent, isModifyIntent, isSearchIntent,
} from './calendarCreate'
import { classifySignalV2, reduceV2, conversationV2Enabled } from './conversationEngineV2'
import { recoverTranscript } from './semanticIntelligenceEngine'
import { understandMeeting } from './meetingIntelligence'
import { buildSmartMeetingV2 as understandMeetingSmart } from './calendarEventBuilderV2'
import { isReminderIntent, isRecurringIntent, isReferentialDelete, type MutationSideEffect } from './calendarMutationReasoner'
import { runPlan } from './domainPlanner'
import { registerCalendarMutationPlugins } from './calendarMutationPlugins'
import type { ReminderDraft } from '../AbuCalendar/reminders/types'
import { interpretTask, type TaskType } from './aiTaskInterpreter'

// Register the domain plugins once, at module load. Adding a future domain = add a
// plugin + register it here; the planner and controller never change.
registerCalendarMutationPlugins()

// Precedence intents the runtime owns directly — the planner does not run for these
// (audio must never cancel; continuation/frustration/confirmation/date have fixed
// handling). Every other intent goes through the generic domain planner first.
const PLANNER_SKIP: ReadonlySet<RuntimeIntent> = new Set<RuntimeIntent>([
  'audio_complaint', 'continuation', 'frustration', 'confirmation', 'date_query',
])
import { answerFamilyRelation, childrenOfPublic, grandchildrenOfPublic, greatGrandchildrenOfPublic, resolveSinglePerson, isKnownFamilyPerson } from './familyReasoning'
import { answerRelationQuery } from './familyRelationEngine'
import { explainRelation } from './familyPathReasoner'
import { loadGraph, findNode, describeRelation, type GraphNode } from './familyGraph'
import { resolvePersonPhrase } from './personPhraseResolver'
import { ledgerWriteFromText, ledgerFamilyAnswer, ledgerCommit, ledgerChapterAnswer } from '../../truth/ledgerRuntime'
import { classifyIntake } from '../../truth/conversationIntake'
import type { Change as LedgerChange } from '../../truth/familyLaws'
import {
  getTodayEvents, getTomorrowEvents, getEventsByDate, findEventsByPerson, getWeekEvents,
} from './tools'
import { loadAppointments, createAppointmentSafe, formatHebrewDate, getHebrewHoliday } from '../AbuCalendar/service'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'
import { toSpokenText } from './spokenPersona'
import {
  shapeCreateConfirm, shapeCreateClarify, shapeCreateCancelled, shapeCreateUnclear,
  shapeCreateConfirmES, shapeCreateClarifyES, shapeCreateCancelledES, shapeCreateSavedES,
} from './responseShaper'
import { normalizeInput } from './understandingOrchestrator'
import {
  memoryCommandType, parseRememberFact, parseForgetQuery, saveMemory, forgetMemories, loadMemories,
} from './savedMemory'
import { type WhatsAppTurn } from './whatsappCompose'
import { reduceGoal, type ActiveGoal } from './communication/engine'

// ── Types ────────────────────────────────────────────────────────────────────
export type RuntimeIntent =
  | 'date_query'
  | 'calendar_read'
  | 'calendar_search'
  | 'calendar_create'
  | 'calendar_recurring'
  | 'calendar_update'
  | 'calendar_delete'
  | 'reminder'
  | 'confirmation'      // resolving a pending calendar draft (yes/no/change/audio)
  | 'memory'            // durable saved-memory command (remember / recall / forget)
  | 'family'
  | 'online'
  | 'whatsapp'          // send/write/call a contact — owned before calendar
  | 'continuation'
  | 'frustration'
  | 'audio_complaint'
  | 'math'
  | 'general'
  | 'unknown'

export type Lang = 'he' | 'es' | 'mixed'

/**
 * The ACTIVE conversation object (minimal "Conversation Object"): what topic we
 * are currently inside, so a bare follow-up continues it instead of re-routing as
 * a fresh intent. Set when a live-info turn commits a topic; cleared when a
 * deterministic non-online turn commits (so a follow-up can never bind to a stale
 * object). Currently used for ONLINE continuity ("ומחר?" after weather stays
 * weather, never flips to the calendar on the מחר token).
 */
export interface ConversationFocus {
  kind: 'online' | 'calendar_event'
  /** the topic to continue: an online query, or the person of the found event. */
  label: string
}

export interface RuntimeState {
  conv: ConvState
  createState: CalendarCreateState
  frustrationCount: number
  lastIntent: RuntimeIntent | null
  /** last frustration reply index, so repeats never echo the same sentence. */
  frustrationVariant: number
  /** a reminder draft awaiting time/confirmation (controller-reasoned). */
  pendingReminder: ReminderDraft | null
  /** last family pair answered, so "איך בדיוק / דרך מי / למה" can explain the path. */
  lastFamilyPair: { a: string; b: string } | null
  /** last person a family question was ABOUT — the antecedent for a follow-up pronoun
   *  ("מי זה אופיר?" then "ומי אמא שלה?" → her = אופיר). Canonical Hebrew name. */
  lastFamilySubject: string | null
  /** the active conversation object for follow-up continuity (optional/back-compat). */
  focus?: ConversationFocus | null
  /** a family fact stated plainly (no "תזכרי"), awaiting ONE soft "כן" before it is
   *  written to the ledger through THE LAWS gate. Cleared on any non-confirm. */
  pendingLedgerChange?: LedgerChange | null
  /** The canonical active Communication goal (owned by the communication engine's
   *  reduceGoal). A bare follow-up ("בשמונה וחצי" / "עם יין" / "לא פגישה") updates
   *  THIS goal via the engine and never creates a calendar event. Cleared by any
   *  deterministic non-comm answer, or when the engine releases ownership. */
  pendingCommunication?: ActiveGoal | null
}

export const IDLE_RUNTIME: RuntimeState = {
  conv: IDLE_CONV,
  createState: IDLE_STATE,
  frustrationCount: 0,
  lastIntent: null,
  frustrationVariant: 0,
  pendingReminder: null,
  lastFamilyPair: null,
  lastFamilySubject: null,
  focus: null,
  pendingCommunication: null,
}

export interface RuntimeContext {
  messages: Array<{ role: string; content: string }>
  /** Injected clock so date reasoning + staleness are deterministic/testable. */
  now: Date
}

export interface VerifierReport { ok: boolean; violations: string[] }

export interface CognitiveDecision {
  /** true → the runtime produced a terminal answer; false → caller must run LLM/online. */
  handled: boolean
  intent: RuntimeIntent
  lang: Lang
  original: string
  normalized: string
  /** text for the chat bubble (composed + verified). */
  display: string | null
  /** spoken text (TTS-safe, ≤2 sentences per chunk join). */
  speak: string | null
  /** TTS-safe chunks; "continue" resumes the next one. */
  chunks: string[]
  needsLLM: boolean
  needsOnline: boolean
  online: { query: string } | null
  /** grounded facts to hand a grounded-LLM composer when needsLLM for a domain. */
  grounding: string | null
  sideEffect: 'saved_appointment' | 'save_failed' | MutationSideEffect
  verifier: VerifierReport
  state: RuntimeState
  /** a grounded family answer (resolved pair or BFS explanation) — the Confidence
   *  Guard must not overwrite it with the honest-unknown fallback. */
  familyGrounded?: boolean
  /** Set when this turn is a WhatsApp compose / phone-call request. The caller
   *  performs the async compose + renders the draft (kept OUT of the sync
   *  controller). Precedence is enforced ahead of calendar so a date/time in the
   *  MESSAGE never routes the turn to the calendar. */
  whatsapp?: WhatsAppTurn | null
}

// ── Layer 1: Input Normalizer ─────────────────────────────────────────────────
const HEB = /[֐-׿]/
const LAT = /[A-Za-z]/
const ES_MARK = /\b(?:hola|gracias|dale|vos|estoy|sola|qué|que|cómo|cuándo|por favor|mañana|hoy)\b/i

export function detectLang(text: string): Lang {
  const heb = HEB.test(text)
  const lat = LAT.test(text) && (ES_MARK.test(text) || /[áéíóúñ¿¡]/.test(text))
  if (heb && lat) return 'mixed'
  if (lat && !heb) return 'es'
  return 'he'
}

export interface Normalized { original: string; normalized: string; lang: Lang }

export function normalizeTurn(raw: string, messages: RuntimeContext['messages']): Normalized {
  const original = raw
  const { normalized } = normalizeInput(raw, messages)
  return { original, normalized: normalized || raw.trim(), lang: detectLang(raw) }
}

// ── Layer 3: Intent + Goal Planner ─────────────────────────────────────────────
// NOTE: no \b anchors around Hebrew — \b is ASCII-only and never matches at a
// Hebrew/space boundary, so it would silently break every Hebrew intent regex.
const DATE_QUERY_RE =
  /(?:איזה יום היום|מה היום|מה התאריך|איזה תאריך|באיזה תאריך אנחנו|qué día es hoy|que dia es hoy|qué fecha|que fecha)/iu
// A RELATIVE day/date question ("איזה יום היה אתמול", "מה התאריך מחר", "שלשום",
// "¿qué día fue ayer?"). Answered deterministically from ctx.now — the LLM has no
// clock, and returning TODAY for a yesterday/tomorrow question is confidently wrong.
// Requires an explicit day/date-asking frame so calendar reads ("מה יש לי מחר") are
// never hijacked — those have no "איזה יום"/"תאריך" frame.
const RELATIVE_DATE_QUERY_RE =
  /(?:איזה\s+יום|איזה\s+תאריך|מה\s+ה?תאריך|מה\s+היום|באיזה\s+תאריך)[^?]*?(?:אתמול|שלשום|מחרתיים|מחר|בעוד\s+\S|לפני\s+\S)|(?:אתמול|שלשום|מחרתיים|מחר|בעוד\s+\S+|לפני\s+\S+)[^?]*?(?:איזה\s+יום|איזה\s+תאריך|מה\s+ה?תאריך)|qu[eé]\s+(?:d[ií]a|fecha)[^?]*?(?:anteayer|pasado\s+ma[ñn]ana|ayer|ma[ñn]ana)/iu
// A "when is the next holiday" / "when is <holiday>" question. Jewish-holiday dates
// are a fixed table (deterministic) — answering from the table avoids the stale
// "Independence Day 2024" hallucination. Requires a holiday noun so "מתי הפגישה"
// (calendar) is never captured.
const HOLIDAY_QUERY_RE =
  /מתי\s+(?:ה?חג\s+ה?בא|ה?חג\b|פסח|חנוכה|פורים|סוכות|שבועות|ראש\s+השנה|יום\s+כיפור|שמחת\s+תורה)|(?:פסח|חנוכה|פורים|סוכות|שבועות|ראש\s+השנה|יום\s+כיפור|שמחת\s+תורה)\s+ה?בא/u
// National/CIVIC days (Independence, Memorial, Holocaust, Jerusalem Day). Their Gregorian
// date is nidche-adjusted (postponement rules) and NOT in the deterministic religious-holiday
// table — so a date question about them must go to LIVE retrieval, never model memory and
// never the today-returning date_query ("באיזה תאריך יום העצמאות" must not answer TODAY).
const CIVIC_HOLIDAY_RE =
  /יום\s+ה?עצמאות|חג\s+ה?עצמאות|יום\s+ה?זיכרון|יום\s+ה?שואה|יום\s+ירושלים|d[ií]a\s+de\s+la\s+independencia|independencia|d[ií]a\s+de\s+los?\s+ca[íi]dos/iu
// "מתי יום ראשון הבא?" / "איזה תאריך יום שלישי הבא?" — the NEXT occurrence of a weekday,
// computed from ctx.now. Requires a date-asking frame (מתי/איזה תאריך/איזה יום/באיזה) so a
// calendar create ("תקבעי פגישה ביום שלישי הבא") is NEVER hijacked to a date query.
const NEXT_WEEKDAY_QUERY_RE =
  /(?:מתי|איזה\s+תאריך|באיזה\s+תאריך|איזה\s+יום|באיזה\s+יום)[^?]*?(?:ביום\s+|יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s+ה?בא(?:ה)?/u
// "כמה ימים/זמן (נשאר) עד <סוף החודש|סוף השבוע|holiday>" — a deterministic days-until count.
const DAYS_UNTIL_QUERY_RE =
  /כמה\s+(?:זמן|ימים|עוד\s+זמן|עוד\s+ימים)[^?]*?עד\s+(?:סוף\s+ה?חודש|סוף\s+ה?שבוע|ראש\s+השנה|פסח|חנוכה|פורים|סוכות|שבועות|יום\s+כיפור|שמחת\s+תורה)/u
const AUDIO_COMPLAINT_RE =
  /(?:לא\s+שומעת?\s+אות[ךיו]|אני\s+לא\s+שומע|לא\s+שמעתי(?:\s+אות[ךיו])?|לא\s+מדברת|הקול\s+נעלם|אין\s+קול|למה\s+את\s+שותקת|no\s+te\s+(?:escucho|oigo))/iu
// Frustration the shared regex misses — "you're not answering what I asked".
const FRUSTRATION_EXTRA_RE =
  /את\s+לא\s+עונה|לא\s+ענית\s+לי|לא\s+על\s+זה\s+שאלתי|לא\s+ענית\s+על|זה\s+לא\s+מה\s+ששאלתי|את\s+לא\s+עונה\s+למה\s+ששאלתי|לא\s+הבנת\s+אותי|לא\s+זה\s+מה\s+ששאלתי/u
const CONTINUATION_EXTRA_RE = /תשלימי\s+את\s+המשפט|תסיימי\s+את\s+המשפט|תגמרי\s+את\s+המשפט/u
const RECALL_TOPIC_RE = /על\s+מה\s+דיבר(?:נו|ת)|מה\s+דיברנו|de\s+qu[eé]\s+hablamos/iu
// A CROSS-SESSION memory question ("את זוכרת מה אמרתי לך אתמול?", "¿te acordás de lo que
// te dije ayer?") — AbuAI has NO cross-session memory. Answer HONESTLY; never imply it
// remembers past conversations (the "sometimes I miss things" device failure). Requires a
// past-session time marker so a within-session "מה אמרתי קודם" is NOT captured here.
const CROSS_SESSION_MEMORY_RE =
  /(?:את\s+)?זוכרת\b[^?]*(?:אתמול|שלשום|שלשם|בשבוע\s+שעבר|בפעם\s+ה?קודמת|בשיחה\s+ה?קודמת|בשיחה\s+שעברה|פעם\s+שעברה|לפני\s+כמה\s+ימים|לפני\s+שבוע|לפני\s+יומיים)|מה\s+(?:אמרתי|סיפרתי)\s+ל[ךיו][^?]*(?:אתמול|שלשום|בשבוע\s+שעבר|בפעם\s+ה?קודמת|בשיחה\s+ה?קודמת|פעם\s+שעברה)|(?:te\s+acord[aá]s|recuerdas)[^?]*(?:ayer|anteayer|la\s+semana\s+pasada|la\s+vez\s+pasada)/iu
// A LAST-QUESTION recall ("מה שאלתי אותך קודם?", "מה הייתה השאלה שלי", "¿qué te pregunté?")
// — recall the prior user question from THIS session's working memory, never the LLM.
const LAST_QUESTION_RE =
  /מה\s+שאלתי(?:\s+אות[ךיו])?(?:\s+(?:קודם|עכשיו|לפני|אותך))?|מה\s+הי[יה]ת[הה]?\s+ה?שאלה(?:\s+ה?קודמת)?\s+שלי|ה?שאלה\s+ה?קודמת\s+שלי|qu[eé]\s+te\s+pregunt[eé]/iu
// A trivial social/closing turn (greeting, thanks, goodbye, "never mind", exit).
// These must NOT become the remembered conversation topic — otherwise
// "מה דיברנו קודם?" echoes the last throwaway word ("דיברנו על עזוב"). We skip
// recording them, so the prior SUBSTANTIVE topic stays as what we "talked about".
const TRIVIAL_TURN_RE = /^(?:שלום|היי|הא?לו|בוקר טוב|ערב טוב|צהריים טובים|לילה טוב|מה שלומך|מה נשמע|תודה(?:\s+רבה)?(?:\s+לך)?|ביי|יאללה\s+ביי|להתראות|עזוב(?:י|ו)?|לא\s+משנה|שכח[יי]?\s+מזה|תעזב[יי]|סבבה|אוקיי?|בסדר|טוב)[\s.,!?]*$/u
function isTrivialTurn(t: string): boolean { return TRIVIAL_TURN_RE.test((t ?? '').trim()) }
// A meta / recall question ("מה דיברנו קודם?", "מה אמרת על מור?") must ALSO never
// become the remembered topic — otherwise a later "על מה דיברנו בהתחלה?" echoes the
// previous recall question instead of the real subject.
const META_RECALL_RE = /על\s+מה\s+דיבר|מה\s+דיברנו|מה\s+אמרת\s+על|מה\s+סיפרת|מה\s+שאלתי|de\s+qu[eé]\s+hablamos/iu
function isNonTopicTurn(t: string): boolean { const s = (t ?? '').trim(); return isTrivialTurn(s) || META_RECALL_RE.test(s) }
// "מתי יש לי פגישה עם X" / "מתי הפגישה עם X" → search across ALL days (never create,
// never ask "באיזה יום"). Must be tested BEFORE isCreateIntent, which is greedy.
const SEARCH_WHEN_RE = /^מתי\s+.*(?:יש\s+לי|ה?פגישה|ה?תור|ה?ביקור|נפגש|פגוש)/u
// Casual search: "יש לי משהו עם X" / bare "פגישה ב/עם/אצל X" (no create verb).
const SEARCH_CASUAL_RE = /(?:יש\s+לי\s+(?:משהו|פגיש\S*|תור|ביקור|מפגש|דבר|אירוע)[^?]*?(?:עם|אצל|ב)\s*[א-ת])|(?:^(?:ה?פגיש\S*|ה?תור|ה?מפגש|ה?ביקור)\s+(?:עם|אצל|ב)[א-ת])/u
// Family explanation follow-up: "איך בדיוק", "דרך מי", "תסבירי", "למה", "את בטוחה".
const FAMILY_EXPLAIN_RE = /^(?:איך\s+בדיוק|איך\s+זה|דרך\s+מי|תסביר\S*|למה\??|את\s+בטוח\S*|בטוחה\??)\s*\??$/u
// Live/current-info that onlineIntent does not already classify (buses/trains/
// weather/local events/movies) — kept in sync with knowledgeRouter's routing.
const ONLINE_EXTRA_RE =
  /(?:מתי\s+ה?אוטובוס|ה?אוטובוס\s+(?:ה?בא|מ)|מתי\s+ה?רכבת|ה?רכבת\s+(?:ה?באה|מ)|מתי\s+ה?טיסה|מזג\s+ה?אוויר|תחזית|חדשות\s+ה?יום|סרטים|קולנוע|הצגות|מה\s+פתוח)/u
// A BARE temporal follow-up ("ומחר?", "והיום?", "ומחרתיים?"). After a live-info
// (online) answer this must CONTINUE that topic — e.g. weather-tomorrow — not let
// the מחר token flip it to the calendar. Deliberately narrow (temporal only) so a
// real context switch (a full family/calendar question) is never hijacked.
const ONLINE_TEMPORAL_FOLLOWUP_RE = /^(?:ו|בעצם\s+)?(?:מחר|היום|מחרתיים|הערב|אתמול|השבוע|בסופ״?ש|בסוף\s+השבוע)\s*\??$/u
// A narrative event description WITHOUT an explicit create verb ("ביום שלישי אופיר
// … בשעה שבע … אצלה שעתיים") — day + time + person/place → a calendar create, so it
// is never mistaken for a family question just because family names appear in it.
const DAY_CUE = /(?:מחר|מחרתיים|היום|הערב|ביום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת))/u
const TIME_CUE = /(?:בשעה|בשבע|בשמונה|בתשע|בעשר|באחת|בשתיים|בשלוש|בארבע|בחמש|בשש|בבוקר|בערב|בצהריים|בחצות|וחצי)/u
const PLACE_PERSON_CUE = /(?:אצל|עם\s+[א-ת]{2,}|אלי[הו]|הביתה|לבית[הו]?)/u
function looksLikeNarrativeMeeting(t: string): boolean {
  if (/^(?:מה|מי|מתי|איפה|כמה)\b/u.test(t) || /[?؟]/.test(t)) return false
  return DAY_CUE.test(t) && TIME_CUE.test(t) && PLACE_PERSON_CUE.test(t)
}

/**
 * Single priority ladder. Nothing bypasses it. Order matters:
 * pending-draft resolution and audio complaints win over fresh classification so a
 * "yes"/"I can't hear you" mid-create is never misread.
 */
export function classifyIntent(
  text: string,
  state: RuntimeState,
): RuntimeIntent {
  const t = text.trim()
  const pending = state.createState.phase !== 'idle'

  // "לא שמעתי תמשיכי" — an audio complaint that ALSO asks to continue means "I
  // didn't hear you, say it again" → resume the answer, not an audio-help reply.
  if (AUDIO_COMPLAINT_RE.test(t) && (isContinuation(t) || CONTINUATION_EXTRA_RE.test(t))) return 'continuation'

  // An audio complaint is ALWAYS an audio complaint — it must never cancel a draft
  // or be answered as calendar data (real iPhone failure cluster 5).
  if (AUDIO_COMPLAINT_RE.test(t)) return 'audio_complaint'

  // A pending reminder (awaiting time/confirmation) resolves before anything else.
  if (state.pendingReminder) return 'reminder'

  // Frustration / challenge ("את לא מבינה אותי", "למה אין לך?", "את לא עונה") — BEFORE
  // the pending-draft resolution, so a frustrated turn mid-create is met with empathy
  // and NEVER cancels the pending draft (frustration does not reset context).
  if (isFrustration(t) || isWhyChallenge(t) || isOnlineChallenge(t) || FRUSTRATION_EXTRA_RE.test(t)) return 'frustration'

  // While a calendar draft is pending, the turn resolves it (save/cancel/change/park).
  if (pending) return 'confirmation'

  // "איך בדיוק / דרך מי / תסבירי / למה / את בטוחה" right after a family answer →
  // explain the graph path for the last pair (multi-turn family reasoning).
  if (state.lastFamilyPair && FAMILY_EXPLAIN_RE.test(t)) return 'family'

  // Continuation / resume, or topic recall ("על מה דיברנו", even prefixed by
  // "יש לך זיכרון …") — both are handled inside the continuation case.
  if (isContinuation(t) || CONTINUATION_EXTRA_RE.test(t) || RECALL_TOPIC_RE.test(t)
      || CROSS_SESSION_MEMORY_RE.test(t) || LAST_QUESTION_RE.test(t)) return 'continuation'

  // Date/day/TIME questions answered from the real clock — never invented, never
  // "באיזה יום", never a fabricated "03:00".
  // Civic/national days need LIVE retrieval — checked BEFORE date_query so
  // "באיזה תאריך יום העצמאות" is never answered with TODAY, and before the LLM fallback.
  if (CIVIC_HOLIDAY_RE.test(t) && !shouldBlockOnlineForPersonal(t)) return 'online'
  if (DATE_QUERY_RE.test(t) || TIME_QUERY_RE.test(t) ||
      RELATIVE_DATE_QUERY_RE.test(t) || HOLIDAY_QUERY_RE.test(t) ||
      NEXT_WEEKDAY_QUERY_RE.test(t) || DAYS_UNTIL_QUERY_RE.test(t)) return 'date_query'

  // Deterministic math/percent/tip ("כמה זה 15 כפול 4", "20 אחוז מ-200") — computed, never
  // the LLM. isMathQuery only matches a real expression, so a price ("כמה עולה חלב") is NOT math.
  if (isMathQuery(t)) return 'math'

  // Live/current-info that onlineIntent misses (buses/trains/weather) — before the
  // calendar verbs so "מתי האוטובוס" is never mistaken for a calendar create.
  if (ONLINE_EXTRA_RE.test(t) && !shouldBlockOnlineForPersonal(t)) return 'online'

  // Durable saved-memory command ("תזכרי ש…" / "מה את זוכרת עליי" / "תשכחי ש…") — handled
  // deterministically + persistently, never punted to the LLM (which has no store).
  if (memoryCommandType(t)) return 'memory'

  // "תבטלי אותה" / "cancel it" — a bare cancel/delete verb referring (pronoun or bare)
  // to the calendar event in FOCUS, with NO pending draft. isDeleteIntent misses the
  // pronoun form, so without this it dead-ends to the LLM instead of deleting.
  if (state.focus?.kind === 'calendar_event' && isReferentialDelete(t)) return 'calendar_delete'

  // ── AI Task Interpreter — AUTHORITATIVE domain decision ──────────────────────
  // When the interpreter is confident, its task OVERRIDES the legacy cues below (now the
  // fallback). It never overrides the structural guards above (audio/pending/frustration/
  // continuation/date). This is where the interpreter wins on disagreement.
  const auth = authorityIntent(text, state)
  if (auth) return auth

  return legacyDomainClassify(t)
}

/** Interpreter task → runtime intent. Only decisive tasks map; unknown/low-confidence and
 *  family (already well-routed) fall through to the legacy cues. */
const INTERPRETER_TO_INTENT: Partial<Record<TaskType, RuntimeIntent>> = {
  online_live: 'online', calendar_search: 'calendar_search', calendar_read: 'calendar_read',
  calendar_create: 'calendar_create', calendar_delete: 'calendar_delete', calendar_update: 'calendar_update',
  reminder_create: 'reminder',
}
const AUTH_THRESHOLD = 0.85

/** The AI Task Interpreter's authoritative intent for this turn, or null if not decisive. */
export function authorityIntent(text: string, state: RuntimeState): RuntimeIntent | null {
  const task = interpretTask(text.trim(), { pendingReminder: !!state.pendingReminder, pendingCreate: state.createState.phase !== 'idle' })
  const mapped = INTERPRETER_TO_INTENT[task.taskType]
  if (!mapped || task.confidence < AUTH_THRESHOLD) return null
  // The interpreter has no recurring task — defer "כל יום/שבוע" creates to the legacy
  // recurring path so multi-event creation is not lost.
  if (mapped === 'calendar_create' && isRecurringIntent(text)) return null
  return mapped
}

/** Legacy domain cues — fallback ONLY when the interpreter is not confident/decisive. */
export function legacyDomainClassify(t: string): RuntimeIntent {
  if (SEARCH_WHEN_RE.test(t)) return 'calendar_search'
  if (SEARCH_CASUAL_RE.test(t) && !isCreateIntent(t)) return 'calendar_search'
  if (isReminderIntent(t)) return 'reminder'
  if (isCreateIntent(t) && isRecurringIntent(t)) return 'calendar_recurring'
  if (isCreateIntent(t)) return 'calendar_create'
  if (isDeleteIntent(t)) return 'calendar_delete'
  if (isModifyIntent(t)) return 'calendar_update'
  if (isSearchIntent(t)) return 'calendar_search'
  if (/(?:מה יש לי|יש לי משהו|מה ה?תוכניות שלי|מה ביומן|מה יש ביומן|מה קבעתי|מה קבענו|מה קבעת לי)/u.test(t) &&
      /(?:היום|מחר|השבוע|הערב|יומן|תוכניות)/u.test(t)) return 'calendar_read'
  // Bare past-tense read-back ("מה קבענו?", "מה קבעתי?") — after a save/plan she asks
  // what was set; read it, never punt to the LLM.
  if (/^מה\s+קבע(?:תי|נו|ת|ת\s+לי)\s*[?.!]*$/u.test(t)) return 'calendar_read'
  if (looksLikeNarrativeMeeting(t)) return 'calendar_create'
  if (looksLikeFamilyQuery(t)) return 'family'
  if (isOnlineCurrentInfoQuery(t) && !shouldBlockOnlineForPersonal(t)) return 'online'
  return 'general'
}

// ── Layer 5: Domain Reasoners ──────────────────────────────────────────────────

// DateReasoner — real system/date source, deterministic given ctx.now.
const HE_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']
function localISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
// A time question is answered from the SYSTEM CLOCK, never the LLM (which has no
// clock and would fabricate a time — the "03:00 default" hallucination class).
const TIME_QUERY_RE = /מה\s+ה?שעה|ה?שעה\s+עכשיו|באיזו\s+שעה\s+אנחנו|qu[eé]\s+hora/iu
// Spanish weekday / month names for relative-date replies to a Spanish question.
const SP_DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const SP_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const HOLIDAY_NAMES_HE = ['פסח', 'חנוכה', 'פורים', 'סוכות', 'שבועות', 'ראש השנה', 'יום כיפור', 'שמחת תורה']

function looksSpanishDate(t: string): boolean {
  return /[¿ñ]|qu[eé]\s+(?:d[ií]a|fecha|hora)|(?<![a-z])(?:ayer|anteayer|hoy|ma[ñn]ana|pr[oó]ximo|cu[aá]ndo)(?![a-z])/iu.test(t)
}

/** A relative day offset from a date word, or null (= today / not relative). */
function relativeDayOffset(t: string): { off: number; he: string; esPast: string; esFut: string } | null {
  if (/שלשום|anteayer/iu.test(t)) return { off: -2, he: 'שלשום', esPast: 'anteayer fue', esFut: 'anteayer fue' }
  if (/מחרתיים|pasado\s+ma[ñn]ana/iu.test(t)) return { off: 2, he: 'מחרתיים', esPast: 'pasado mañana será', esFut: 'pasado mañana será' }
  if (/אתמול|(?<![a-z])ayer(?![a-z])/iu.test(t)) return { off: -1, he: 'אתמול', esPast: 'ayer fue', esFut: 'ayer fue' }
  if (/(?<![א-ת])מחר(?![א-ת])|(?<![a-z])ma[ñn]ana(?![a-z])/iu.test(t)) return { off: 1, he: 'מחר', esPast: 'mañana será', esFut: 'mañana será' }
  return null
}

// Hebrew number words (1-10) for "בעוד N ..." arithmetic.
const HE_NUM: Record<string, number> = {
  אחד: 1, אחת: 1, שני: 2, שניים: 2, שתיים: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4,
  חמישה: 5, חמש: 5, שישה: 6, שש: 6, שבעה: 7, שבע: 7, שמונה: 8, תשעה: 9, תשע: 9, עשרה: 10, עשר: 10,
}

/** "בעוד N ימים/יומיים/שבוע/שבועיים/N שבועות" → a forward day offset, or null. */
function beodDaysOffset(t: string): { days: number; label: string } | null {
  if (/בעוד\s+יומיים/u.test(t)) return { days: 2, label: 'יומיים' }
  if (/בעוד\s+שבועיים/u.test(t)) return { days: 14, label: 'שבועיים' }
  let m = t.match(/בעוד\s+(\d+)\s+ימים/u); if (m) return { days: parseInt(m[1]!, 10), label: `${m[1]} ימים` }
  m = t.match(/בעוד\s+([א-ת]+)\s+ימים/u); if (m && HE_NUM[m[1]!]) return { days: HE_NUM[m[1]!]!, label: `${m[1]} ימים` }
  m = t.match(/בעוד\s+(\d+)\s+שבועות/u); if (m) return { days: parseInt(m[1]!, 10) * 7, label: `${m[1]} שבועות` }
  m = t.match(/בעוד\s+([א-ת]+)\s+שבועות/u); if (m && HE_NUM[m[1]!]) return { days: HE_NUM[m[1]!]! * 7, label: `${m[1]} שבועות` }
  if (/בעוד\s+שבוע(?![יו])/u.test(t)) return { days: 7, label: 'שבוע' }
  return null
}

/** "לפני N ימים/יומיים/שבוע/שבועיים/N שבועות" → a BACKWARD day offset, or null. */
function lifneiDaysOffset(t: string): { days: number; label: string } | null {
  if (/לפני\s+יומיים/u.test(t)) return { days: 2, label: 'לפני יומיים' }
  if (/לפני\s+שבועיים/u.test(t)) return { days: 14, label: 'לפני שבועיים' }
  let m = t.match(/לפני\s+(\d+)\s+ימים/u); if (m) return { days: parseInt(m[1]!, 10), label: `לפני ${m[1]} ימים` }
  m = t.match(/לפני\s+([א-ת]+)\s+ימים/u); if (m && HE_NUM[m[1]!]) return { days: HE_NUM[m[1]!]!, label: `לפני ${m[1]} ימים` }
  m = t.match(/לפני\s+(\d+)\s+שבועות/u); if (m) return { days: parseInt(m[1]!, 10) * 7, label: `לפני ${m[1]} שבועות` }
  m = t.match(/לפני\s+([א-ת]+)\s+שבועות/u); if (m && HE_NUM[m[1]!]) return { days: HE_NUM[m[1]!]! * 7, label: `לפני ${m[1]} שבועות` }
  if (/לפני\s+שבוע(?![יו])/u.test(t)) return { days: 7, label: 'לפני שבוע' }
  return null
}

/** "בעוד N שעות/שעה/שעתיים" → a forward hour offset, or null. */
function beodHoursOffset(t: string): { hours: number; label: string } | null {
  if (/בעוד\s+שעתיים/u.test(t)) return { hours: 2, label: 'שעתיים' }
  let m = t.match(/בעוד\s+(\d+)\s+שעות/u); if (m) return { hours: parseInt(m[1]!, 10), label: `${m[1]} שעות` }
  m = t.match(/בעוד\s+([א-ת]+)\s+שעות/u); if (m && HE_NUM[m[1]!]) return { hours: HE_NUM[m[1]!]!, label: `${m[1]} שעות` }
  if (/בעוד\s+שעה(?![ת])/u.test(t)) return { hours: 1, label: 'שעה' }
  return null
}

// Weekday name → getDay() index (0=Sunday … 6=Saturday).
const HE_WEEKDAY_IDX: Record<string, number> = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5, שבת: 6 }
/** "יום <weekday> הבא" → the NEXT occurrence of that weekday strictly after today
 *  (if today IS that weekday, next week's), or null. Deterministic from `now`. */
function nextWeekdayAnswer(text: string, now: Date): string | null {
  const m = text.match(/(?:ביום\s+|יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s+ה?בא(?:ה)?/u)
  if (!m) return null
  const target = HE_WEEKDAY_IDX[m[1]!]
  if (target === undefined) return null
  let add = (target - now.getDay() + 7) % 7
  if (add === 0) add = 7 // "next" — today does not count
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() + add)
  const label = m[1] === 'שבת' ? 'שבת הבאה' : `יום ${m[1]} הבא`
  return `${label} — ${dateWithoutDay(localISO(d))}.`
}

/** Next holiday strictly AFTER `now` (from the fixed Hebrew-holiday table), optionally
 *  a specific one. Deterministic; returns null when the table has no answer (we then
 *  say so honestly rather than invent a date). */
function nextHoliday(now: Date, specific?: string): { name: string; iso: string } | null {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let last: string | null = null
  for (let i = 1; i <= 800; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i)
    const iso = localISO(d)
    const h = getHebrewHoliday(iso)
    // Collapse multi-day holidays: only report the FIRST day of a run.
    if (h && h !== last && (!specific || h === specific)) return { name: h, iso }
    last = h
  }
  return null
}

function askedHoliday(t: string): string | undefined {
  return HOLIDAY_NAMES_HE.find(h => t.includes(h))
}

/** Deterministic "how many days until <end of month | end of week | holiday>". */
function daysUntilAnswer(text: string, now: Date): string | null {
  if (!DAYS_UNTIL_QUERY_RE.test(text)) return null
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const phrase = (n: number, label: string, extra = '') => {
    if (n <= 0) return `${label} זה היום.`
    if (n === 1) return `עד ${label} נשאר יום אחד${extra}.`
    return `עד ${label} נשארו ${n} ימים${extra}.`
  }
  if (/סוף\s+ה?חודש/.test(text)) {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return phrase(last - now.getDate(), 'סוף החודש')
  }
  if (/סוף\s+ה?שבוע/.test(text)) {
    const toSat = (6 - now.getDay() + 7) % 7 // Israel week ends on Saturday
    return phrase(toSat, 'סוף השבוע')
  }
  const specific = askedHoliday(text)
  if (specific) {
    const nh = nextHoliday(now, specific)
    if (!nh) return `אין לי כרגע את התאריך של ${specific} הבא.`
    const target = new Date(`${nh.iso}T00:00:00`)
    const n = Math.round((target.getTime() - base.getTime()) / 86400000)
    return phrase(n, nh.name, ` (${dateWithoutDay(nh.iso)})`)
  }
  return null
}

/** Strip a leading/trailing weekday from formatHebrewDate output → "22 בספטמבר 2026". */
function dateWithoutDay(iso: string): string {
  return safeHebrewDate(iso)
    .replace(/^\s*(?:יום\s+\S+|שבת)\s*,?\s*/u, '')
    .replace(/,?\s*(?:יום\s+\S+|שבת)\s*$/u, '')
    .trim()
}

// City / country → IANA timezone, with He + Es labels, so "מה השעה בניו יורק" answers the
// city's real time (via Intl) instead of the local Israel clock (the confidently-wrong bug).
const CITY_TZ: Array<{ re: RegExp; tz: string; he: string; es: string }> = [
  { re: /ניו[\s-]?יורק|new\s*york|nueva\s+york/iu, tz: 'America/New_York', he: 'ניו יורק', es: 'Nueva York' },
  { re: /בואנוס[\s-]?איירס|buenos\s+aires|ארגנטינה|argentina/iu, tz: 'America/Argentina/Buenos_Aires', he: 'בואנוס איירס', es: 'Buenos Aires' },
  { re: /לונדון|london|londres/iu, tz: 'Europe/London', he: 'לונדון', es: 'Londres' },
  { re: /פריז|paris|par[íi]s/iu, tz: 'Europe/Paris', he: 'פריז', es: 'París' },
  { re: /מדריד|madrid/iu, tz: 'Europe/Madrid', he: 'מדריד', es: 'Madrid' },
  { re: /ברצלונה|barcelona/iu, tz: 'Europe/Madrid', he: 'ברצלונה', es: 'Barcelona' },
  { re: /לוס[\s-]?אנג[׳'ג]?לס|los\s+angeles/iu, tz: 'America/Los_Angeles', he: 'לוס אנג׳לס', es: 'Los Ángeles' },
  { re: /מיאמי|miami/iu, tz: 'America/New_York', he: 'מיאמי', es: 'Miami' },
  { re: /מוסקבה|moscow|mosc[úu]/iu, tz: 'Europe/Moscow', he: 'מוסקבה', es: 'Moscú' },
  { re: /ברלין|berlin|berl[íi]n/iu, tz: 'Europe/Berlin', he: 'ברלין', es: 'Berlín' },
  { re: /רומא|rome|roma/iu, tz: 'Europe/Rome', he: 'רומא', es: 'Roma' },
  { re: /טוקיו|tokyo|tokio/iu, tz: 'Asia/Tokyo', he: 'טוקיו', es: 'Tokio' },
  { re: /סידני|sydney/iu, tz: 'Australia/Sydney', he: 'סידני', es: 'Sídney' },
  { re: /דובאי|dubai|dub[áa]i/iu, tz: 'Asia/Dubai', he: 'דובאי', es: 'Dubái' },
]
function timeInCity(text: string, now: Date): string | null {
  for (const c of CITY_TZ) {
    if (!c.re.test(text)) continue
    let hhmm: string
    try { hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: c.tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now) }
    catch { return null }
    return looksSpanishDate(text) ? `En ${c.es} son las ${hhmm}.` : `ב${c.he} השעה עכשיו ${hhmm}.`
  }
  return null
}

export function dateReasoner(text: string, now: Date): string {
  if (TIME_QUERY_RE.test(text)) {
    // "מה השעה בניו יורק" — the time in another city's timezone (never the local clock).
    const city = timeInCity(text, now)
    if (city) return city
    // "מה השעה בעוד שעתיים" — clock arithmetic, never the current time.
    const addH = beodHoursOffset(text)
    if (addH) {
      const d = new Date(now); d.setHours(d.getHours() + addH.hours)
      const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0')
      return `בעוד ${addH.label} השעה תהיה ${hh}:${mm}.`
    }
    const hh = String(now.getHours()).padStart(2, '0'); const mm = String(now.getMinutes()).padStart(2, '0')
    return `השעה עכשיו ${hh}:${mm}.`
  }

  // "כמה ימים עד סוף החודש / סוף השבוע / <holiday>" — deterministic days-until count.
  const du = daysUntilAnswer(text, now)
  if (du) return du

  // "יום <weekday> הבא" — next occurrence of a weekday, deterministic from ctx.now.
  const nw = nextWeekdayAnswer(text, now)
  if (nw) return nw

  // "בעוד N ימים/שבוע/שבועיים" — forward date arithmetic from ctx.now (deterministic).
  const addD = beodDaysOffset(text)
  if (addD) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() + addD.days)
    const day = HE_DAYS[d.getDay()] ?? ''
    return `בעוד ${addD.label} יהיה ${day}, ${dateWithoutDay(localISO(d))}.`
  }

  // "לפני N ימים/שבוע/שבועיים" — backward date arithmetic from ctx.now (deterministic).
  const subD = lifneiDaysOffset(text)
  if (subD) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() - subD.days)
    const day = HE_DAYS[d.getDay()] ?? ''
    return `${subD.label} היה ${day}, ${dateWithoutDay(localISO(d))}.`
  }

  // Next-holiday question — deterministic table, never the LLM (no hallucinated date).
  if (HOLIDAY_QUERY_RE.test(text)) {
    const specific = askedHoliday(text)
    const nh = nextHoliday(now, specific)
    if (!nh) {
      return specific
        ? `אין לי כרגע את התאריך המדויק של ${specific} הבא.`
        : 'אין לי כרגע את התאריך של החג הבא.'
    }
    const dateOnly = dateWithoutDay(nh.iso)
    return specific
      ? `${nh.name} הבא — ${dateOnly}.`
      : `החג הבא הוא ${nh.name} — ${dateOnly}.`
  }

  // Relative day/date ("אתמול"/"שלשום"/"מחר"/"מחרתיים") — computed from ctx.now, never
  // the LLM. Returning TODAY for a yesterday/tomorrow question is confidently wrong.
  const rel = relativeDayOffset(text)
  if (rel) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    d.setDate(d.getDate() + rel.off)
    if (looksSpanishDate(text)) {
      const lead = rel.off < 0 ? rel.esPast : rel.esFut
      return `${lead} ${SP_DAYS[d.getDay()]}, ${d.getDate()} de ${SP_MONTHS[d.getMonth()]} de ${d.getFullYear()}.`
    }
    const day = HE_DAYS[d.getDay()] ?? ''
    const dateOnly = dateWithoutDay(localISO(d))
    const verb = rel.off < 0 ? 'היה' : 'יהיה'
    return `${rel.he} ${verb} ${day}, ${dateOnly}.`
  }

  const day = HE_DAYS[now.getDay()] ?? 'היום'
  // formatHebrewDate may already include the weekday — strip it so we never say the
  // day twice ("היום יום שישי, 3 ביולי 2026, יום שישי").
  const dateOnly = dateWithoutDay(localISO(now))
  // "מה התאריך" → lead with the date; "איזה יום" → lead with the day.
  if (/תאריך|fecha/iu.test(text)) return `היום ${dateOnly}, ${day}.`
  return `היום ${day}, ${dateOnly}.`
}
function safeHebrewDate(iso: string): string {
  try { return formatHebrewDate(iso) } catch { return iso }
}

// ── Math / percent / tip reasoner — deterministic arithmetic (the LLM is unreliable at
// math). Returns a formatted answer or null when the text is not a computable expression
// (so "כמה עולה חלב" — a price — still routes online). Hebrew + Rioplatense operator words.
const NUM = '(\\d+(?:[.,]\\d+)?)'
const fmtNum = (n: number) => Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString()
function toNum(s: string): number { return parseFloat(s.replace(',', '.')) }

// Deterministic unit conversions ("3 קילומטר במטרים" → 3000, "30 מעלות צלזיוס בפרנהייט" → 86).
// Same-dimension only; a price or mismatched units returns null (still routes online/LLM).
type UnitDef = { re: RegExp; dim: string; factor: number }
const UNIT_DEFS: UnitDef[] = [
  { re: /קילומטר|ק"מ|kil[óo]metros?/iu, dim: 'len', factor: 1000 },
  { re: /סנטימטר|ס"מ|cent[íi]metros?/iu, dim: 'len', factor: 0.01 },
  { re: /מטר(?:ים)?|metros?/iu, dim: 'len', factor: 1 },
  { re: /קילוגרם|קילו(?!מטר)|ק"ג|kilos?/iu, dim: 'mass', factor: 1000 },
  { re: /גרם|gramos?/iu, dim: 'mass', factor: 1 },
  { re: /ליטר|litros?/iu, dim: 'vol', factor: 1000 },
  { re: /מיליליטר|מ"ל/iu, dim: 'vol', factor: 1 },
]
const QTY_RE = /(-?\d+(?:[.,]\d+)?|שלושת\s+רבעי|חצי|רבע)/u
function parseQty(s: string): number {
  if (/^שלושת/.test(s)) return 0.75
  if (s === 'חצי') return 0.5
  if (s === 'רבע') return 0.25
  return toNum(s)
}
function convertUnits(t: string): string | null {
  // Temperature (special formula, not a linear factor).
  const hasC = /צלזיוס|celsius/iu.test(t), hasF = /פרנהייט|fahrenheit/iu.test(t)
  if (hasC && hasF) {
    const qm = t.match(/(-?\d+(?:[.,]\d+)?)/u); if (!qm) return null
    const q = toNum(qm[1]!)
    const cFirst = t.search(/צלזיוס|celsius/iu) < t.search(/פרנהייט|fahrenheit/iu)
    return cFirst
      ? `${fmtNum(q)} מעלות צלזיוס זה ${fmtNum(q * 9 / 5 + 32)} מעלות פרנהייט.`
      : `${fmtNum(q)} מעלות פרנהייט זה ${fmtNum((q - 32) * 5 / 9)} מעלות צלזיוס.`
  }
  // Linear conversions: qty + FROM unit + ב/ל + TO unit (same dimension).
  const qm = t.match(QTY_RE); if (!qm) return null
  const qty = parseQty(qm[1]!)
  const found = UNIT_DEFS.map(u => ({ u, idx: t.search(u.re) })).filter(x => x.idx >= 0).sort((a, b) => a.idx - b.idx)
  if (found.length < 2) return null
  const from = found[0]!.u, to = found[1]!.u
  if (from.dim !== to.dim) return null
  const res = qty * from.factor / to.factor
  const toWord = (t.match(to.re) ?? [''])[0]
  return `זה יוצא ${fmtNum(res)} ${toWord}.`
}

export function mathReasoner(text: string): string | null {
  const t = text.trim()
  const conv = convertUnits(t)
  if (conv) return conv
  const es = /[¿ñ]|cu[aá]nto\s+es|por\s+ciento|de\s+propina/iu.test(t)
  // 1) Percent TIP: "N אחוז טיפ על M (שקל)" / "N% de propina sobre M".
  let m = t.match(new RegExp(`${NUM}\\s*(?:%|אחוז|por\\s*ciento)\\s*(?:טיפ|tip|propina)\\s*(?:על|de|sobre)\\s*${NUM}`, 'iu'))
  if (m) {
    const p = toNum(m[1]!), base = toNum(m[2]!); const tip = base * p / 100; const total = base + tip
    const cur = /שקל|₪/.test(t) ? ' שקל' : (/\$|דולר/.test(t) ? ' דולר' : '')
    return es
      ? `Una propina del ${fmtNum(p)}% sobre ${fmtNum(base)} es ${fmtNum(tip)}, y en total ${fmtNum(total)}.`
      : `טיפ של ${fmtNum(p)}% על ${fmtNum(base)}${cur} הוא ${fmtNum(tip)}${cur}, ובסך הכל ${fmtNum(total)}${cur}.`
  }
  // 2) Percent OF: "N אחוז מ(-)M" / "N% de M".
  m = t.match(new RegExp(`${NUM}\\s*(?:%|אחוז|por\\s*ciento)\\s*(?:מ[־-]?|de)\\s*${NUM}`, 'iu'))
  if (m) {
    const p = toNum(m[1]!), base = toNum(m[2]!); const res = base * p / 100
    return es ? `El ${fmtNum(p)}% de ${fmtNum(base)} es ${fmtNum(res)}.` : `${fmtNum(p)}% מ-${fmtNum(base)} זה ${fmtNum(res)}.`
  }
  // 3) Binary op: "A <op> B" (×, ÷, +, −) — Hebrew/Spanish words or symbols.
  // Word operators (unambiguous) + true math symbols (× ÷). ASCII + - * / are DELIBERATELY
  // excluded — they collide with times/dates/ratios ("3-5", "ב-3"), which are not math.
  m = t.match(new RegExp(`${NUM}\\s*(כפול|פעמים|חלקי|לחלק\\s+ב|ועוד|פלוס|מינוס|פחות|por|dividido(?:\\s+por)?|m[áa]s|menos|[×÷])\\s*${NUM}`, 'iu'))
  if (m) {
    const a = toNum(m[1]!), op = m[2]!, b = toNum(m[3]!)
    let res: number | null = null
    if (/כפול|פעמים|por|×/i.test(op)) res = a * b
    else if (/חלקי|לחלק|dividido|÷/i.test(op)) res = b === 0 ? null : a / b
    else if (/ועוד|פלוס|m[áa]s/i.test(op)) res = a + b
    else if (/פחות|מינוס|menos/.test(op)) res = a - b
    if (res === null) return es ? 'No se puede dividir por cero.' : 'אי אפשר לחלק באפס.'
    return es ? `Son ${fmtNum(res)}.` : `זה יוצא ${fmtNum(res)}.`
  }
  return null
}
export function isMathQuery(text: string): boolean { return mathReasoner(text) !== null }

// FamilyRelationReasoner
function looksLikeFamilyQuery(t: string): boolean {
  // Base + POSSESSIVE spouse forms ("בעלה" her-husband, "אשתו"/"אשתה" his/her-wife) so a
  // common family question routes to the graph instead of punting to the LLM.
  if (/מי\s+ה?(?:סבא|סבתא|דוד|דודה|אבא|אמא|בעל[הוהּ]?|איש[הת][הו]?|אשת[הו]|חתן|כלה|גיס|גיסה|נין|נינה|בן\s+הזוג|בת\s+הזוג|בת|בן|ילדים|נכדים|נכדות|נכד|נכדה|אח|אחות)\s+של/u.test(t)) return true
  // "כמה נכדים/ילדים/נינים יש ל…" — a family COUNT question, answered from the graph.
  if (/כמה\s+(?:נכד|ילד|בנ|נינ)/u.test(t)) return true
  if (/מה\s+הקשר\s+בין|מה\s+היחס\s+בין|איך\s+קשור[הים]?|מי\s+ז[הא]\s+ל/u.test(t)) return true
  // Spanish "¿qué relación hay entre X y Y?" / "relación entre X y Y" — a relation question.
  if (/relaci[óo]n\s+(?:hay\s+)?entre\s+/iu.test(t)) return true
  // "מה/מי (זה)? X עבור/בשביל Y" — a directional relation question. Recognized even
  // when X is UNKNOWN, so the runtime answers "won't guess" instead of the LLM.
  if (/(?:מה|מי)\s+(?:ז[הא]\s+)?\S+\s+(?:עבור|בשביל)\s+\S+/u.test(t)) return true
  // "מי זה X" / Spanish "quién es X" for a known family member (G2).
  const m = t.match(/^מי\s+ז[הא]\s+(\S+)\s*\??$/u)
  if (m && findNode(m[1]!)) return true
  const esm = t.match(/qui[eé]n\s+es\s+(?:la\s+|el\s+)?([a-záéíóúñ]+)/i)
  if (esm && findNode(esm[1]!)) return true
  // Guard the WEAK 2-names heuristic: a sentence carrying day+time (a scheduling
  // request that merely mentions two relatives, e.g. "אופיר … מחר בשלוש … גלעד …")
  // is a calendar meeting, NOT a relation question — never misroute it to family.
  if (DAY_CUE.test(t) && TIME_CUE.test(t)) return false
  return knownFamilyNamesIn(t).length >= 2
}
function knownFamilyNamesIn(t: string): GraphNode[] {
  const graph = loadGraph()
  const found: GraphNode[] = []
  const seen = new Set<string>()
  for (const node of graph) {
    for (const name of node.matchNames) {
      if (name.length >= 2 && t.includes(name) && !seen.has(node.canonical)) {
        seen.add(node.canonical); found.push(node); break
      }
    }
  }
  return found
}

// Resolve a possessive pronoun ("... שלה/שלו/שלהם") to the last family subject, so a
// follow-up ("ומי אמא שלה?") reuses the person just discussed. Only fires when there is
// an antecedent AND no explicit known family name in the turn (an explicit name wins).
export function resolveFamilyPronoun(text: string, antecedent: string | null): string {
  if (!antecedent) return text
  if (knownFamilyNamesIn(text).length > 0) return text
  if (!/של[הו](?![א-ת])|שלהם(?![א-ת])/u.test(text)) return text
  return text.replace(/שלהם(?![א-ת])/u, `של ${antecedent}`).replace(/של[הו](?![א-ת])/u, `של ${antecedent}`)
}

// "כמה נכדים/ילדים/נינים יש ל<X>" — a COUNT from the graph (deterministic, never guessed).
// The subject is the named person, or Martita ("כמה נכדים יש לי" — she is the user).
const FAMILY_COUNT_RE = /כמה\s+(נכד(?:ים|ות)?|ילד(?:ים|ות)?|בנ(?:ים|ות)|נינ(?:ים|ות)?)/u
function joinHe(list: string[]): string {
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} ו${list[list.length - 1]}`
}
export function familyCountReasoner(text: string): FamilyResult | null {
  const m = text.match(FAMILY_COUNT_RE)
  if (!m) return null
  const names = knownFamilyNamesIn(text)
  const explicit = names.length > 0
  const subject = names[0]?.hebrew ?? 'מרטיטה'
  const kind = m[1]!
  let list: string[]; let noun: string
  if (/^נכד/.test(kind)) { list = grandchildrenOfPublic(subject); noun = 'נכדים' }
  else if (/^נינ/.test(kind)) { list = greatGrandchildrenOfPublic(subject); noun = 'נינים' }
  else { list = childrenOfPublic(subject); noun = 'ילדים' }
  if (list.length === 0) return { text: '', known: false, subject }
  const poss = explicit ? `ל${subject}` : 'לך'
  return { text: `יש ${poss} ${list.length} ${noun}: ${joinHe(list)}.`, known: true, subject }
}

// `subject` = the person the question was ABOUT (the named X), so the runtime can
// remember it as the antecedent for a later pronoun ("ומי אמא שלה?" → her = that person).
export interface FamilyResult { text: string; known: boolean; pair?: { a: string; b: string }; subject?: string }
export function familyReasoner(text: string, lang: Lang = 'he'): FamilyResult {
  // Count query ("כמה נכדים יש למרטיטה") — answered from the graph before anything else.
  const count = familyCountReasoner(text)
  if (count && count.known) return count
  // 0) Directional pairwise "what is X for Y" / "הקשר בין X ל-Y" / Spanish "relación entre
  // X y Y" — the graph kinship engine (correct direction + gender + great-uncle/in-laws),
  // rendered in the query's language. Preferred over the symmetric describeRelation.
  const relLang: 'he' | 'es' = /relaci[óo]n\s+(?:hay\s+)?entre|qu[eé]\s+es\s+\S+\s+para/i.test(text) || lang === 'es' ? 'es' : 'he'
  const pair = answerRelationQuery(text, relLang)
  if (pair) return { text: pair.sentence, known: pair.known, pair: { a: pair.subject, b: pair.target } }

  // 1) "who is the <relation> of <person>" — deterministic multi-answer.
  const rel = answerFamilyRelation(text)
  if (rel) {
    const subject = findNode(rel.subject)?.hebrew ?? rel.subject
    if (!rel.known || rel.results.length === 0) return { text: '', known: false, subject }
    return { text: rel.results.join(', '), known: true, subject }
  }
  // 2) pairwise relation between two known names.
  const names = knownFamilyNamesIn(text)
  if (names.length >= 2) {
    const desc = describeRelation(names[0]!.hebrew, names[1]!.hebrew, 'he')
    if (desc) return { text: desc, known: true }
    return { text: '', known: false }
  }
  // 3) "מי זה X" / Spanish "quién es X" — describe the single member's role from the
  // graph, in the query's language (describeRelation renders 'es' too → "Abu es madre
  // de Mor"). G2: a Spanish identity query must be grounded, never punted to the LLM.
  const heMatch = text.match(/^מי\s+ז[הא]\s+(\S+)\s*\??$/u)
  // Spanish "¿quién es X?" — tolerate a leading "¿" and trailing "?"/"¿" that the ^
  // anchor previously rejected, and render the answer in Spanish regardless of the
  // coarse lang flag (the query itself is unambiguously Spanish).
  const esMatch = text.match(/^\s*¿?\s*qui[eé]n\s+es\s+(?:la\s+|el\s+)?([a-záéíóúñ]+)\s*[?¿]*$/i)
  const m = heMatch ?? esMatch
  if (m) {
    const node = findNode(m[1]!)
    if (node) {
      const renderLang = esMatch ? 'es' : (lang === 'es' ? 'es' : 'he')
      const self = describeRelation('מרטיטה', node.hebrew, renderLang)
      if (self) return { text: self, known: true, subject: node.hebrew }
    }
  }
  // 4) "מי <relation-phrase>" — close the phrase-not-resolved archetype in the FAMILY
  // domain with the SAME resolver the calendar uses ("החתן של רפי" → גלעד), so a relation
  // phrase resolves to the person here too instead of punting to the LLM (Leo's stale
  // round: "מי החתן של רפי" / "מי הכלה של רפי" fell to the model). Fallback only — the
  // direct relation/identity lookups above already own their cases.
  const whoPhrase = text.match(/^\s*מי\s+(?:ז[הא]\s+)?(.+?)\s*\??$/u)
  if (whoPhrase) {
    const resolved = resolvePersonPhrase(whoPhrase[1]!.trim())
    if (resolved) {
      const g = findNode(resolved)?.gender
      const verb = g === 'female' ? 'היא' : 'הוא'
      return { text: `${whoPhrase[1]!.trim()} ${verb} ${resolved}.`, known: true, subject: resolved }
    }
  }
  return { text: '', known: false }
}

// CalendarReasoner (reads) — grounded on real storage; empty store never invents.
export function calendarReadReasoner(text: string, now: Date): string {
  // "מה יש לי השבוע" reads the whole week — never collapse to a single day.
  if (/(?<![א-ת])השבוע(?![א-ת])/u.test(text)) {
    const r = getWeekEvents()
    return r.events.length === 0 ? 'השבוע אין כלום ביומן. שבוע שקט.' : r.summary
  }
  if (/(?<![א-ת])מחרתיים(?![א-ת])/u.test(text) || /בעוד\s+יומיים/u.test(text)) {
    const d = new Date(now); d.setDate(d.getDate() + 2)
    const r = getEventsByDate(localISO(d))
    return r.events.length === 0 ? 'מחרתיים אין כלום ביומן.' : r.summary
  }
  if (/(?<![א-ת])מחר(?![א-ת])/u.test(text)) {
    const r = getTomorrowEvents()
    return r.events.length === 0 ? 'מחר אין כלום. יום שקט.' : r.summary
  }
  if (/(?<![א-ת])היום(?![א-ת])/u.test(text)) {
    const r = getTodayEvents()
    return r.events.length === 0 ? 'היום אין כלום ביומן.' : r.summary
  }
  // Named weekday ("מה יש לי ביום חמישי", "בשבת") → its NEXT occurrence (today if
  // today is that weekday). Reading TODAY for a named-day question hides real events.
  const wd = text.match(/(?:ביום\s+|יום\s+|ב)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?![א-ת])/u)
  if (wd && HE_WEEKDAY_IDX[wd[1]!] !== undefined) {
    const target = HE_WEEKDAY_IDX[wd[1]!]!
    const add = (target - now.getDay() + 7) % 7
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() + add)
    const r = getEventsByDate(localISO(d))
    const label = wd[1] === 'שבת' ? 'בשבת' : `ביום ${wd[1]}`
    return r.events.length === 0 ? `${label} אין כלום ביומן.` : r.summary
  }
  // otherwise read the specific day if we can, else today.
  const r = getEventsByDate(localISO(now))
  return r.events.length === 0 ? 'אין כלום ביומן ליום הזה.' : r.summary
}

// CalendarSearchReasoner — search ALL calendar for a person/type, never ask "באיזה יום".
export function calendarSearchReasoner(text: string): string {
  // Capture the person PHRASE after עם/אצל (up to a question word / temporal cue) so a
  // relation phrase ("החתן של רפי") is kept WHOLE, then resolve it to the real person
  // (→ גלעד). Root of Leo's catastrophe: the search grabbed only "החתן" and never resolved
  // it, so it could not find the event she had just created by that same phrase.
  const nameMatch = text.match(/(?:עם|אצל)\s+([֐-׿][֐-׿ ]*?)(?=\s*[?.!]|\s+(?:איזה|מתי|באיז|כמה|זה)|\s+ב?(?:יום|מחר|היום|מחרתיים|השבוע|שעה)|\s*$)/u)
  const phrase = nameMatch?.[1]?.trim() ?? null
  if (phrase) {
    // A meeting query ("מתי הפגישה עם X") excludes birthdays; a birthday query keeps them.
    const meetingOnly = /פגישה|תור|נפגש|נפגשת/u.test(text) && !/יום\s+הולדת|הולדת|יומולדת/u.test(text)
    const resolved = resolvePersonPhrase(phrase)
    const displayName = resolved ?? phrase
    // Try the resolved person, the whole phrase, then its first word (robust to save form).
    const candidates = [resolved, phrase, phrase.split(/\s+/)[0]!].filter((c): c is string => !!c)
    let events: ReturnType<typeof findEventsByPerson>['events'] = []
    for (const cand of candidates) {
      const r = findEventsByPerson(cand, meetingOnly)
      if (r.events.length) { events = r.events; break }
    }
    if (events.length === 0) return `אין לך פגישה עם ${displayName} ביומן.`
    // Leo's rule: a "when / which-day" search answers DAY + DATE + TIME, never only the hour.
    const fmtEv = (ev: typeof events[number]) => {
      const dayDate = ev.date ? `ב${safeHebrewDate(ev.date)}` : ''
      const t = ev.time ? ` בשעה ${ev.time}` : ''
      return `${ev.title} ${dayDate}${t}`.replace(/\s{2,}/g, ' ').trim()
    }
    if (events.length === 1) return `${fmtEv(events[0]!)}.`
    return `מה שיש לך עם ${displayName}:\n${events.map((e) => `📌 ${fmtEv(e)}`).join('\n')}`
  }
  const all = loadAppointments()
  // Search by PLACE ("פגישה בקפה מורנו") — match the venue phrase against stored
  // locations. Never invents; grounded only in what is saved.
  const placePhrase = (text.match(/(?<![א-ת])ב(?:קפה\s+|בית\s+קפה\s+|מסעד[הת]\s+|משרד\s+)?([֐-׿][֐-׿ ]{1,})/u)?.[1] ?? '').trim()
  const placeWords = placePhrase.split(/\s+/).filter(w => w.length >= 3)
  if (placeWords.length) {
    const hits = all.filter(a => a.location && placeWords.some(w => a.location!.includes(w)))
    if (hits.length === 1) {
      const h = hits[0]!
      return `יש לך ${h.title}${h.time ? ` בשעה ${h.time}` : ''}${h.location ? `, ${h.location}` : ''}.`
    }
    if (hits.length > 1) return `יש לך ${hits.length} פגישות שם ביומן.`
    return 'לא מצאתי פגישה במקום הזה ביומן.'
  }
  if (all.length === 0) return 'היומן ריק.'
  return `יש לך ${all.length} דברים ביומן.`
}

// Bare property questions about the calendar event currently IN FOCUS (after a
// person-search). These continue the object — answered from the found event,
// never re-searched, never punted to the LLM ("Never search again").
const CAL_PROPERTY_RE = /^(?:ב?איזה\s+שעה|באיזו\s+שעה|ב?איזה\s+יום(?:\s+ה?פגישה|\s+ה?תור)?|מתי\s+היא|מתי\s+זה|מתי\s+ה?פגישה|מתי\s+ה?תור|איפה(?:\s+זה|\s+זה\s+יהיה)?|באיזה\s+מקום|מה\s+הכתובת|איפה\s+זה|עם\s+מי|כמה\s+זמן|כמה\s+שעות|כמה\s+זמן\s+זה)\s*\??$/u
// An imperative edit of a STORED event ("תשני לארבע", "עדכני את הפגישה") when NO
// draft is pending. We never silently mutate a saved event and never punt to the
// LLM — we answer honestly and ask her to confirm which event + what to change.
const STORED_EDIT_RE = /^(?:תשנ[יה]|שנ[יה]|ל?שנות|תעדכנ[יי]?|עדכנ[יי]?|תזיז[יי]?|להזיז|תדחה|תדחי|לדחות|תקדימ[יי]?)(?![א-ת])/u
// A property question that REFERS to the focused event via a PRONOUN or the noun
// "פגישה" — even wrapped in filler ("איפה אני פוגשת אותו?", "עם מי הפגישה?",
// "מתי אני נפגשת איתו?"). General (not a phrase list): a property CUE + a reference
// to the focus + NO other explicit person (a named "עם/אצל <someone-else>" is a fresh
// search, handled downstream). The bare forms ("איפה?", "באיזו שעה?") are already
// covered by CAL_PROPERTY_RE; this adds the referring-pronoun phrasings.
const CAL_PROP_CUE = /(?:איפה|באיז[הו]\s+שעה|באיז[הו]\s+יום|מה\s+ה?שעה|(?<![א-ת])מתי(?![א-ת])|באיזה\s+מקום|מה\s+ה?כתובת|עם\s+מי|כמה\s+זמן|כמה\s+שעות)/u
const CAL_FOCUS_REF = /(?:אות[הו]|אית[הו]|(?<![א-ת])ז[הו]א?(?![א-ת])|ה?פגיש\S*|ה?תור(?![א-ת])|ה?מפגש|ה?ביקור)/u
// A person named via עם/אצל/את (NOT the interrogative "מי"). The UI may resolve a
// pronoun ("אותו") to the person's NAME before the runtime, so "איפה אני פוגשת את
// רפי?" must still bind to the focused event when רפי IS the focus.
const CAL_NAMED_PERSON = /(?:עם|אצל|את)\s+(?!מי(?![א-ת]))([א-ת]{2,})/u
export function isFocusPropertyQuery(t: string, focusLabel?: string | null): boolean {
  if (!CAL_PROP_CUE.test(t)) return false
  const personM = t.match(CAL_NAMED_PERSON)
  if (personM) {
    // Same person as the focus → a property of the focused event; a DIFFERENT named
    // person → re-search, not focus-read.
    const named = personM[1]!
    if (focusLabel && (named === focusLabel || named.includes(focusLabel) || focusLabel.includes(named))) return true
    return false
  }
  return CAL_FOCUS_REF.test(t)
}
export function extractSearchPerson(text: string): string | null {
  const m = text.match(/עם\s+([֐-׿]{2,})|אצל\s+([֐-׿]{2,})/u)
  return m?.[1] ?? m?.[2] ?? null
}
export function answerCalendarProperty(text: string, person: string): string | null {
  const r = findEventsByPerson(person, true)
  if (r.events.length === 0) return null
  // The referent of a focus property query ("איפה אני פוגשת אותו?") right after a create
  // is the event JUST set up — the most-recently-created match, not the oldest. Insertion
  // order is creation order, so take the last match (older same-person events must not
  // shadow the fresh one with the location/time the user is asking about).
  const ev = r.events[r.events.length - 1]!
  // WHEN / DAY — Leo's rule: a day/when answer ALWAYS carries DAY + DATE + TIME, never
  // only the hour (the stale-round failure: "באיזה יום" answered three times with just
  // the hour). safeHebrewDate → "יום שני, 20 ביולי 2026".
  if (/באיזה\s+יום|איזה\s+יום|(?<![א-ת])מתי(?![א-ת])/u.test(text)) {
    const dayDate = ev.date ? `ב${safeHebrewDate(ev.date)}` : ''
    const timePart = ev.time ? ` בשעה ${ev.time}` : ''
    if (!dayDate && !timePart) return `עוד לא רשמתי מתי הפגישה עם ${person}.`
    return `הפגישה עם ${person} ${dayDate}${timePart}.`.replace(/\s{2,}/g, ' ').trim()
  }
  // Hour specifically ("באיזה שעה") — answer the hour.
  if (/שעה/u.test(text)) {
    if (!ev.time) return `עוד לא רשמתי שעה לפגישה עם ${person}.`
    return `הפגישה עם ${person} בשעה ${ev.time}.`
  }
  if (/איפה|מקום|כתובת/u.test(text)) return ev.location ? `הפגישה עם ${person} ${/^ב/u.test(ev.location) ? ev.location : 'ב' + ev.location}.` : `עוד לא רשמתי מקום לפגישה עם ${person}.`
  if (/עם\s+מי/u.test(text)) return `הפגישה היא עם ${ev.personName ?? person}.`
  if (/כמה\s+זמן|כמה\s+שעות/u.test(text)) return `עוד לא רשמתי כמה זמן תימשך הפגישה עם ${person}.`
  return null
}

// FrustrationRecoveryReasoner — address the frustration specifically, never a
// template apology, never the same sentence twice.
const FRUSTRATION_REPLIES = [
  'את צודקת, לא הייתי מספיק ברורה. תגידי לי שוב במילים שלך ואני איתך.',
  'סליחה, בואי ננסה אחרת — מה בדיוק את רוצה שאעשה?',
  'אני מקשיבה. תגידי לי בדיוק מה חשוב לך עכשיו ואני אתמקד בזה.',
]
export function frustrationReasoner(state: RuntimeState): { text: string; state: RuntimeState } {
  // Prefer a concrete continuation/repair when there is cached context.
  const r = repair(state.conv, '')
  const hasContext = !!(state.conv.answer || state.conv.online)
  if (hasContext && r.text) {
    return { text: r.text, state: { ...state, conv: r.state, frustrationCount: state.frustrationCount + 1 } }
  }
  const idx = state.frustrationVariant % FRUSTRATION_REPLIES.length
  return {
    text: FRUSTRATION_REPLIES[idx]!,
    state: { ...state, frustrationCount: state.frustrationCount + 1, frustrationVariant: idx + 1 },
  }
}

// ── Layer 6: Action Executor (real save + verify) ──────────────────────────────
export interface SaveOutcome { ok: boolean; text: string }
function executeSave(draft: {
  title?: string | null; date?: string | null; time?: string | null; emoji?: string
  location?: string | null; subject?: string | null; purpose?: string | null
  notes?: string | null; person?: string | null; lang?: 'he' | 'es'
}, lang: 'he' | 'es' = 'he'): SaveOutcome {
  const es = lang === 'es'
  const saveFailed = es ? 'Algo se trabó — no se guardó. Probá de nuevo.' : 'משהו לא עבד — הפגישה לא נשמרה. תנסי שוב.'
  if (!draft.title || !draft.date || !draft.time) {
    return { ok: false, text: es ? 'Me falta un dato para agendar — ¿qué, qué día y a qué hora?' : 'חסר לי פרט כדי לשמור — מה, מתי ובאיזו שעה?' }
  }
  const res = createAppointmentSafe({
    title: draft.title, date: draft.date, time: draft.time, emoji: draft.emoji ?? '📅',
    ...(draft.location ? { location: draft.location } : {}),
    ...(draft.subject ? { subject: draft.subject } : {}),
    ...(draft.purpose ? { purpose: draft.purpose } : {}),
    ...(draft.notes ? { notes: draft.notes } : {}),
    ...(draft.person ? { personName: draft.person } : {}),
  })
  if (!res.ok) return { ok: false, text: saveFailed }
  // Verify the write actually persisted (no fake-save).
  const verified = loadAppointments().find(a =>
    a.id === res.appointment.id ||
    (a.title === draft.title && a.date === draft.date && (a.time ?? null) === (draft.time ?? null)))
  if (!verified) return { ok: false, text: saveFailed }
  // Conflict awareness: the event is still saved (additive, never destructive), but
  // warn warmly if she already has something at the same date+time — so she isn't
  // silently double-booked.
  const clash = loadAppointments().find(a => a.id !== verified.id && a.date === verified.date && a.time === verified.time)
  if (es) {
    const esWarn = clash ? `Ojo — ya tenés ${clash.title} a esa hora. ` : ''
    return { ok: true, text: `${esWarn}${shapeCreateSavedES({ title: verified.title, date: verified.date, time: verified.time, person: draft.person ?? null })}` }
  }
  const heDate = safeHebrewDate(verified.date)
  const loc = verified.location ? ` ${/^(?:ב|ל|מ|אצל)/u.test(verified.location) ? verified.location : 'ב' + verified.location}` : ''
  const warn = clash ? `שימי לב — כבר יש לך ${clash.title} באותו זמן. ` : ''
  return { ok: true, text: `${warn}קבוע — ${verified.title} ${heDate} בשעה ${verified.time}.${loc}` }
}

// ── Layer 7: Response Verifier ─────────────────────────────────────────────────
// NOTE: no \b — it never matches Hebrew (ASCII-only), which had left this guard dead.
const PROMISE_WITHOUT_RESULT = /(?:אני\s+אבדוק|אני\s+תבדוק|(?:^|\s)אבדוק|תכף\s+אבדוק|אחזור\s+אלייך|רגע\s+אחד\s+אני\s+בודקת)/u
// Known broken-Hebrew forms (Phase 9) — wrong conjugation / garbled register.
const BROKEN_HEBREW = /אני\s+תבדוק|תקבילי|אחורה\s+צהריים|(?:^|\s)לך\s+היום\?|(?:^|\s)אני\s+כאן\?/u
const CANT_CHECK = /לא\s+מצליחה\s+לבדוק|אני\s+לא\s+יכולה\s+לבדוק|אין\s+לי\s+גישה/u
const GENERIC_FALLBACK = /מה\s+היה\s+הנושא|אני\s+לא\s+מצליחה\s+לזכור|לא\s+הבנתי\s+כלום/u
const ASK_WHICH_DAY = /באיזה\s+יום|באיזו\s+שעה|מתי\s+בדיוק/u
const BROKEN_FRAGMENT = /com\]\(|cbsnews|https?:\/\/|\]\(|\bhttp\b/u
const DOUBLE_PREP = /באצל/u  // "באצלי בבית" — ב + אצל double preposition (no \b: ASCII-only, never matches Hebrew)

/**
 * The gate every terminal answer passes. `dataAvailable` means a tool/session
 * actually returned an answer — so "I can't check" would be a lie.
 */
export function verifyAnswer(
  answer: string,
  ctx: { intent: RuntimeIntent; dataAvailable: boolean },
): VerifierReport {
  const violations: string[] = []
  const a = answer ?? ''
  if (!a.trim()) violations.push('empty_answer')
  if (PROMISE_WITHOUT_RESULT.test(a)) violations.push('promise_without_result')
  if (BROKEN_HEBREW.test(a)) violations.push('broken_hebrew')
  if (ctx.dataAvailable && CANT_CHECK.test(a)) violations.push('cant_check_with_data')
  if (GENERIC_FALLBACK.test(a)) violations.push('generic_fallback')
  // A date query must ANSWER the date, never bounce it back as a question.
  if (ctx.intent === 'date_query' && ASK_WHICH_DAY.test(a)) violations.push('date_query_asks_back')
  // A calendar search must not ask "which day" — it searches all days.
  if (ctx.intent === 'calendar_search' && /באיזה\s+יום/u.test(a)) violations.push('search_asks_which_day')
  if (BROKEN_FRAGMENT.test(a)) violations.push('broken_fragment_or_url')
  if (DOUBLE_PREP.test(a)) violations.push('double_preposition')
  return { ok: violations.length === 0, violations }
}

// ── Layer 8: Hebrew Response Composer ──────────────────────────────────────────
/**
 * Compose the final Hebrew: answer-first, short, adult, warm. Reuses the proven
 * spoken-persona pass (strips menus/assistant register/URLs, naturalises jargon,
 * caps length). Display text keeps the same shaping so chat and voice agree.
 */
export function composeHebrew(text: string): { display: string; speak: string } {
  const speak = toSpokenText(text)
  // Display can be a touch longer than the spoken soft-cap, but must stay clean.
  const display = (speak && speak.length >= Math.min(text.length, 40)) ? text.trim() : (speak || text.trim())
  return { display: display || text.trim(), speak: speak || text.trim() }
}

// ── Create-flow locale (§20.2 "remain in Spanish") ─────────────────────────────
// The create's language is REMEMBERED on the draft so it stays Spanish across turns —
// a bare answer like "a las cuatro" detects as Hebrew on its own, so re-detecting per
// turn would flip locale mid-create.
type CreateLang = 'he' | 'es'
function createLangOf(state: RuntimeState, turnLang: Lang): CreateLang {
  const dl = state.createState.draft.lang
  if (dl === 'es' || dl === 'he') return dl
  return turnLang === 'es' ? 'es' : 'he'
}
/** Confirm/clarify text for a create draft in the create's language. */
function shapeCreatePrompt(cs: CalendarCreateState, lang: CreateLang): string {
  if (lang === 'es') {
    return cs.phase === 'confirming' ? shapeCreateConfirmES(cs.draft) : shapeCreateClarifyES(cs.missing)
  }
  return cs.phase === 'confirming' ? shapeCreateConfirm(cs.draft) : shapeCreateClarify(cs.missing, cs.draft)
}
/** Compose display/speak for create text — Spanish bypasses Hebrew persona shaping. */
function composeCreate(text: string, lang: CreateLang): { display: string; speak: string } {
  if (lang === 'es') { const t = text.trim(); return { display: t, speak: t } }
  return composeHebrew(text)
}
/** Stamp the create language onto a draft so it persists across turns. */
function withLang(cs: CalendarCreateState, lang: CreateLang): CalendarCreateState {
  return cs.draft.lang ? cs : { ...cs, draft: { ...cs.draft, lang } }
}

// ── Layer 9: TTS-safe output ───────────────────────────────────────────────────
function chunk(text: string): string[] {
  const c = planSpokenChunks(text)
  return c.length > 0 ? c : (text.trim() ? [text.trim()] : [])
}

// ── Entry point A: synchronous cognitive turn ──────────────────────────────────
/**
 * Every user turn passes through here FIRST. Returns a terminal decision
 * (`handled: true` with composed+verified answer) for every deterministic intent,
 * or `needsLLM`/`needsOnline` for prose/live-info the caller executes and then
 * feeds back through `finalizeExternalAnswer`.
 */
export function runCognitiveTurn(state: RuntimeState, raw: string, ctx: RuntimeContext): CognitiveDecision {
  // Layer 1: normalize.
  const norm = normalizeTurn(raw, ctx.messages)
  const original = norm.original, lang = norm.lang
  // Layer 1.5: Semantic Intelligence Engine — recover an imperfect STT transcript into
  // a canonical utterance BEFORE any downstream engine sees it ("קלי פגישה" →
  // "קבעי לי פגישה"; "מי זאת אופיר" → "מי זה אופיר"). Never trusts the raw transcript.
  let normalized = recoverTranscript(norm.normalized).text
  // Correction ("לא, התכוונתי <X>") → answer the CORRECTED request X, not a generic
  // reply. Strip the correction lead-in and process the clause that follows.
  const corr = normalized.match(/^לא[,.]?\s*(?:זה[,.]?\s*)?(?:התכוונתי|התכוונת|רציתי\s+לומר)\s+(.+)/u)
  if (corr && corr[1] && corr[1].trim().length >= 3) normalized = corr[1].trim()
  // While a calendar EVENT is in focus, a referential-pronoun turn ("תבטלי אותה" /
  // "תעבירי אותה" / "איפה אני פוגשת אותו") must stay RAW: normalizeInput resolves the
  // pronoun by GENDER to the last-mentioned person ("אותה"→"ארי"), which is the wrong
  // target and breaks referable cancel/move. The focus logic below resolves it correctly.
  {
    const rawT = original.trim()
    const hasEventPronoun = /(?<![א-ת])א(?:ות|ית)[הו](?![א-ת])/u.test(rawT)
    if (state.createState.phase === 'idle' && state.focus?.kind === 'calendar_event' && hasEventPronoun
        && (isReferentialDelete(rawT) || isModifyIntent(rawT) || CAL_PROP_CUE.test(rawT))) {
      normalized = rawT
    }
  }
  // ── STEP ZERO — Conversation continuity (before intent) ─────────────────────
  // If we are INSIDE an online topic (active focus) and this turn is a bare temporal
  // follow-up ("ומחר?"), continue that topic by re-querying online with the day
  // merged in — instead of the bare מחר token flipping to the calendar. Only fires
  // when there is NO pending draft (a draft's own field-answers win) and the focus
  // is fresh online. This is the "continue the current object, don't re-route" rule.
  // Test the ORIGINAL raw fragment — normalizeInput otherwise expands "ומחר?" into
  // a calendar query ("מה יש לי מחר") before we get here, which is the very hijack
  // we are undoing.
  if (state.createState.phase === 'idle' && state.focus?.kind === 'online' && ONLINE_TEMPORAL_FOLLOWUP_RE.test(original.trim())) {
    const day = original.trim().replace(/^(?:ו|בעצם\s+)/u, '').replace(/[?？]$/u, '').trim()
    normalized = `${state.focus.label} ${day}`.replace(/\s+/g, ' ').trim()
  }
  // Resume of an interrupted DRAFT ("תמשיכי") — normalizeInput may otherwise rewrite
  // it into a family/topic continuation using message context. While a draft is
  // pending, keep the raw resume word so V2 re-surfaces the pending confirm.
  if (state.createState.phase !== 'idle' && /^(?:ו?תמשיכי|תמשיך|המשיכי|נמשיך|בואי\s+נמשיך|נחזור\s+לפגישה)\s*[?.!]*$/u.test(original.trim())) {
    normalized = original.trim().replace(/^ו/, '')
  }
  // Layer 3: classify.
  const intent = classifyIntent(normalized, state)

  const base = { intent, lang, original, normalized }
  const settle = (
    rawAnswer: string,
    opts: { state: RuntimeState; dataAvailable: boolean; recordTopic?: string | null; lang?: CreateLang },
  ): CognitiveDecision => {
    const { display, speak } = opts.lang ? composeCreate(rawAnswer, opts.lang) : composeHebrew(rawAnswer)
    const verifier = verifyAnswer(display, { intent, dataAvailable: opts.dataAvailable })
    // Record the answer into conversation memory so "תמשיכי" / recall work next turn.
    let conv = opts.state.conv
    if (intent !== 'continuation' && intent !== 'frustration' && display && !isNonTopicTurn(normalized)) {
      conv = recordAnswer(conv, {
        question: normalized, intent, topic: opts.recordTopic ?? null, fullText: display,
      })
    }
    return {
      ...base, handled: true, display, speak, chunks: chunk(display),
      needsLLM: false, needsOnline: false, online: null, grounding: null,
      sideEffect: null, verifier,
      // A deterministic (non-online) answer ends any active online topic, so the
      // next bare "ומחר?" can't bind to a stale weather focus. It also ends any
      // pending communication (a normal answer means she moved on).
      state: { ...opts.state, conv, focus: null, lastIntent: intent, pendingCommunication: null },
    }
  }

  // ─── Degenerate input guard — never hand an empty/punctuation-only turn to the
  // LLM (garbled STT / mis-taps are common for an 80+ user). Answer warmly instead.
  if (!normalized.trim() || /^[\s\p{P}\p{S}]+$/u.test(normalized)) {
    return settle('לא שמעתי טוב. תגידי לי שוב?', { state, dataAvailable: false })
  }

  // ─── WhatsApp / call PRECEDENCE (before calendar) ────────────────────────────
  // "תכתבי/שלחי/תתקשרי ל<מישהו> …" is a communication action, NOT a calendar turn —
  // even when the message body says "מחר בערב". Without this, the date words route
  // the turn to calendar_read and Abu AI wrongly answers "מחר אין כלום ביומן".
  // The controller OWNS the classification (precedence) and DEFERS the async compose
  // to the caller via `decision.whatsapp` (handled:false, no LLM/online). Guarded to
  // idle create-state + no pending reminder so it can never hijack a pending draft.
  // detectWhatsAppTurn fires ONLY when the utterance LEADS with a write/send/call
  // verb (allowing a "לא פגישה," correction prefix), so a message that merely
  // mentions a meeting ("תכתבי למור שיש לי פגישה מחר") stays communication, while a
  // real "תקבעי פגישה…" create (whose embedded "…ותכתבי להביא…" is a note) is not
  // caught here and flows to calendar.
  // ── SINGLE OWNER: the communication engine (reduceGoal) arbitrates every
  // Call/WhatsApp turn — start, continue, correct, recipient-change, cancel,
  // switch. cognitiveRuntime no longer detects/refines communication itself; it
  // delegates and consumes the typed result. `pendingCommunication` holds the
  // engine's canonical ActiveGoal (the one authoritative communication state).
  const emitWhatsApp = (g: ActiveGoal): CognitiveDecision => {
    const wa: WhatsAppTurn = g.mode === 'call'
      ? { kind: 'call', targetName: g.recipientToken, targetHebrew: g.recipientHebrew, command: g.command }
      : { kind: 'compose', targetName: g.command?.targetName ?? g.recipientToken, targetHebrew: g.command?.targetHebrew ?? g.recipientHebrew, command: g.command }
    return {
      ...base, intent: 'whatsapp', handled: false,
      display: null, speak: null, chunks: [],
      needsLLM: false, needsOnline: false, online: null, grounding: null,
      sideEffect: null, verifier: { ok: true, violations: [] },
      whatsapp: wa,
      state: { ...state, lastIntent: 'whatsapp', focus: null, createState: IDLE_STATE, pendingReminder: null, pendingCommunication: g },
    }
  }

  {
    const cr = reduceGoal(state.pendingCommunication ?? null, { text: original.trim(), source: 'text' })
    if (cr.capability === 'communication' && cr.goal) {
      if (cr.turnKind === 'ACTION_START') {
        // A brand-new explicit command OWNS the turn even mid-draft (overrides a
        // stale calendar draft). It owns when it NAMES a recipient — resolved
        // ("מור") OR not ("לאה", a typo/unknown) — or is a call. An unresolved
        // name is clarified downstream; it must NEVER fall to general chat
        // (device failure B). detectWhatsAppTurn's leading-verb anchor already
        // protects a mid-draft note ("…ותכתבי להביא…"): no recipient token there.
        if (!!cr.goal.recipientHebrew || !!cr.goal.recipientToken || cr.goal.mode === 'call') return emitWhatsApp(cr.goal)
      } else if (state.createState.phase === 'idle') {
        // Continue / correct / recipient-change / meta-question — only when no
        // calendar draft is mid-flight (they are mutually exclusive).
        return emitWhatsApp(cr.goal)
      }
    } else if (state.pendingCommunication && cr.capability !== 'communication' && state.createState.phase === 'idle') {
      // The engine released ownership (cancel / switch / exit / general question)
      // — clear the goal and fall through to calendar / general routing.
      state = { ...state, pendingCommunication: null }
    }
  }

  // ─── CALENDAR CONTINUITY — property query on the event IN FOCUS ──────────────
  // After "מתי הפגישה עם מור?", a bare "באיזה שעה?/איפה?/עם מי?" answers FROM that
  // event (re-reading the store for the focused person), never re-searching and
  // never punting to the LLM. Runs only with a calendar focus + no pending draft.
  const propText = original.trim().replace(/^ו(?=[א-ת])/u, '') // "ובאיזו שעה?" → "באיזו שעה?"
  // Pass the focus label so a UI-resolved pronoun ("אותו"→"את רפי") still binds to the
  // focused event when it names the focus person (see isFocusPropertyQuery).
  if (state.createState.phase === 'idle' && state.focus?.kind === 'calendar_event'
      && (CAL_PROPERTY_RE.test(propText) || isFocusPropertyQuery(propText, state.focus.label))) {
    const ans = answerCalendarProperty(propText, state.focus.label)
    if (ans) {
      const res = settle(ans, { state, dataAvailable: true })
      // Keep the calendar focus so chained property questions continue to work.
      return { ...res, intent: 'calendar_read', state: { ...res.state, focus: state.focus } }
    }
  }

  // ─── Stored-event edit that the modify reasoner CANNOT handle (would punt to the
  // LLM) — answer honestly instead of a silent mutation or an LLM punt. The safe,
  // handled edits (feminine "תשני …") route to calendar_update below and are untouched.
  if (state.createState.phase === 'idle' && intent === 'general' && STORED_EDIT_RE.test(original.trim()) && loadAppointments().length > 0) {
    return settle('אני לא משנה אירוע שמור בלי שתאשרי לי בדיוק איזה אירוע ומה לשנות. תגידי לי איזו פגישה ומה השינוי ואני אטפל בזה.', { state, dataAvailable: true })
  }

  // ─── Ledger soft-confirm — a plainly-stated family fact is awaiting ONE "כן" (the
  // "one soft in-flow confirmation" door). Runs ONLY with a ledger fact pending, no
  // calendar draft, and no pending reminder — so it can never hijack the calendar "כן".
  if (state.pendingLedgerChange && state.createState.phase === 'idle' && !state.pendingReminder) {
    const t = original.trim()
    if (/^(?:כן|נכון|בסדר|אישור|כן\s+בבקשה|כן\s+תרשמי|תרשמי|רשמי|בהחלט|נכון\s+מאוד|אוקיי?)\s*[.!]*$/u.test(t)) {
      const o = ledgerCommit(state.pendingLedgerChange, ctx.now.getTime())
      return settle(o.reply, { state: { ...state, pendingLedgerChange: null }, dataAvailable: o.ok })
    }
    if (/^(?:לא|לא\s+נכון|עזבי|תעזבי|לא\s+צריך|בטלי|תבטלי)\s*[.!]*$/u.test(t)) {
      return settle('בסדר, לא רשמתי.', { state: { ...state, pendingLedgerChange: null }, dataAvailable: true })
    }
    state = { ...state, pendingLedgerChange: null } // any other turn abandons the pending fact
  }

  // ─── Ledger EXPLICIT write — "תזכרי ש<family/chapter fact>" writes through THE LAWS gate
  // BEFORE the memory/reminder split (so "תזכרי שדני אוהב כדורגל" is not mis-read as a
  // reminder). Fires ONLY for a parseable family/chapter fact (returns null otherwise), so a
  // real reminder / preference-memory / anything else is untouched.
  if (state.createState.phase === 'idle' && !state.pendingReminder) {
    const lw = ledgerWriteFromText(original.trim(), ctx.now.getTime())
    if (lw) return settle(lw.reply, { state, dataAvailable: lw.ok })
  }

  // ─── Conversation Engine v2 (flagged) — the FORMAL dialogue state machine owns the
  // pending / confirmation / side-question / why control + the search-vs-create
  // precedence (C/D). Everything else defers to the intent path below. No competing
  // logic runs when enabled: v2 returns terminal decisions or `defer`.
  if (conversationV2Enabled()) {
    const phase = state.createState.phase
    const { action, keepsPending } = reduceV2(phase, classifySignalV2(normalized, phase))
    const keptState = { ...state, createState: keepsPending ? state.createState : IDLE_STATE }
    // Language the pending create was started in — respond in it across turns (§20.2).
    const clang = createLangOf(state, lang)
    switch (action) {
      case 'execute_save': {
        const d = state.createState.draft
        const out = executeSave(d, d.lang ?? clang)
        const { display, speak } = composeCreate(out.text, d.lang ?? clang)
        // Focus the just-saved event's person so a follow-up "מה קבענו?/באיזה שעה?/
        // איפה?" answers from it (property continuity) instead of punting to the LLM.
        const savedPerson = d.person ?? ((d.title ?? '').replace(/^פגישה עם\s+/u, '').trim() || null)
        return {
          ...base, intent: 'confirmation', handled: true, display, speak, chunks: chunk(display),
          needsLLM: false, needsOnline: false, online: null, grounding: null,
          sideEffect: out.ok ? 'saved_appointment' : 'save_failed',
          verifier: verifyAnswer(display, { intent: 'confirmation', dataAvailable: true }),
          state: { ...state, createState: IDLE_STATE, lastIntent: 'confirmation', focus: (out.ok && savedPerson) ? { kind: 'calendar_event', label: savedPerson } : null },
        }
      }
      case 'cancel':
        return { ...settle(clang === 'es' ? shapeCreateCancelledES() : shapeCreateCancelled(), { state: { ...state, createState: IDLE_STATE }, dataAvailable: true, lang: clang }), intent: 'confirmation' }
      case 'audio_help':
        return { ...settle('רגע, אני פה. אם לא שמעת אותי, נסי להעלות את עוצמת הקול או ללחוץ שוב על הכפתור. מה שביקשת עדיין שמור.', { state: keptState, dataAvailable: true }), intent: 'audio_complaint' }
      case 'frustration_keep':
        return { ...settle('את צודקת. הפגישה עדיין שמורה כטיוטה — נמשיך ממנה כשתרצי.', { state: keptState, dataAvailable: true }), intent: 'frustration' }
      case 'why_explain': {
        const who = (state.createState.draft.title ?? '').replace(/^פגישה עם\s+/u, '').trim()
        const msg = who ? `עוד לא קבעתי — הפגישה עם ${who} מחכה לאישור שלך. תגידי "כן" ואני קובעת מיד.` : 'עוד לא קבעתי — הפגישה מחכה לאישור שלך. תגידי "כן" ואני קובעת.'
        return { ...settle(msg, { state: keptState, dataAvailable: true }), intent: 'confirmation' }
      }
      case 'search': {
        const res = settle(calendarSearchReasoner(normalized), { state: keptState, dataAvailable: true })
        // Remember the searched person as the active calendar object so a bare
        // "באיזה שעה?" next turn continues it instead of re-searching.
        const per = extractSearchPerson(normalized)
        return { ...res, intent: 'calendar_search', state: per ? { ...res.state, focus: { kind: 'calendar_event', label: per } } : res.state }
      }
      case 'read_keep':
        return { ...settle(calendarReadReasoner(normalized, ctx.now), { state: keptState, dataAvailable: true }), intent: 'calendar_read' }
      case 'side_keep': {
        const answered = runCognitiveTurn({ ...state, createState: IDLE_STATE }, normalized, ctx)
        return { ...answered, state: { ...answered.state, createState: state.createState } }
      }
      case 'replace': {
        // A brand-new create replaces the pending draft → its language is THIS turn's.
        const rlang: CreateLang = lang === 'es' ? 'es' : 'he'
        const next = withLang(startCreate(normalized), rlang)
        const text = shapeCreatePrompt(next, rlang)
        return { ...settle(text, { state: { ...state, createState: next }, dataAvailable: true, lang: rlang }), intent: 'calendar_create' }
      }
      case 'update': {
        const next = withLang(updateCreate(state.createState, normalized), clang)
        const text = shapeCreatePrompt(next, clang)
        return { ...settle(text, { state: { ...state, createState: next }, dataAvailable: true, lang: clang }), intent: 'calendar_create' }
      }
      case 'defer':
      default:
        break // hand off to the intent path below (v1 unchanged)
    }
  }

  // ─── Generic Domain Planner ───────────────────────────────────────────────
  // Plugins self-select and reason; the controller finalizes the winner. Runs for
  // every turn EXCEPT the precedence intents the runtime owns directly
  // (audio/continuation/frustration/confirmation/date). A plugin that handles the
  // turn produces the answer; otherwise the built-in domain cases below run.
  if (!PLANNER_SKIP.has(intent)) {
    const plan = runPlan({ input: normalized, now: ctx.now, messages: ctx.messages, state })
    if (plan.primary && plan.primary.handled && plan.primary.answer) {
      const { display, speak } = composeHebrew(plan.primary.answer)
      const verifier = verifyAnswer(display, { intent, dataAvailable: true })
      return {
        ...base, handled: true, display, speak, chunks: chunk(display),
        needsLLM: false, needsOnline: false, online: null, grounding: null,
        sideEffect: plan.primary.sideEffect ?? null, verifier,
        state: { ...state, ...plan.statePatch, lastIntent: intent },
      }
    }
  }

  switch (intent) {
    case 'date_query':
      return settle(dateReasoner(normalized, ctx.now), { state, dataAvailable: true })

    case 'math': {
      const ans = mathReasoner(normalized)
      return settle(ans ?? 'לא הצלחתי לחשב את זה. תנסי לנסח אחרת?', { state, dataAvailable: !!ans })
    }

    case 'continuation': {
      // Cross-session memory question ("את זוכרת מה אמרתי אתמול?") — AbuAI keeps NO
      // past-session memory. Answer honestly; NEVER imply it remembers (device failure).
      if (CROSS_SESSION_MEMORY_RE.test(normalized)) {
        const es = lang === 'es'
        return settle(es
          ? 'No guardo las conversaciones anteriores, así que no recuerdo lo que me dijiste antes. Pero estoy acá ahora — contame de nuevo.'
          : 'אני לא שומרת שיחות קודמות, אז אני לא זוכרת מה אמרת אז. אבל אני כאן עכשיו — תספרי לי שוב.',
          { state, dataAvailable: false, ...(es ? { lang: 'es' as const } : {}) })
      }
      // Last-question recall ("מה שאלתי אותך קודם?") — from THIS session's working memory
      // (the raw message history), else the last recorded question, else honest.
      if (LAST_QUESTION_RE.test(normalized)) {
        const es = lang === 'es'
        const prior = [...(ctx.messages ?? [])].reverse()
          .filter(m => m.role === 'user')
          .map(m => (m.content ?? '').trim())
          .find(c => c && c.length >= 2 && !LAST_QUESTION_RE.test(c) && !CROSS_SESSION_MEMORY_RE.test(c) && !isNonTopicTurn(c))
        const recalled = prior || (state.conv.answer?.question && !isNonTopicTurn(state.conv.answer.question) ? state.conv.answer.question : '')
        if (recalled) {
          return settle(es ? `Me preguntaste: "${recalled}".` : `שאלת: "${recalled}".`, { state, dataAvailable: true, ...(es ? { lang: 'es' as const } : {}) })
        }
        return settle(es ? 'Todavía no me preguntaste nada en esta charla.' : 'עוד לא שאלת אותי כלום בשיחה הזאת.',
          { state, dataAvailable: false, ...(es ? { lang: 'es' as const } : {}) })
      }
      // "על מה דיברנו" is a RECALL of the topic, not a resume — answer it first so
      // it never falls into "זהו, סיימתי".
      if (RECALL_TOPIC_RE.test(normalized)) {
        const a = state.conv.answer
        // Belt-and-suspenders: never recall a trivial closer/greeting as the topic.
        const cand = a?.topic || a?.question || ''
        const topic = cand && !isTrivialTurn(cand) ? cand : null
        return settle(topic ? `דיברנו על ${topic}.` : 'עוד לא דיברנו על משהו מסוים. על מה תרצי?',
          { state, dataAvailable: !!topic })
      }
      const { text, state: convState } = continueAnswer(state.conv)
      if (text) {
        const { display, speak } = composeHebrew(text)
        const verifier = verifyAnswer(display, { intent, dataAvailable: true })
        return {
          ...base, handled: true, display, speak, chunks: chunk(display),
          needsLLM: false, needsOnline: false, online: null, grounding: null,
          sideEffect: null, verifier,
          state: { ...state, conv: convState, lastIntent: intent },
        }
      }
      return settle('אין לי משהו להמשיך כרגע. על מה נדבר?', { state, dataAvailable: false })
    }

    case 'frustration': {
      const { text, state: s2 } = frustrationReasoner(state)
      const { display, speak } = composeHebrew(text)
      const verifier = verifyAnswer(display, { intent, dataAvailable: true })
      return {
        ...base, handled: true, display, speak, chunks: chunk(display),
        needsLLM: false, needsOnline: false, online: null, grounding: null,
        sideEffect: null, verifier, state: { ...s2, lastIntent: intent },
      }
    }

    case 'memory': {
      // Durable saved memories — persisted across sessions (not in RuntimeState).
      const es = lang === 'es'
      const esOpt = es ? { lang: 'es' as const } : {}
      const cmd = memoryCommandType(normalized)
      if (cmd === 'save') {
        // (Family/chapter facts are intercepted earlier, before the memory/reminder split.)
        const fact = parseRememberFact(normalized) ?? ''
        const r = saveMemory(fact)
        if (r.ok) return settle(es ? `Listo, me acuerdo: ${fact}.` : `בסדר, אני אזכור את זה: ${fact}.`, { state, dataAvailable: true, ...esOpt })
        if (r.reason === 'sensitive') return settle(es ? 'Eso mejor no lo guardo, pero acá estoy con vos.' : 'את זה אני מעדיפה לא לשמור, אבל אני כאן איתך.', { state, dataAvailable: true, ...esOpt })
        if (r.reason === 'duplicate') return settle(es ? 'Eso ya me lo acuerdo.' : 'את זה אני כבר זוכרת.', { state, dataAvailable: true, ...esOpt })
        return settle(es ? '¿Qué querés que recuerde?' : 'מה תרצי שאזכור?', { state, dataAvailable: false, ...esOpt })
      }
      if (cmd === 'forget') {
        const removed = forgetMemories(parseForgetQuery(normalized) ?? '')
        return settle(removed.length
          ? (es ? 'Listo, me lo olvido.' : 'בסדר, שכחתי את זה.')
          : (es ? 'No tengo eso guardado.' : 'לא מצאתי דבר כזה בזיכרון שלי.'),
          { state, dataAvailable: removed.length > 0, ...esOpt })
      }
      // recall
      const list = loadMemories()
      if (list.length === 0) {
        return settle(es
          ? 'Todavía no me contaste nada para recordar. Decime qué es importante para vos y lo guardo.'
          : 'עוד לא סיפרת לי משהו שאזכור. תגידי לי מה חשוב לך ואני אשמור.',
          { state, dataAvailable: false, ...esOpt })
      }
      const items = list.map((m) => m.text).join('; ')
      return settle(es ? `Me acuerdo de esto sobre vos: ${items}.` : `הנה מה שאני זוכרת עלייך: ${items}.`,
        { state, dataAvailable: true, ...esOpt })
    }

    case 'audio_complaint':
      // Never cancels a pending draft; keeps it. Helps with sound, warmly.
      return settle(
        'רגע, אני פה. אם לא שמעת אותי, נסי להעלות את עוצמת הקול או ללחוץ שוב על הכפתור. מה שביקשת עדיין שמור.',
        { state, dataAvailable: true })

    case 'family': {
      // Explanation follow-up ("איך בדיוק / דרך מי / למה") for the last pair — the
      // BFS path reasoner renders the edge-by-edge graph path (never memorized).
      // `familyGrounded` tells the Confidence Guard this is a resolved answer.
      if (state.lastFamilyPair && FAMILY_EXPLAIN_RE.test(normalized.trim())) {
        const { a, b } = state.lastFamilyPair
        return { ...settle(explainRelation(a, b), { state, dataAvailable: true }), familyGrounded: true }
      }
      const isEs = lang === 'es'
      const esLang = isEs ? { lang: 'es' as const } : {}
      // Continuity: rewrite a follow-up pronoun ("אמא שלה") to the last subject before reasoning.
      const resolvedText = resolveFamilyPronoun(normalized, state.lastFamilySubject)
      const fam = familyReasoner(resolvedText, lang)
      const withPair = fam.pair ? { ...state, lastFamilyPair: fam.pair } : state
      const nextState = fam.subject ? { ...withPair, lastFamilySubject: fam.subject } : withPair
      if (fam.known) return { ...settle(fam.text, { state: nextState, dataAvailable: true, ...esLang }), familyGrounded: true }
      // LEDGER read (§ family engine reads from the ledger) — a conversation-added relation
      // the static graph is silent about ("תזכרי שדני נשוי לרותי" → "מי אשתו של דני"). Use the
      // RAW input (pre-pronoun-resolution) so "אשתו" is not rewritten. The LAWS gate guarantees
      // a ledger fact can never contradict the graph, so ledger-fills-the-gap is safe.
      const ledgerAns = ledgerFamilyAnswer(original.trim()) ?? ledgerFamilyAnswer(normalized)
      if (ledgerAns) return { ...settle(ledgerAns, { state: nextState, dataAvailable: true }), familyGrounded: true }
      // Unknown relation — say so, never guess (in the query's language).
      return settle(
        isEs ? 'No estoy segura de ese parentesco, así que no lo adivino. Decime quién es quién y lo recuerdo.'
          : 'אני לא בטוחה בקשר הזה, אז לא אנחש. תגידי לי מי מי ואני אזכור.',
        { state: nextState, dataAvailable: false, ...esLang })
    }

    case 'calendar_read':
      return settle(calendarReadReasoner(normalized, ctx.now), { state, dataAvailable: true })

    case 'calendar_search':
      return settle(calendarSearchReasoner(normalized), { state, dataAvailable: true })

    case 'calendar_create': {
      // Start (or restart) a create; ask/confirm — do NOT save until confirmed.
      let next = startCreate(normalized)
      // Bare create opener ("תקבעי" with no details yet): startCreate returns idle,
      // but the user DID ask to schedule. Open an EMPTY pending draft so the
      // following fragments ("עם מור", "מחר בשלוש", "כן") are absorbed by the
      // pending-create path (updateCreate) instead of being orphaned to the LLM.
      // Root fix for the red-team's #1 failure class, "fragmented-create-lost".
      // Guarded to a genuine bare opener so a benign/misclassified turn never opens
      // a stray draft that would then absorb the next unrelated turn.
      if (next.phase === 'idle' && isBareCreateOpener(normalized)) {
        next = { phase: 'creating', draft: { title: null, date: null, time: null, emoji: '📅' }, missing: ['title', 'date', 'time'] }
      }
      const smart = understandMeetingSmart(normalized)
      // Narrative requests ("ביום שלישי אופיר … בשעה שבע … אצלה שעתיים") that the
      // base parser can't title but the smart layer fully understood → synthesize
      // the confirming draft from the smart understanding (who/date/time/location).
      if (next.phase !== 'confirming' && smart.who && smart.date && smart.time) {
        next = {
          phase: 'confirming',
          draft: {
            title: smart.title ?? `פגישה עם ${smart.who}`,
            date: smart.date, time: smart.time, person: smart.who,
            location: smart.location ?? null,
            subject: smart.subject ?? null, purpose: smart.purpose ?? null,
            notes: smart.notes ?? null, emoji: '📅',
          },
          missing: [],
        }
      }
      // A person-meeting title is always "פגישה עם <who>" — never the raw narrative
      // ("אופיר ביקשה שאבוא אליה הביתה. גלעד…"). Prefer the smart-resolved location.
      if (next.phase === 'confirming' && smart.who) next.draft.title = `פגישה עם ${smart.who}`
      if (next.phase === 'confirming' && smart.location) next.draft.location = smart.location
      // Resolve a RELATION-PHRASE person ("החתן של רפי") to the real person (גלעד) via
      // the family engine — schedule with the person, not the literal phrase (Leo
      // device failure #1). Composes graph edges (incl. in-laws); unambiguous only.
      if (next.phase === 'confirming') {
        const who = (next.draft.person ?? (next.draft.title ?? '').replace(/^פגישה עם\s+/u, '')).trim()
        const resolved = who ? resolvePersonPhrase(who) : null
        if (resolved) { next.draft.person = resolved; next.draft.title = `פגישה עם ${resolved}` }
      }
      // When we have a semantic "פרטים חשובים" summary, DROP the raw notes clause so
      // the confirm never dumps the raw sentence in "(...)" alongside the summary.
      if (next.phase === 'confirming' && smart.importantDetails.length) next.draft.notes = null
      // Remember the create's language (§20.2) and shape the prompt in it.
      const clang = createLangOf(state, lang)
      // Spanish ambiguous-hour fallback (parity with the 0.68.0 fragment path and the
      // Hebrew smart layer, which resolves this for Hebrew): a single-utterance es create
      // with an AM/PM-ambiguous bare hour ("anotá una cita a las diez") would otherwise
      // stay "creating", ask "¿A qué hora?", and dead-end on "dale". understandMeetingSmart
      // is Hebrew-only, so nothing resolved it. Accept the default reading (the value
      // already parsed) and move to confirming; Martita can correct AM/PM at confirm.
      if (clang === 'es' && next.phase !== 'confirming' && next.missing.length === 1
        && next.missing[0] === 'time' && next.draft.time && next.draft.ambiguousTime) {
        next = { phase: 'confirming', draft: { ...next.draft, ambiguousTime: false }, missing: [] }
      }
      next = withLang(next, clang)
      let text = shapeCreatePrompt(next, clang)
      // Smart enrichment (Hebrew-only): surface stated duration + the important context
      // clauses ("פרטים חשובים") the person buried in a rambling request. Appended before
      // the trailing confirmation question; absent for plain requests (no change).
      if (next.phase === 'confirming' && clang === 'he') {
        const extra: string[] = []
        if (smart.durationLabel) extra.push(`למשך ${smart.durationLabel}`)
        if (smart.importantDetails.length) extra.push(`פרטים חשובים: ${smart.importantDetails.join('; ')}`)
        if (extra.length) text = text.replace(/\s*נכון\?\s*$/u, `. ${extra.join('. ')}. נכון?`)
        text = text.replace(/\.\s*\.+/g, '.').replace(/\s{2,}/g, ' ')  // no double periods
      }
      const { display, speak } = composeCreate(text, clang)
      const verifier = verifyAnswer(display, { intent, dataAvailable: true })
      return {
        ...base, handled: true, display, speak, chunks: chunk(display),
        needsLLM: false, needsOnline: false, online: null, grounding: null,
        sideEffect: null, verifier,
        state: { ...state, createState: next, lastIntent: intent },
      }
    }

    case 'confirmation': {
      // Resolve the pending draft. resolvePendingMessage owns save/cancel/audio/park/change.
      const isRead = /מה יש לי|מה ה?תוכניות|יומן/u.test(normalized)
      const res = resolvePendingMessage(state.createState, normalized, isRead)
      // Language the pending create was started in — keep responding in it (§20.2).
      const clang = createLangOf(state, lang)
      switch (res.action) {
        case 'save': {
          const out = executeSave(res.draft, res.draft.lang ?? clang)
          const { display, speak } = composeCreate(out.text, clang)
          const verifier = verifyAnswer(display, { intent, dataAvailable: true })
          return {
            ...base, handled: true, display, speak, chunks: chunk(display),
            needsLLM: false, needsOnline: false, online: null, grounding: null,
            sideEffect: out.ok ? 'saved_appointment' : 'save_failed', verifier,
            state: { ...state, createState: IDLE_STATE, lastIntent: intent },
          }
        }
        case 'cancel':
          return { ...settle(clang === 'es' ? shapeCreateCancelledES() : shapeCreateCancelled(), { state, dataAvailable: true, lang: clang }),
            state: { ...state, createState: IDLE_STATE, conv: state.conv, lastIntent: intent } }
        case 'audio_help':
          return { ...settle(res.message, { state, dataAvailable: true }),
            state: { ...state, createState: res.keep, conv: state.conv, lastIntent: 'audio_complaint' } }
        case 'replace':
        case 'update': {
          const next = withLang(res.state, clang)
          const text = shapeCreatePrompt(next, clang)
          const { display, speak } = composeCreate(text, clang)
          const verifier = verifyAnswer(display, { intent, dataAvailable: true })
          return {
            ...base, handled: true, display, speak, chunks: chunk(display),
            needsLLM: false, needsOnline: false, online: null, grounding: null,
            sideEffect: null, verifier,
            state: { ...state, createState: next, lastIntent: intent },
          }
        }
        case 'read':
          return { ...settle(calendarReadReasoner(normalized, ctx.now), { state, dataAvailable: true }),
            // preserve the pending draft so a following "כן" still confirms it.
            state: { ...state, lastIntent: intent } }
        case 'park':
          // A new-meeting narrative mid-create → drop the old draft, re-run fresh.
          return runCognitiveTurn({ ...state, createState: IDLE_STATE }, res.query, ctx)
        case 'park_keep': {
          // A side question/topic mid-create → ANSWER it but KEEP the pending draft so
          // conversation state survives ("כן" still confirms; no false "ביטלתי").
          const answered = runCognitiveTurn({ ...state, createState: IDLE_STATE }, res.query, ctx)
          return { ...answered, state: { ...answered.state, createState: state.createState } }
        }
        case 'clarify':
        default:
          return { ...settle(shapeCreateUnclear(), { state, dataAvailable: true }),
            state: { ...state, lastIntent: intent } }
      }
    }

    case 'online':
      // The runtime decides online; the caller executes the async lookup and feeds
      // the result back through finalizeExternalAnswer (verifier + composer).
      return {
        ...base, handled: false, display: null, speak: null, chunks: [],
        needsLLM: false, needsOnline: true, online: { query: normalized }, grounding: null,
        sideEffect: null, verifier: { ok: true, violations: [] },
        state: { ...state, lastIntent: intent },
      }

    // reminder / calendar_recurring / calendar_delete / calendar_update are owned
    // by the generic Domain Planner above (calendarMutationPlugins) — no special
    // cases here. Any that the planner somehow does not handle fall to the general
    // path below rather than emitting outside the runtime.

    case 'general':
    case 'unknown':
    default: {
      // LEDGER CHAPTER read — a personal question ("איפה גר X", "מה X אוהב", "מה את יודעת
      // על X") answered from the person's ledger chapter before punting to the LLM.
      const chapter = ledgerChapterAnswer(original.trim())
      if (chapter) return settle(chapter, { state, dataAvailable: true })
      // A plainly-stated family fact with NO "תזכרי" ("רותי היא אשתו של דני") → ONE soft
      // confirmation before writing (never writes a stated fact without a "כן"). Only here
      // in the general path, so every real domain (calendar/family/…) takes precedence.
      if (state.createState.phase === 'idle' && !state.pendingReminder && !state.pendingLedgerChange) {
        const intake = classifyIntake(original.trim(), resolveSinglePerson, isKnownFamilyPerson)
        if (intake.kind === 'soft-confirm' && intake.change) {
          return settle(intake.confirmPrompt!, { state: { ...state, pendingLedgerChange: intake.change }, dataAvailable: true })
        }
      }
      // General knowledge / open chat → LLM, but the answer MUST return through
      // finalizeExternalAnswer so it is verified + composed (no direct bypass).
      return {
        ...base, handled: false, display: null, speak: null, chunks: [],
        needsLLM: true, needsOnline: false, online: null, grounding: null,
        sideEffect: null, verifier: { ok: true, violations: [] },
        state: { ...state, lastIntent: intent },
      }
    }
  }
}

// ── Entry point B: finalize an external (LLM/online) answer ────────────────────
/**
 * The caller runs the async LLM/online work, then MUST call this with the raw
 * result. It runs layers 7–9 (verify → compose → chunk) and records the answer
 * into conversation memory so continuation/recall work next turn. This is what
 * makes "no direct LLM bypass" true: even an LLM answer is verified + composed.
 */
export function finalizeExternalAnswer(
  state: RuntimeState,
  rawAnswer: string,
  meta: {
    intent: RuntimeIntent
    topic?: string | null
    online?: { ok: boolean; reason?: string | null; query?: string; summary?: string | null }
    dataAvailable?: boolean
  },
): CognitiveDecision {
  const { display, speak } = composeHebrew(rawAnswer)
  const dataAvailable = meta.dataAvailable ?? (meta.online ? meta.online.ok : true)
  const verifier = verifyAnswer(display, { intent: meta.intent, dataAvailable })

  let conv = state.conv
  if (meta.online) {
    conv = recordOnline(conv, {
      query: meta.online.query ?? '', topic: meta.topic ?? null, source: null,
      ok: meta.online.ok, reason: (meta.online.reason as never) ?? null,
      summary: meta.online.summary ?? (meta.online.ok ? display : null),
    })
  }
  // Skip recording a trivial closer/greeting/ack (topic-derived from the input)
  // so it can't overwrite the last SUBSTANTIVE topic used by "מה דיברנו קודם?".
  if (display && !isNonTopicTurn(meta.topic ?? '')) {
    conv = recordAnswer(conv, {
      question: '', intent: meta.intent, topic: meta.topic ?? null, fullText: display,
    })
  }
  // Conversation focus: a successful ONLINE answer becomes the active object so a
  // bare "ומחר?" next turn continues it; any non-online finalize clears it so a
  // follow-up can never bind to a stale online topic.
  // Keep an online focus even when the lookup FAILED — so "ומחר?" retries the live
  // topic instead of being reclassified to the calendar. Only a non-online answer
  // clears it.
  const focus: ConversationFocus | null = meta.online
    ? { kind: 'online', label: (meta.online.query ?? meta.topic ?? '').replace(/[?？]+$/u, '').trim() }
    : null
  return {
    handled: true, intent: meta.intent, lang: detectLang(rawAnswer),
    original: rawAnswer, normalized: rawAnswer,
    display, speak, chunks: chunk(display),
    needsLLM: false, needsOnline: false, online: null, grounding: null,
    sideEffect: null, verifier,
    state: { ...state, conv, focus, lastIntent: meta.intent },
  }
}
