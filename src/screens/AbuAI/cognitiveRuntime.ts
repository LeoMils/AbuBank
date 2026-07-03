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
  type CalendarCreateState, IDLE_STATE, startCreate, resolvePendingMessage,
  isCreateIntent, isDeleteIntent, isModifyIntent, isSearchIntent,
} from './calendarCreate'
import { understandMeeting } from './meetingIntelligence'
import { understandMeetingSmart } from './calendarIntelligence'
import { isReminderIntent, isRecurringIntent, type MutationSideEffect } from './calendarMutationReasoner'
import { runPlan } from './domainPlanner'
import { registerCalendarMutationPlugins } from './calendarMutationPlugins'
import type { ReminderDraft } from '../AbuCalendar/reminders/types'

// Register the domain plugins once, at module load. Adding a future domain = add a
// plugin + register it here; the planner and controller never change.
registerCalendarMutationPlugins()

// Precedence intents the runtime owns directly — the planner does not run for these
// (audio must never cancel; continuation/frustration/confirmation/date have fixed
// handling). Every other intent goes through the generic domain planner first.
const PLANNER_SKIP: ReadonlySet<RuntimeIntent> = new Set<RuntimeIntent>([
  'audio_complaint', 'continuation', 'frustration', 'confirmation', 'date_query',
])
import { answerFamilyRelation } from './familyReasoning'
import { answerRelationQuery } from './familyRelationEngine'
import { loadGraph, findNode, describeRelation, type GraphNode } from './familyGraph'
import {
  getTodayEvents, getTomorrowEvents, getEventsByDate, findEventsByPerson,
} from './tools'
import { loadAppointments, createAppointmentSafe, formatHebrewDate } from '../AbuCalendar/service'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'
import { toSpokenText } from './spokenPersona'
import {
  shapeCreateConfirm, shapeCreateClarify, shapeCreateCancelled, shapeCreateUnclear,
} from './responseShaper'
import { normalizeInput } from './understandingOrchestrator'

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
  | 'family'
  | 'online'
  | 'continuation'
  | 'frustration'
  | 'audio_complaint'
  | 'general'
  | 'unknown'

export type Lang = 'he' | 'es' | 'mixed'

export interface RuntimeState {
  conv: ConvState
  createState: CalendarCreateState
  frustrationCount: number
  lastIntent: RuntimeIntent | null
  /** last frustration reply index, so repeats never echo the same sentence. */
  frustrationVariant: number
  /** a reminder draft awaiting time/confirmation (controller-reasoned). */
  pendingReminder: ReminderDraft | null
}

export const IDLE_RUNTIME: RuntimeState = {
  conv: IDLE_CONV,
  createState: IDLE_STATE,
  frustrationCount: 0,
  lastIntent: null,
  frustrationVariant: 0,
  pendingReminder: null,
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
const AUDIO_COMPLAINT_RE =
  /(?:לא\s+שומעת?\s+אות[ךיו]|אני\s+לא\s+שומע|לא\s+שמעתי(?:\s+אות[ךיו])?|לא\s+מדברת|הקול\s+נעלם|אין\s+קול|למה\s+את\s+שותקת|no\s+te\s+(?:escucho|oigo))/iu
// Frustration the shared regex misses — "you're not answering what I asked".
const FRUSTRATION_EXTRA_RE =
  /את\s+לא\s+עונה|לא\s+ענית\s+לי|לא\s+על\s+זה\s+שאלתי|לא\s+ענית\s+על|זה\s+לא\s+מה\s+ששאלתי|את\s+לא\s+עונה\s+למה\s+ששאלתי/u
const CONTINUATION_EXTRA_RE = /תשלימי\s+את\s+המשפט|תסיימי\s+את\s+המשפט|תגמרי\s+את\s+המשפט/u
const RECALL_TOPIC_RE = /על\s+מה\s+דיבר(?:נו|ת)|מה\s+דיברנו|de\s+qu[eé]\s+hablamos/iu
// "מתי יש לי פגישה עם X" / "מתי הפגישה עם X" → search across ALL days (never create,
// never ask "באיזה יום"). Must be tested BEFORE isCreateIntent, which is greedy.
const SEARCH_WHEN_RE = /^מתי\s+.*(?:יש\s+לי|ה?פגישה|ה?תור|ה?ביקור|נפגש|פגוש)/u
// Live/current-info that onlineIntent does not already classify (buses/trains/
// weather/local events/movies) — kept in sync with knowledgeRouter's routing.
const ONLINE_EXTRA_RE =
  /(?:מתי\s+ה?אוטובוס|ה?אוטובוס\s+(?:ה?בא|מ)|מתי\s+ה?רכבת|ה?רכבת\s+(?:ה?באה|מ)|מתי\s+ה?טיסה|מזג\s+ה?אוויר|תחזית|חדשות\s+ה?יום|סרטים|קולנוע|הצגות|מה\s+פתוח)/u
// A narrative event description WITHOUT an explicit create verb ("ביום שלישי אופיר
// … בשעה שבע … אצלה שעתיים") — day + time + person/place → a calendar create, so it
// is never mistaken for a family question just because family names appear in it.
const DAY_CUE = /(?:מחר|מחרתיים|היום|הערב|ביום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת))/u
const TIME_CUE = /(?:בשעה|בשבע|בשמונה|בתשע|בעשר|באחת|בשתיים|בשלוש|בארבע|בחמש|בשש|בבוקר|בערב|בצהריים|וחצי)/u
const PLACE_PERSON_CUE = /(?:אצל|עם\s+[א-ת]{2,})/u
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

  // Continuation / resume, or topic recall ("על מה דיברנו", even prefixed by
  // "יש לך זיכרון …") — both are handled inside the continuation case.
  if (isContinuation(t) || CONTINUATION_EXTRA_RE.test(t) || RECALL_TOPIC_RE.test(t)) return 'continuation'

  // Date/day questions answered from the real clock — never invented, never "באיזה יום".
  if (DATE_QUERY_RE.test(t)) return 'date_query'

  // Live/current-info that onlineIntent misses (buses/trains/weather) — before the
  // calendar verbs so "מתי האוטובוס" is never mistaken for a calendar create.
  if (ONLINE_EXTRA_RE.test(t) && !shouldBlockOnlineForPersonal(t)) return 'online'

  // "מתי יש לי פגישה עם X" is a SEARCH across all days — before the greedy create.
  if (SEARCH_WHEN_RE.test(t)) return 'calendar_search'

  // Reminders ("תזכירי לי …") before calendar create — a reminder is not an event.
  if (isReminderIntent(t)) return 'reminder'
  // Recurring create ("כל יום שלישי …") before a single create.
  if (isCreateIntent(t) && isRecurringIntent(t)) return 'calendar_recurring'

  // Calendar verbs (create/delete/modify/search) before generic reads.
  if (isCreateIntent(t)) return 'calendar_create'
  if (isDeleteIntent(t)) return 'calendar_delete'
  if (isModifyIntent(t)) return 'calendar_update'
  if (isSearchIntent(t)) return 'calendar_search'

  // Calendar read ("מה יש לי היום/מחר"). Must stay personal ("מה יש לי", "ביומן")
  // so live questions like "מה יש בקולנוע היום" fall through to online, not here.
  if (/(?:מה יש לי|יש לי משהו|מה ה?תוכניות שלי|מה ביומן|מה יש ביומן)/u.test(t) &&
      /(?:היום|מחר|השבוע|הערב|יומן|תוכניות)/u.test(t)) return 'calendar_read'

  // Narrative event description (day + time + person/place, no create verb).
  if (looksLikeNarrativeMeeting(t)) return 'calendar_create'

  // Family relation queries: two known family names, or "מי ה<relation> של <person>".
  if (looksLikeFamilyQuery(t)) return 'family'

  // Online / current-info (blocked for personal/family/calendar).
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
export function dateReasoner(text: string, now: Date): string {
  const day = HE_DAYS[now.getDay()] ?? 'היום'
  // formatHebrewDate may already include the weekday — strip it so we never say the
  // day twice ("היום יום שישי, 3 ביולי 2026, יום שישי").
  const dateOnly = safeHebrewDate(localISO(now))
    .replace(/^\s*(?:יום\s+\S+|שבת)\s*,?\s*/u, '')
    .replace(/,?\s*(?:יום\s+\S+|שבת)\s*$/u, '')
    .trim()
  // "מה התאריך" → lead with the date; "איזה יום" → lead with the day.
  if (/תאריך|fecha/iu.test(text)) return `היום ${dateOnly}, ${day}.`
  return `היום ${day}, ${dateOnly}.`
}
function safeHebrewDate(iso: string): string {
  try { return formatHebrewDate(iso) } catch { return iso }
}

// FamilyRelationReasoner
function looksLikeFamilyQuery(t: string): boolean {
  if (/מי\s+ה?(?:סבא|סבתא|דוד|דודה|אבא|אמא|בעל|אישה|בן\s+הזוג|בת\s+הזוג|ילדים|נכד|נכדה|אח|אחות)\s+של/u.test(t)) return true
  if (/מה\s+הקשר\s+בין|מה\s+היחס\s+בין|איך\s+קשור[הים]?|מי\s+ז[הא]\s+ל/u.test(t)) return true
  // "מה/מי (זה)? X עבור/בשביל Y" — a directional relation question. Recognized even
  // when X is UNKNOWN, so the runtime answers "won't guess" instead of the LLM.
  if (/(?:מה|מי)\s+(?:ז[הא]\s+)?\S+\s+(?:עבור|בשביל)\s+\S+/u.test(t)) return true
  // "מי זה X" for a known family member.
  const m = t.match(/^מי\s+ז[הא]\s+(\S+)\s*\??$/u)
  if (m && findNode(m[1]!)) return true
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

export interface FamilyResult { text: string; known: boolean }
export function familyReasoner(text: string): FamilyResult {
  // 0) Directional pairwise "what is X for Y" / "הקשר בין X ל-Y" — the graph
  // kinship engine (correct direction + gender + great-uncle/in-laws). Preferred
  // over the symmetric describeRelation for these forms.
  const pair = answerRelationQuery(text)
  if (pair) return { text: pair.sentence, known: pair.known }

  // 1) "who is the <relation> of <person>" — deterministic multi-answer.
  const rel = answerFamilyRelation(text)
  if (rel) {
    if (!rel.known || rel.results.length === 0) return { text: '', known: false }
    return { text: rel.results.join(', '), known: true }
  }
  // 2) pairwise relation between two known names.
  const names = knownFamilyNamesIn(text)
  if (names.length >= 2) {
    const desc = describeRelation(names[0]!.hebrew, names[1]!.hebrew, 'he')
    if (desc) return { text: desc, known: true }
    return { text: '', known: false }
  }
  // 3) "מי זה X" — describe the single member's role from the graph.
  const m = text.match(/^מי\s+ז[הא]\s+(\S+)\s*\??$/u)
  if (m) {
    const node = findNode(m[1]!)
    if (node) {
      const self = describeRelation('מרטיטה', node.hebrew, 'he')
      if (self) return { text: self, known: true }
    }
  }
  return { text: '', known: false }
}

// CalendarReasoner (reads) — grounded on real storage; empty store never invents.
export function calendarReadReasoner(text: string, now: Date): string {
  if (/\bמחר\b/u.test(text)) {
    const r = getTomorrowEvents()
    return r.events.length === 0 ? 'מחר אין כלום. יום שקט.' : r.summary
  }
  if (/\bהיום\b/u.test(text)) {
    const r = getTodayEvents()
    return r.events.length === 0 ? 'היום אין כלום ביומן.' : r.summary
  }
  // otherwise read the specific day if we can, else today.
  const r = getEventsByDate(localISO(now))
  return r.events.length === 0 ? 'אין כלום ביומן ליום הזה.' : r.summary
}

// CalendarSearchReasoner — search ALL calendar for a person/type, never ask "באיזה יום".
export function calendarSearchReasoner(text: string): string {
  const nameMatch = text.match(/עם\s+([֐-׿]{2,})|אצל\s+([֐-׿]{2,})/u)
  const person = nameMatch?.[1] ?? nameMatch?.[2] ?? null
  if (person) {
    const r = findEventsByPerson(person)
    if (r.events.length === 0) return `אין לך פגישה עם ${person} ביומן.`
    return r.summary
  }
  const all = loadAppointments()
  if (all.length === 0) return 'היומן ריק.'
  return `יש לך ${all.length} דברים ביומן.`
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
  notes?: string | null; person?: string | null
}): SaveOutcome {
  if (!draft.title || !draft.date || !draft.time) {
    return { ok: false, text: 'חסר לי פרט כדי לשמור — מה, מתי ובאיזו שעה?' }
  }
  const res = createAppointmentSafe({
    title: draft.title, date: draft.date, time: draft.time, emoji: draft.emoji ?? '📅',
    ...(draft.location ? { location: draft.location } : {}),
    ...(draft.subject ? { subject: draft.subject } : {}),
    ...(draft.purpose ? { purpose: draft.purpose } : {}),
    ...(draft.notes ? { notes: draft.notes } : {}),
    ...(draft.person ? { personName: draft.person } : {}),
  })
  if (!res.ok) return { ok: false, text: 'משהו לא עבד — הפגישה לא נשמרה. תנסי שוב.' }
  // Verify the write actually persisted (no fake-save).
  const verified = loadAppointments().find(a =>
    a.id === res.appointment.id ||
    (a.title === draft.title && a.date === draft.date && (a.time ?? null) === (draft.time ?? null)))
  if (!verified) return { ok: false, text: 'משהו לא עבד — הפגישה לא נשמרה. תנסי שוב.' }
  const heDate = safeHebrewDate(verified.date)
  const loc = verified.location ? ` ${/^(?:ב|ל|מ|אצל)/u.test(verified.location) ? verified.location : 'ב' + verified.location}` : ''
  return { ok: true, text: `קבוע — ${verified.title} ${heDate} בשעה ${verified.time}.${loc}` }
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
  // Correction ("לא, התכוונתי <X>") → answer the CORRECTED request X, not a generic
  // reply. Strip the correction lead-in and process the clause that follows.
  let normalized = norm.normalized
  const corr = normalized.match(/^לא[,.]?\s*(?:זה[,.]?\s*)?(?:התכוונתי|התכוונת|רציתי\s+לומר)\s+(.+)/u)
  if (corr && corr[1] && corr[1].trim().length >= 3) normalized = corr[1].trim()
  // Layer 3: classify.
  const intent = classifyIntent(normalized, state)

  const base = { intent, lang, original, normalized }
  const settle = (
    rawAnswer: string,
    opts: { state: RuntimeState; dataAvailable: boolean; recordTopic?: string | null },
  ): CognitiveDecision => {
    const { display, speak } = composeHebrew(rawAnswer)
    const verifier = verifyAnswer(display, { intent, dataAvailable: opts.dataAvailable })
    // Record the answer into conversation memory so "תמשיכי" / recall work next turn.
    let conv = opts.state.conv
    if (intent !== 'continuation' && intent !== 'frustration' && display) {
      conv = recordAnswer(conv, {
        question: normalized, intent, topic: opts.recordTopic ?? null, fullText: display,
      })
    }
    return {
      ...base, handled: true, display, speak, chunks: chunk(display),
      needsLLM: false, needsOnline: false, online: null, grounding: null,
      sideEffect: null, verifier,
      state: { ...opts.state, conv, lastIntent: intent },
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

    case 'continuation': {
      // "על מה דיברנו" is a RECALL of the topic, not a resume — answer it first so
      // it never falls into "זהו, סיימתי".
      if (RECALL_TOPIC_RE.test(normalized)) {
        const a = state.conv.answer
        const topic = a?.topic || a?.question
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

    case 'audio_complaint':
      // Never cancels a pending draft; keeps it. Helps with sound, warmly.
      return settle(
        'רגע, אני פה. אם לא שמעת אותי, נסי להעלות את עוצמת הקול או ללחוץ שוב על הכפתור. מה שביקשת עדיין שמור.',
        { state, dataAvailable: true })

    case 'family': {
      const fam = familyReasoner(normalized)
      if (fam.known) return settle(fam.text, { state, dataAvailable: true })
      // Unknown relation — say so, never guess.
      return settle('אני לא בטוחה בקשר הזה, אז לא אנחש. תגידי לי מי מי ואני אזכור.',
        { state, dataAvailable: false })
    }

    case 'calendar_read':
      return settle(calendarReadReasoner(normalized, ctx.now), { state, dataAvailable: true })

    case 'calendar_search':
      return settle(calendarSearchReasoner(normalized), { state, dataAvailable: true })

    case 'calendar_create': {
      // Start (or restart) a create; ask/confirm — do NOT save until confirmed.
      let next = startCreate(normalized)
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
      let text = next.phase === 'confirming'
        ? shapeCreateConfirm(next.draft)
        : shapeCreateClarify(next.missing, next.draft)
      // Smart enrichment: surface stated duration + the important context clauses
      // ("פרטים חשובים") the person buried in a rambling request. Appended before
      // the trailing confirmation question; absent for plain requests (no change).
      if (next.phase === 'confirming') {
        const extra: string[] = []
        if (smart.durationLabel) extra.push(`למשך ${smart.durationLabel}`)
        if (smart.importantDetails.length) extra.push(`פרטים חשובים: ${smart.importantDetails.join('; ')}`)
        if (extra.length) text = text.replace(/\s*נכון\?\s*$/u, `. ${extra.join('. ')}. נכון?`)
      }
      const { display, speak } = composeHebrew(text)
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
      switch (res.action) {
        case 'save': {
          const out = executeSave(res.draft)
          const { display, speak } = composeHebrew(out.text)
          const verifier = verifyAnswer(display, { intent, dataAvailable: true })
          return {
            ...base, handled: true, display, speak, chunks: chunk(display),
            needsLLM: false, needsOnline: false, online: null, grounding: null,
            sideEffect: out.ok ? 'saved_appointment' : 'save_failed', verifier,
            state: { ...state, createState: IDLE_STATE, lastIntent: intent },
          }
        }
        case 'cancel':
          return { ...settle(shapeCreateCancelled(), { state, dataAvailable: true }),
            state: { ...state, createState: IDLE_STATE, conv: state.conv, lastIntent: intent } }
        case 'audio_help':
          return { ...settle(res.message, { state, dataAvailable: true }),
            state: { ...state, createState: res.keep, conv: state.conv, lastIntent: 'audio_complaint' } }
        case 'replace':
        case 'update': {
          const text = res.state.phase === 'confirming'
            ? shapeCreateConfirm(res.state.draft)
            : shapeCreateClarify(res.state.missing, res.state.draft)
          const { display, speak } = composeHebrew(text)
          const verifier = verifyAnswer(display, { intent, dataAvailable: true })
          return {
            ...base, handled: true, display, speak, chunks: chunk(display),
            needsLLM: false, needsOnline: false, online: null, grounding: null,
            sideEffect: null, verifier,
            state: { ...state, createState: res.state, lastIntent: intent },
          }
        }
        case 'read':
          return { ...settle(calendarReadReasoner(normalized, ctx.now), { state, dataAvailable: true }),
            // preserve the pending draft so a following "כן" still confirms it.
            state: { ...state, lastIntent: intent } }
        case 'park':
          // Unrelated question mid-create → drop the draft and re-run as a fresh turn.
          return runCognitiveTurn({ ...state, createState: IDLE_STATE }, res.query, ctx)
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
    default:
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
  if (display) {
    conv = recordAnswer(conv, {
      question: '', intent: meta.intent, topic: meta.topic ?? null, fullText: display,
    })
  }
  return {
    handled: true, intent: meta.intent, lang: detectLang(rawAnswer),
    original: rawAnswer, normalized: rawAnswer,
    display, speak, chunks: chunk(display),
    needsLLM: false, needsOnline: false, online: null, grounding: null,
    sideEffect: null, verifier,
    state: { ...state, conv, lastIntent: meta.intent },
  }
}
