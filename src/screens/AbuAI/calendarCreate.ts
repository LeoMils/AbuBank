import { parseHebrewDate } from './dateParser'
import { detectEmoji } from '../AbuCalendar/service'
import { extractEventDetails } from './eventExtractor'
import { isOnlineCurrentInfoQuery } from './onlineIntent'
// NOTE: meetingIntelligence imports back from this module — the cycle is safe
// because refineMeeting is only ever called at runtime (live ES bindings), never
// at module-eval time.
import { refineMeeting } from './meetingIntelligence'
import { recoverHebrewStt } from './sttSemanticRecovery'
import { resolveSinglePerson } from './familyReasoning'

// ─── State Machine ──────────────────────────────────────────────────────────

export type CreatePhase = 'idle' | 'creating' | 'confirming'

export interface CreateDraft {
  title: string | null
  date: string | null
  time: string | null
  /** Hour was understood but AM/PM is unresolved (e.g. bare "בשבע"). */
  ambiguousTime?: boolean
  emoji?: string
  // ─── Dedicated event-extraction fields (WHO / WHERE / WHAT-about) ───
  person?: string | null     // "עם אלכסנדרה" → אלכסנדרה
  location?: string | null   // "בקפה גרג רעננה" → קפה גרג רעננה
  subject?: string | null    // "על הטיול לאיטליה" → טיול לאיטליה (topic)
  purpose?: string | null    // WHY — "לסגור את הסכם השכירות לפני הדיירים"
  notes?: string | null      // clean one-line summary (NOT the raw transcript)
  // ─── Understanding-pipeline provenance (set by runCalendarPipeline) ───
  rawTranscript?: string | null      // exactly what STT / the user gave us
  cleanedTranscript?: string | null  // Hebrew/STT-normalized text we parsed
  confidence?: number                // 0..1 — how complete/sure the parse is
  // Language the create was STARTED in — remembered across turns so a Spanish create
  // stays Spanish (§20.2), even when a bare answer like "a las cuatro" detects as Hebrew.
  lang?: 'he' | 'es'
}

export interface CalendarCreateState {
  phase: CreatePhase
  draft: CreateDraft
  missing: Array<'title' | 'date' | 'time'>
}

export const IDLE_STATE: CalendarCreateState = {
  phase: 'idle',
  draft: { title: null, date: null, time: null, emoji: '📅' },
  missing: [],
}

// ─── Hebrew create-command normalization ────────────────────────────────────
//
// Elderly users (and ASR) produce near-miss create verbs. We map the common
// noisy forms to canonical feminine imperatives so intent detection and title
// stripping stay robust without any server/LLM. Idempotent — safe to call on
// already-clean text.
const CREATE_VERB_FIXES: Array<[RegExp, string]> = [
  [/תקווה לי/g, 'תקבעי לי'],   // typo / homophone of תקבעי לי
  [/תקבע לי/g, 'תקבעי לי'],    // masculine → feminine
  [/תרשום לי/g, 'תרשמי לי'],
  [/תעשה לי/g, 'תעשי לי'],
  [/תוסיף לי/g, 'תוסיפי לי'],
  [/תכניס לי/g, 'תכניסי לי'],
  [/תזכיר לי/g, 'תזכירי לי'],
  [/תשים לי/g, 'שימי לי'],
]

export function normalizeCreateText(text: string): string {
  let t = text
  for (const [re, rep] of CREATE_VERB_FIXES) t = t.replace(re, rep)
  return t
}

// ─── Understanding-pipeline cleanup + confidence (calendar intelligence) ─────
//
// Hebrew / Spanish speech fillers and disfluencies that carry no meeting
// meaning. Removed before extraction so they never reach the title or notes.
// Conservative — only well-known fillers, never content words.
const FILLER_TOKENS =
  /(?:^|\s)(?:אֵה+|אה+ה|אמ+|אהם|המ+|emm+|ehh+|este|eh|hmm+|יעני|כאילו|בקיצור|נו)(?=\s|$)/gi

/**
 * Hebrew / STT normalization run BEFORE extraction. Fixes near-miss create
 * verbs, strips speech fillers, collapses an immediately-repeated word
 * ("מור מור" → "מור", a common STT stutter), and tidies whitespace. Meaning-
 * preserving: only filler and exact dittos are removed. Idempotent.
 */
export function cleanTranscript(raw: string): string {
  let t = normalizeCreateText((raw ?? '').trim())
  t = t.replace(FILLER_TOKENS, ' ')
  t = t.replace(/(?<![֐-׿\w])([֐-׿\w]{2,})\s+\1(?![֐-׿\w])/gu, '$1')
  t = t.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim()
  return t
}

/**
 * Confidence (0..1) that we understood enough to save a good event. Critical
 * fields are title, date, time. An ambiguous (AM/PM) time and a missing person
 * each lower confidence.
 */
export function scoreConfidence(
  draft: CreateDraft,
  missing: Array<'title' | 'date' | 'time'>,
): number {
  let c = 1
  if (missing.includes('title')) c -= 0.35
  if (missing.includes('date')) c -= 0.35
  if (missing.includes('time')) c -= 0.30
  if (draft.ambiguousTime) c -= 0.15
  if (!draft.person && !draft.title) c -= 0.15
  return Math.max(0, Math.min(1, Number(c.toFixed(2))))
}

// ─── Intent Detection ───────────────────────────────────────────────────────

const RECURRING_INTENT = /כל\s+(יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|כל\s+שבוע|כל\s+יום/i

export function isRecurringIntent(text: string): boolean {
  return RECURRING_INTENT.test(text)
}

/** Extract the day-of-week from a recurring intent. Returns 0 (Sun) - 6 (Sat) or null. */
export function extractRecurringDay(text: string): number | null {
  const dayMap: Record<string, number> = {
    'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6,
  }
  const m = text.match(/כל\s+(?:יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/i)
  if (m) return dayMap[m[1]!] ?? null
  return null
}

/** Generate dates for the next N occurrences of a given day-of-week. */
export function getNextOccurrences(dayOfWeek: number, count: number = 4): string[] {
  const dates: string[] = []
  const today = new Date()
  const current = new Date(today)
  // Find next occurrence
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1)
  }
  for (let i = 0; i < count; i++) {
    dates.push(current.toISOString().split('T')[0]!)
    current.setDate(current.getDate() + 7)
  }
  return dates
}

const CREATE_INTENT = /תקבע[יה]? לי|תרשמ[יה]? לי|תוסיפ[יה]? לי|תזכיר[יה]? לי|תכניס[יה]? לי|תעש[יה]? לי|שימ[יה]? לי|קבע[יה]? לי|רשמ[יה]? לי|אני רוצה פגישה|אני רוצה תור|יש לי תור|יש לי פגישה|תכניס[יה]? ליומן|תשימ[יה]? ביומן|צריכה לקבוע|צריך לקבוע|רוצה לקבוע/i

// Natural speech: "אני צריכה להיות אצל...", "ביום רביעי בשעה חמש..."
// These are implicit create intents — person describes a future event
const NATURAL_INTENT = /צריכ[הא]? להיות|צריכ[הא]? להגיע|צריכ[הא]? ללכת|צריכ[הא]? לנסוע|אני צריכ[הא]?\s/i

// Detects if text contains time+date context that implies a future event description
function hasTimeAndDateContext(text: string): boolean {
  const hasDate = /היום|מחר|מחרתיים|ביום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|בעוד\s+שבוע/i.test(text)
  const hasTime = /בשעה|בבוקר|בערב|בצהריים|[בל](שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)/i.test(text)
  return hasDate && hasTime
}

// Plural "do I have meetings this week" reads like a create intent
// ("יש לי פגישה") but is actually a read query. Keep it out of create.
const READ_NOT_CREATE = /יש\s+לי\s+(?:פגישות|תורים|אירועים)\s+.{0,8}(?:שבוע|השבוע)/i

// A scheduling verb WITHOUT the "לי" object — "תקבע עם מור", "קבע פגישה",
// "שימי עם יעל". Each alternative is a whole word (Hebrew lookarounds) so we
// never match a verb root inside a longer, unrelated word.
const SCHEDULE_VERB = /(?<![֐-׿])(?:תקבעי|תקבע|קבעי|קבע|נקבע|אקבע|תרשמי|תרשום|רשמי|שימי|תשימי|תוסיפי|תוסיף|תזכירי|תכניסי|תכניס|תעשי)(?![֐-׿])/

// A date OR time OR "עם <someone>" clue — enough, combined with a scheduling
// verb, to commit to calendar_create even when a family name is present.
function hasScheduleClue(t: string): boolean {
  const hasDate = /היום|מחר|מחרתיים|(?:ב?יום\s+|ב)(?:ראשון|שני|שלישי|רביעי|רביע|חמישי|שישי|שבת)|בעוד\s+שבוע|השבוע|שבוע\s+הבא/.test(t)
  const hasTime = /בשעה|בבוקר|בערב|בצהריים|אחהצ|אחה"צ|אחר[י]?\s+הצהריים|[בל](?:שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|אחת|שתיים)|\d{1,2}[:.]\d{2}|\d{1,2}\s*(?:אחהצ|בערב|בבוקר|בצהריים)/.test(t)
  const hasWith = /(?<![֐-׿])עם\s+\S/.test(t)
  return hasDate || hasTime || hasWith
}

// Narrative scheduling — Martita rambles before she gets to the point:
// "אני חושבת שכדאי שנקבע משהו עם …", "בא לי לשבת עם …", "אני צריכה להיפגש עם …".
// A meeting verb buried in conversational lead-in, paired with a real
// date/time/with clue, is still a create — a form-parser misses it.
const NATURAL_MEETING = /(?:כדאי\s+ש|בא\s+לי|אני\s+רוצ[הא]?|אני\s+חושב[הת]?\s+ש|אני\s+צריכ[הא]?|נצטרך|צריך)\s*\S{0,14}(?:נקבע|אקבע|להיפגש|להפגש|לפגוש|לראות\s+את|לבקר|לשבת\s+עם|להיות\s+עם)/

// ── Spanish (Rioplatense) create intent ──────────────────────────────────────
// Martita's second language. "agendá una reunión con Gabi mañana a las tres",
// "quiero una cita con el médico el viernes", "anotame un turno".
// A scheduling VERB must be followed by a schedulable object (una cita / reunión /
// turno) or "con <name>" — so the NOUN "agenda de mañana" (tomorrow's agenda, a
// READ) is not mistaken for the imperative "agendá …". No trailing \b: JS regex
// (non-/u) treats accented letters (á) as non-word, so "agendá\b" never matches.
// Schedulable objects include MEAL nouns (cena/almuerzo/desayuno/café/merienda) so a
// Rioplatense "agendá una cena con Anabel" is a create, not an LLM fallthrough.
const CREATE_INTENT_ES = /(?<![a-záéíóúñ])(?:agend[áa]|anot[áa]|program[áa])r?(?:me)?\s+(?:(?:una?\s+)?(?:cita|reuni[óo]n|turno|evento|cena|almuerzo|comida|desayuno|caf[ée]|merienda)|con\s+\S)|(?<![a-záéíóúñ])(?:pon[ée]me|ponme)\s+(?:una?\s+)?(?:cita|reuni[óo]n|turno|cena|almuerzo|caf[ée])|(?:quiero|necesito|tengo\s+que\s+(?:hacer|sacar))\s+(?:una?\s+)?(?:cita|reuni[óo]n|turno|cena|almuerzo|caf[ée])|hac[ée]me?\s+(?:una?\s+)?(?:cita|reuni[óo]n|cena|almuerzo)/i
function hasScheduleClueES(t: string): boolean {
  const hasDate = /\b(?:hoy|mañana|pasado\s+mañana|el\s+(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)|la\s+semana\s+que\s+viene)\b/i.test(t)
  const hasTime = /\ba\s+las?\s+(?:\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)|\d{1,2}[:.]\d{2}|de\s+la\s+(?:tarde|mañana|noche)/i.test(t)
  const hasWith = /\bcon\s+\S/i.test(t)
  return hasDate || hasTime || hasWith
}

export function isCreateIntent(text: string): boolean {
  const t = normalizeCreateText(text.trim())
  if (READ_NOT_CREATE.test(t)) return false
  if (CREATE_INTENT.test(t)) return true
  // Spanish scheduling verb/phrase + a date/time/con clue.
  if (CREATE_INTENT_ES.test(t) && hasScheduleClueES(t)) return true
  // Natural speech with "צריכה להיות" etc.
  if (NATURAL_INTENT.test(t)) return true
  // Narrative meeting intent ("בא לי לשבת עם לאו מחר") + a real schedule clue.
  if (NATURAL_MEETING.test(t) && hasScheduleClue(t)) return true
  // Scheduling verb (even without "לי") + a date/time/with clue. Action beats
  // family Q&A: "תקבע עם מור ברביעי" is a create, not "who is Mor?".
  if (SCHEDULE_VERB.test(t) && hasScheduleClue(t)) return true
  // Implicit: has date + time + an appointment/event noun (describing a future event).
  // Bare "מחר בערב" without a noun must NOT trigger create — it could be casual speech.
  const APPOINTMENT_NOUN = /פגישה|תור|בדיקה|רופא|רופאה|אירוע|ארוחה|שיעור|ביקור|אצל\s|עם\s/i
  if (hasTimeAndDateContext(t) && APPOINTMENT_NOUN.test(t)) return true
  return false
}

/**
 * A bare create OPENER: a scheduling verb with NO schedulable content yet
 * ("תקבעי", "תקבעי לי", "קבעי פגישה"). The runtime opens an empty pending-create
 * draft for these so the following fragments ("עם מור", "מחר בשלוש", "כן") are
 * absorbed instead of orphaned to the LLM (fragmented-create-lost). Narrow by
 * construction — a scheduling verb, NO date/time/with clue, and a short utterance —
 * so a greeting, a statement, or a richer create (which startCreate already opens
 * with real fields) never matches, and a benign turn never opens a stray draft.
 */
export function isBareCreateOpener(text: string): boolean {
  const t = normalizeCreateText(text.trim())
  if (!t) return false
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 3) return false
  // Must START with the scheduling verb. This excludes a confirm-prefixed utterance
  // like "כן תקבעי" (yes, schedule it) — where "תקבעי" is a CONFIRM word, not an
  // opener — while still matching a bare "תקבעי" / "תקבעי לי" / "קבעי פגישה".
  if (!SCHEDULE_VERB.test(words[0]!)) return false
  if (hasScheduleClue(t)) return false
  return true
}

// ─── Confirmation / Cancel ──────────────────────────────────────────────────

const CANCEL = /^(לא|לא נכון|עזבי|עזבי את זה|תשכחי|ביטול|לא צריך|בטלי|לא רוצה|חבל|תעזבי|לא לא|לא לא לא|לא לא לא לא|עזבי עזבי|לא לזה התכוונתי|תמחקי|תמחקי את זה|תבטלי|תבטלי את זה|מחקי|תמחקי את הפגישה|תבטלי את הפגישה)$/i

// Spanish (Rioplatense) cancel — a BARE rejection during a pending create. Anchored
// (^…$) so a correction that merely STARTS with "no" ("no, a las cuatro") is NOT a
// cancel (it re-parses as a time correction). Covers "no", "mejor no", "no importa",
// "cancelá(lo)", "dejá(lo)", "olvidate/olvidalo", "nada", "así no", "no gracias".
const CANCEL_ES = /^(?:no|no,?\s*gracias|mejor\s+no|no\s+importa|as[íi]\s+no|cancel[áa](?:lo)?|dej[áa](?:lo)?|olvidat?e|olvidalo|nada)$/i

// Confirmation is recognised as (a) a whole known phrase, OR (b) a short
// utterance whose every word is a confirm word — so "כן", "כן כן", "כן בבקשה",
// "כן תקבעי", "בסדר גמור" all complete the pending action. This fixes the real
// device failure where "אני רוצה את זה" / "בבקשה" / "קדימה" did not confirm (and
// "אני רוצה את זה" was even mis-read as off-topic and SILENTLY cancelled).
const CONFIRM_PHRASES = new Set([
  'זה נכון', 'אני רוצה את זה', 'רוצה את זה', 'זה מה שרציתי', 'בסדר גמור',
  'נכון מאוד', 'תרשמי לי', 'תקבעי לי', 'תזמני לי', 'תודה רבה', 'כן בבקשה',
  'כן תקבעי', 'כן תרשמי', 'בדיוק כך', 'כן נכון', 'בדיוק זה', 'זה בדיוק',
  'יש לך אישור', 'יש לך את האישור', 'מאושר תקבעי', 'אישור', 'אני מאשרת', 'אני מאשר',
  'תעשי את זה', 'עשי את זה', 'תעשה את זה', 'קדימה תקבעי', 'בטח תקבעי', 'סגור תקבעי',
])
const CONFIRM_WORDS = new Set([
  'כן', 'נכון', 'בדיוק', 'בסדר', 'סבבה', 'יאללה', 'יאלה', 'תרשמי', 'רשמי', 'תקבעי',
  'תזמני', 'קבעי', 'אוקיי', 'אוקי', 'ok', 'okay', 'okey', 'yes', 'yep', 'yup',
  'בטח', 'ברור', 'בוודאי', 'מאשרת', 'מאשר', 'מאושר', 'מאושרת', 'תאשרי', 'אשרי', 'בבקשה', 'קדימה',
  'מעולה', 'מושלם', 'נהדר', 'יופי', 'סגור', 'סגרנו', 'לגמרי', 'בהחלט', 'תודה',
  'dale', 'sí', 'si', 'claro',
])

// Affirmative scheduling INTENT, even in a longer natural sentence:
// "כן אני רוצה שתקבעי את זה", "תקבעי את זה", "כן אני רוצה", "בסדר תקבעי את זה".
// Anchored so it cannot match a NEW create ("תקבעי עם מור מחר") which carries a
// person/date/time — those have no "את זה" / bare-intent shape.
const CONFIRM_INTENT =
  /^(?:כן[\s,]+)?(?:אני\s+)?(?:רוצה|מבקשת)(?:\s+ש?(?:תקבעי|תרשמי|תזמני))?(?:\s+את\s+ז[הו])?$|^(?:כן[\s,]+|בסדר[\s,]+|אוקיי?[\s,]+)?(?:ש?תקבעי|ש?תרשמי|ש?תזמני)\s+(?:את\s+)?ז[הו]$|^כן\s+אני\s+רוצה|^(?:כן[\s,]+)?(?:אני\s+רוצה\s+)?(?:מאוד\s+)?(?:בבקשה\s+)?ת?עש[יה]\s+(?:את\s+)?ז[הו]$|^(?:כן[\s,]*)+(?:מאוד|בבקשה|תקבעי|אני רוצה|שתקבעי|את זה|\s)*$/u

// Spanish affirmative scheduling: "dale, agendalo", "sí, agendalo", "anotalo",
// "agéndalo", "listo". Found by the eval engine (cal-es-confirm).
const CONFIRM_INTENT_ES = /^(?:s[íi]|dale|ok|okey|listo|bueno)?[\s,]*(?:agéndalo|agendalo|agéndala|agendala|anótalo|anotalo|anótala|anotala|prográmalo|programalo)$|^(?:s[íi]|dale)[\s,]+(?:dale|agéndalo|agendalo|anotalo|listo|hacelo|hazlo)/i

// Filler words that may sit AROUND a confirmation without changing it
// ("כן נכון תקבעי את זה", "אני מאוד רוצה את זה"). Not confirm words on their own,
// so an all-filler utterance never counts as a confirm (guard below).
const CONFIRM_FILLER = new Set(['את', 'זה', 'זו', 'אני', 'מאוד', 'ש', 'גם', 'כבר', 'באמת', 'ממש', 'רוצה', 'מבקשת', 'שתקבעי', 'לך'])

// Strip trailing politeness / filler ("…בבקשה", "…תודה", "…כבר טוב") and collapse
// whitespace, so a noisy real-user utterance is normalised BEFORE matching. Shared
// by the pending-resolution intent checks — fixes the systemic "one extra word
// defeats the matcher" class the autonomous gauntlet surfaced.
export function normalizeUtterance(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim().replace(/[.!?,;]+$/u, '')
  // Collapse consecutive duplicate words ("למה את את לא" → "למה את לא"), a very
  // common STT artefact that otherwise breaks multi-token intent regexes.
  t = t.replace(/(\S+)(?:\s+\1)+(?=\s|$)/gu, '$1')
  t = t.replace(/(?:\s+(?:בבקשה|תודה רבה|תודה|טוב|נו|כבר|אז|אוקיי|אוקי|please))+$/giu, '')
  return t.trim()
}

export function isConfirm(text: string): boolean {
  const t = normalizeUtterance(text).toLowerCase()
  if (!t) return false
  if (CONFIRM_PHRASES.has(t)) return true
  if (CONFIRM_INTENT.test(t)) return true
  if (CONFIRM_INTENT_ES.test(t)) return true
  // Internal commas count as separators ("sí, agendalo" → sí + agendalo).
  const words = t.split(/[\s,]+/).filter(Boolean)
  if (words.length === 0 || words.length > 6) return false
  // Every word is a confirm or benign filler, AND at least one is a real confirm
  // word (so a pure-filler phrase like "את זה" never counts).
  return words.every(w => CONFIRM_WORDS.has(w) || CONFIRM_FILLER.has(w)) && words.some(w => CONFIRM_WORDS.has(w))
}

export function isCancel(text: string): boolean {
  const t = normalizeUtterance(text)
  return CANCEL.test(t) || CANCEL_ES.test(t)
}

// ─── Time Parsing ───────────────────────────────────────────────────────────

const HEBREW_HOUR_WORDS: Record<string, number> = {
  'אחת': 1, 'שתיים': 2, 'שלוש': 3, 'ארבע': 4, 'חמש': 5,
  'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10,
  'אחת עשרה': 11, 'שתים עשרה': 12,
}

// Period hints. PM covers evening / noon / afternoon; AM covers morning.
// "אחהצ" (no gershayim) is the common bare abbreviation Martita types.
// "הערב"/"הלילה" (tonight) and "אחה״צ" are PM; "הבוקר" (this morning) is AM.
// A meal noun carries the time of day even without a "ב"-prefixed period word:
// dinner ("ארוחת ערב") = evening, lunch ("ארוחת צהריים") = midday/afternoon, so a bare
// hour ("ארוחת ערב … בשמונה") resolves to 20:00, not an 8 AM dinner. Breakfast
// ("ארוחת בוקר") is morning — also stops a low hour ("ארוחת בוקר בשש") flipping to PM.
const PERIOD_PM = /בערב|הערב|בלילה|הלילה|אחר[י]? הצהריים|אחה"צ|אחה״צ|אחהצ|בצהריים|הצהריים|ארוחת\s+ערב|ארוחת\s+צהריים|דינר|cena|almuerzo|merienda/i
const PERIOD_AM = /בבוקר|הבוקר|לפנות בוקר|ארוחת\s+בוקר|desayuno/i

// Resolve a 1-12 hour to 24h using period hints. With no hint, hours 1-6 are
// taken as PM (appointment convention) and 7-12 stay as the AM reading but are
// flagged ambiguous so the create flow asks "בבוקר או בערב?" instead of
// silently guessing.
function applyPeriod(h: number, t: string): { hour: number; ambiguous: boolean } {
  if (PERIOD_AM.test(t)) return { hour: h >= 12 ? h - 12 : h, ambiguous: false }
  // "בלילה"/"הלילה" for hours 1-5 = after midnight (AM), not PM
  if (/בלילה|הלילה/.test(t) && h >= 1 && h <= 5) return { hour: h, ambiguous: false }
  if (PERIOD_PM.test(t)) return { hour: h >= 1 && h <= 11 ? h + 12 : h, ambiguous: false }
  if (h >= 1 && h <= 6) return { hour: h + 12, ambiguous: false }
  return { hour: h, ambiguous: h >= 7 && h <= 11 }
}

export interface TimeParse {
  time: string | null
  ambiguous: boolean
}

export function parseHebrewTimeDetailed(text: string): TimeParse {
  const t = normalizeCreateText(text.trim())

  // ── Spanish (Rioplatense) clock ──
  // "a las tres", "a la una y media", "a las 3 de la tarde", "a las ocho de la noche".
  const ES_NUM: Record<string, number> = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 }
  const esM = t.match(/\ba\s+las?\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:\s+y\s+(media|cuarto))?(?:\s+de\s+la\s+(tarde|noche|mañana))?/i)
  if (esM) {
    let h = /^\d/.test(esM[1]!) ? parseInt(esM[1]!, 10) : (ES_NUM[esM[1]!.toLowerCase()] ?? -1)
    const min = esM[2] === 'media' ? 30 : esM[2] === 'cuarto' ? 15 : 0
    const period = esM[3]?.toLowerCase()
    if (h >= 0 && h <= 23) {
      let ambiguous = false
      if (period === 'tarde') { if (h >= 1 && h <= 11) h += 12 }
      else if (period === 'noche') { if (h >= 6 && h <= 11) h += 12; else if (h === 12) h = 0 }
      else if (period === 'mañana') { if (h === 12) h = 0 }
      else {
        // no spoken period → meeting default (same logic as the Hebrew word forms)
        const r = applyPeriod(h, t); h = r.hour; ambiguous = r.ambiguous
      }
      return { time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, ambiguous }
    }
  }

  // "בשעה 15:00" / "ב-10:30" / "בשעה 9" / bare "13:22" — numeric clock.
  // The "ב"/"בשעה" prefix is optional so a clock time typed on its own
  // ("בשני 13:22") is still understood.
  const numericTime = t.match(/(?:ב[־-]?)?(?:שעה\s+)?(?<![\d/.])(\d{1,2})[:.](\d{2})(?![\d/])/)
  if (numericTime) {
    const h = parseInt(numericTime[1]!, 10)
    const m = parseInt(numericTime[2]!, 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      // A 1-12 clock time goes through the SAME period logic as the word forms,
      // so "3:00" behaves like "בשלוש" → 15:00 (meeting default = afternoon), and
      // "3:00 בלילה"/"3:00 בבוקר" honour the explicit period. Never literal 03:00
      // for a normal meeting (the iPhone "שלוש בלילה" bug). A daytime hour with no
      // period that is genuinely ambiguous (e.g. 8) returns ambiguous → ask.
      // A 13-23 clock is already unambiguous and stays literal.
      if (h >= 1 && h <= 12) {
        const { hour, ambiguous } = applyPeriod(h, t)
        return { time: `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`, ambiguous }
      }
      return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, ambiguous: false }
    }
  }

  // "בשעה 10" (no minutes) — apply period logic for 1-12 range.
  // "בשעה 3" without context should ask AM/PM, not assume 03:00.
  const hourOnly = t.match(/ב[־-]?שעה\s+(\d{1,2})(?!\s*[:.]?\d)/)
  if (hourOnly) {
    const h = parseInt(hourOnly[1]!, 10)
    if (h >= 13 && h <= 23) return { time: `${String(h).padStart(2, '0')}:00`, ambiguous: false }
    if (h >= 0 && h <= 12) {
      const { hour, ambiguous } = applyPeriod(h, t)
      return { time: `${String(hour).padStart(2, '0')}:00`, ambiguous }
    }
  }

  // Hebrew word hours: "בשעה חמש" / "בשבע בערב" / "בשלוש וחצי" / "בעשר בבוקר".
  // Longest words first so "אחת עשרה" beats "אחת".
  for (const [word, num] of Object.entries(HEBREW_HOUR_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    const pattern = new RegExp(`(?:בשעה\\s+|[בל])${word}(\\s+וחצי)?(\\s+ורבע)?`)
    const match = t.match(pattern)
    if (match) {
      const minutes = match[1] ? 30 : match[2] ? 15 : 0
      const { hour, ambiguous } = applyPeriod(num, t)
      return { time: `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, ambiguous }
    }
  }

  // "השעה חמש" — hour word after the bare label.
  for (const [word, num] of Object.entries(HEBREW_HOUR_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    if (new RegExp(`השעה\\s+${word}`).test(t)) {
      const { hour, ambiguous } = applyPeriod(num, t)
      return { time: `${String(hour).padStart(2, '0')}:00`, ambiguous }
    }
  }

  // BARE hour word directly followed by a period word, NO ב/ל prefix — speech
  // recognition frequently drops the prefix: "שלוש אחר הצהריים", "שבע בערב",
  // "חמש וחצי בערב". The period word disambiguates, so it is never ambiguous.
  const PERIOD_WORD = '(?:אחהצ|אחה"צ|אחה״צ|אחר[י]?\\s+הצהריים|בערב|בבוקר|בצהריים|בלילה)'
  for (const [word, num] of Object.entries(HEBREW_HOUR_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(`(?<![א-ת])${word}(\\s+וחצי|\\s+ורבע)?\\s+${PERIOD_WORD}`)
    const match = t.match(re)
    if (match) {
      const minutes = match[1] ? 30 : match[2] ? 15 : 0
      const { hour, ambiguous } = applyPeriod(num, t)
      return { time: `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, ambiguous }
    }
  }

  // Bare numeric hour followed by a period word: "4 אחהצ", "7 בערב",
  // "10 בבוקר", "4 אחר הצהריים". No colon, no "ב" prefix — the period word
  // disambiguates AM/PM so it is never ambiguous.
  const bareHourPeriod = t.match(/(?<![\d:.])(\d{1,2})\s*(?:אחהצ|אחה"צ|אחה״צ|אחר[י]?\s+הצהריים|בערב|בבוקר|בצהריים|בלילה)/)
  if (bareHourPeriod) {
    const h = parseInt(bareHourPeriod[1]!, 10)
    if (h >= 0 && h <= 23) {
      const { hour, ambiguous } = applyPeriod(h, t)
      return { time: `${String(hour).padStart(2, '0')}:00`, ambiguous }
    }
  }

  // "בצהריים" with no explicit hour = 12:00. Checked AFTER hour words so
  // "בשתיים בצהריים" resolves to 14:00, not noon.
  if (/בצהריים/.test(t)) return { time: '12:00', ambiguous: false }

  // "חצות היום" = noon (12:00); bare "חצות" / "בחצות" / "חצות הלילה" = midnight (00:00).
  // A real time — never re-ask "באיזו שעה" after the user already said "בחצות".
  if (/חצות\s+היום/.test(t)) return { time: '12:00', ambiguous: false }
  if (/(?<![א-ת])ב?חצות(?![א-ת])/.test(t)) return { time: '00:00', ambiguous: false }

  return { time: null, ambiguous: false }
}

export function parseHebrewTime(text: string): string | null {
  return parseHebrewTimeDetailed(text).time
}

// Resolve an ambiguous tentative time given a period-only follow-up
// ("בבוקר" / "בערב"). Preserves the minutes of the tentative time.
function resolvePeriodFollowup(time: string, text: string): string | null {
  const [hStr, mStr] = time.split(':')
  const base = parseInt(hStr!, 10) % 12
  if (/בוקר/.test(text)) return `${String(base).padStart(2, '0')}:${mStr}`
  if (/ערב|לילה|צהריים|אחה|אחר הצהר/.test(text)) {
    return `${String(base + 12).padStart(2, '0')}:${mStr}`
  }
  return null
}

// ─── Date Parsing (extends dateParser.ts with relative dates) ───────────────

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr(): string {
  return localDateStr(new Date())
}

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return localDateStr(d)
}

function nextDayOfWeek(dayIndex: number): string {
  const d = new Date()
  const current = d.getDay()
  let diff = dayIndex - current
  if (diff <= 0) diff += 7
  d.setDate(d.getDate() + diff)
  return localDateStr(d)
}

// Weekday `dayIndex` in the FOLLOWING calendar week (week starts Sunday).
function weekdayInNextWeek(dayIndex: number): string {
  const d = new Date()
  let daysToNextSunday = (7 - d.getDay()) % 7
  if (daysToNextSunday === 0) daysToNextSunday = 7
  d.setDate(d.getDate() + daysToNextSunday + dayIndex)
  return localDateStr(d)
}

export function parseCreateDate(text: string): string | null {
  const t = text.trim()

  // Hebrew relative-day cues (היום/מחר/מחרתיים). When MORE THAN ONE appears — a
  // rambling story with a CONTEXT "היום" ("דיברתי היום…") AND a meeting "מחר"
  // ("להיפגש מחר בשלוש") — pick the cue NEAREST a time expression: a meeting's date
  // and time are stated together. Structural (date↔time proximity), not a phrase list.
  // A single cue keeps the original behaviour exactly.
  // Forward-only guards (no lookbehind — the ל/ב prefixes in "להיום"/"במחר" are
  // Hebrew letters). "מחר(?![תי])" excludes "מחרתיים"; "מחרתיים" is collected on its own.
  const heDay: Array<{ re: RegExp; resolve: () => string }> = [
    { re: /מחרתיים/gu, resolve: () => { const d = new Date(); d.setDate(d.getDate() + 2); return localDateStr(d) } },
    { re: /מחר(?![תי])/gu, resolve: () => tomorrowStr() },
    { re: /היום/gu, resolve: () => todayStr() },
  ]
  const hits: Array<{ idx: number; resolve: () => string }> = []
  for (const { re, resolve } of heDay) { let m: RegExpExecArray | null; while ((m = re.exec(t))) hits.push({ idx: m.index, resolve }) }
  if (hits.length === 1) return hits[0]!.resolve()
  if (hits.length > 1) {
    const timeM = t.match(/בשעה|(?<![א-ת])ב?(?:אחת עשרה|שתים עשרה|אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)(?![א-ת])|ב[־-]?\d{1,2}(?::\d{2})?/u)
    if (timeM && typeof timeM.index === 'number') {
      const ti = timeM.index
      hits.sort((a, b) => Math.abs(a.idx - ti) - Math.abs(b.idx - ti))
    } else {
      hits.sort((a, b) => b.idx - a.idx) // no time cue → the LAST date word (meeting details follow context)
    }
    return hits[0]!.resolve()
  }

  // ── Spanish (Rioplatense) dates ──
  // Strip "(de|por) la mañana" first so it is read as the MORNING period, never
  // as "mañana" = tomorrow ("a las tres de la mañana" is 3am, not tomorrow).
  const esT = t.replace(/(?:de|por)\s+la\s+mañana/gi, ' ')
  if (/\bpasado\s+mañana\b/i.test(esT)) { const d = new Date(); d.setDate(d.getDate() + 2); return localDateStr(d) }
  if (/\bhoy\b/i.test(esT)) return todayStr()
  if (/\bmañana\b/i.test(esT)) return tomorrowStr()
  if (/\bla\s+semana\s+que\s+viene\b/i.test(esT)) { const d = new Date(); d.setDate(d.getDate() + 7); return localDateStr(d) }
  const esDays: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, 'miércoles': 3, miercoles: 3, jueves: 4, viernes: 5, 'sábado': 6, sabado: 6 }
  for (const [name, idx] of Object.entries(esDays)) {
    if (new RegExp(`\\b(?:el\\s+)?${name}(?:\\s+que\\s+viene)?\\b`, 'i').test(esT)) return nextDayOfWeek(idx)
  }

  // Day of week with natural modifiers:
  //   "ביום חמישי", "יום חמישי", "בחמישי", "חמישי הקרוב", "חמישי הבא",
  //   "בשבוע הבא ביום שלישי".
  // "הקרוב"/"הבא" → next occurrence of that weekday. "שבוע הבא" present →
  // that weekday in the following calendar week.
  const dayNames: Record<string, number> = {
    'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3,
    'חמישי': 4, 'שישי': 5, 'שבת': 6,
    // Common typo: "רביע" (missing final yod). Checked last so the correct
    // "רביעי" always wins first.
    'רביע': 3,
  }
  const inNextWeek = /שבוע\s+הבא/.test(t)
  for (const [name, idx] of Object.entries(dayNames)) {
    // Either: a prefixed weekday (ביום/יום/ב + name), OR a bare name carrying
    // an explicit הקרוב/הבא modifier. The Hebrew negative-lookahead avoids
    // matching the name as a prefix of a longer word.
    const re = new RegExp(
      `(?:[בל]?יום\\s+|[בל])${name}(?![\\u0590-\\u05FF])|(?<![\\u0590-\\u05FF])${name}\\s+(?:הקרוב|הבא)`,
    )
    if (re.test(t)) {
      return inNextWeek ? weekdayInNextWeek(idx) : nextDayOfWeek(idx)
    }
  }

  // "בעוד שבוע" / bare "בשבוע הבא" (next week with no weekday named) → +7 days.
  // Checked AFTER the weekday loop so "בשבוע הבא ביום שלישי" still resolves to that
  // weekday. Fixes the draft-stuck-in-creating bug the autonomous gauntlet found
  // (a bare "next week" left the date missing, so a later confirm could not save).
  if (/בעוד שבוע/.test(t) || /(?:^|\s)ב?שבוע\s+הבא(?![א-ת])/.test(t)) {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return localDateStr(d)
  }

  // FALLBACK (after all explicit dates): "הערב"/"הלילה"/"הבוקר" (this evening /
  // tonight / this morning) imply TODAY when no other date was given. Excludes
  // "הצהריים" — it is part of "אחר הצהריים" (afternoon, a time, any day).
  if (/(?<![א-ת])ה(?:ערב|לילה|בוקר)(?![א-ת])/.test(t)) return todayStr()

  // Fall back to existing dateParser (handles "ב-15 באפריל", etc.)
  return parseHebrewDate(t)
}

// ─── Title Extraction ───────────────────────────────────────────────────────

// Explanation clauses to strip ("כי היא ביקשה...", "אם...")
// Hebrew has no \b word boundary — use space/start-of-string anchor
const EXPLANATION_NOISE = /\s+(?:כי|כיוון ש|בגלל ש|למרות ש)\s.*/gi
// Intent prefixes to strip (anywhere, not just start)
const NOISE_PHRASES = /(תקבעי? לי|תרשמי? לי|תוסיפי? לי|תזכירי? לי|תכניסי? לי|תעשי? לי|שימי? לי|קבעי? לי|רשמי? לי|תכניסי? ליומן|תשימי? ביומן|ביומן|ליומן|צריכה? לקבוע|רוצה? לקבוע|אני רוצה|יש לי)\s*/gi
// Natural speech verbs
const NATURAL_NOISE = /(אני צריכה? להיות|אני צריכה? להגיע|אני צריכה? ללכת|אני צריכה? לנסוע|אני צריכה?)\s*/gi
// Time words to strip (includes אחת/שתיים and the noon period word)
const TIME_NOISE = /\s*[בל](אחת עשרה|שתים עשרה|אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|צהריים)(\s+וחצי|\s+ורבע)?(\s+בבוקר|\s+בערב|\s+בצהריים|\s+אחר הצהריים|\s+אחרי הצהריים|\s+בלילה)?\s*/gi
// Date words to strip — incl. weekday phrases with prefix or הקרוב/הבא modifier
// ("רביע" = common typo for רביעי)
const WEEKDAY_NAMES = '(?:ראשון|שני|שלישי|רביעי|רביע|חמישי|שישי|שבת)'
const DATE_NOISE = new RegExp(
  `\\s*(?:היום|מחרתיים|מחר|בשבוע הבא|שבוע הבא|בעוד שבוע|` +
  `(?:[בל]?יום\\s+|[בל])${WEEKDAY_NAMES}(?:\\s+(?:הקרוב|הבא))?|` +
  `${WEEKDAY_NAMES}\\s+(?:הקרוב|הבא))\\s*`,
  'gi',
)
const HOUR_NOISE = /\s*[בל]שעה\s+(?:אחת עשרה|שתים עשרה|אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)(?:\s+וחצי|\s+ורבע)?\s*/gi
const HOUR_DIGIT_NOISE = /\s*ב[־-]?(?:שעה\s+)?\d{1,2}[:.:]?\d{0,2}\s*/gi
// Bare clock time with no "ב" prefix: "13:22", "14.00".
const BARE_TIME_NOISE = /\s*(?<![\d/])\d{1,2}[:.]\d{2}(?![\d/])\s*/g
// Bare hour + period word: "4 אחהצ", "7 בערב".
const BARE_HOUR_PERIOD_NOISE = /\s*\d{1,2}\s*(?:אחהצ|אחה"צ|אחה״צ|אחר[י]? הצהריים|בערב|בבוקר|בצהריים|בלילה)\s*/gi
// Standalone time-of-day words (when not part of a time phrase already stripped)
const PERIOD_NOISE = /(בבוקר|בערב|בלילה|בצהריים|הערב|הלילה|הבוקר|הצהריים|אחר הצהריים|אחרי הצהריים|אחהצ|אחה"צ|אחה״צ)/gi
// Leading scheduling verb without "לי" ("תקבע עם מור" → "עם מור").
const SCHEDULE_VERB_LEAD = /^(?:תקבעי|תקבע|קבעי|קבע|נקבע|אקבע|תרשמי|תרשום|רשמי|שימי|תשימי|תוסיפי|תוסיף|תזכירי|תכניסי|תכניס|תעשי)\s+(?:לי\s+)?/
// Connector word leftover
const LEADING_CONNECTOR = /^[שו]\s+/

// Leading conversational connectors ("אז תקבעי…", "טוב תרשמי…") that sit BEFORE
// the scheduling verb and would otherwise defeat the ^-anchored verb strip,
// leaking into the title. One-or-more, stripped from the start.
const LEADING_TALK_LEAD = /^(?:(?:אז ככה|אז|טוב|אוקיי|אוקי|בסדר|נו|הי+|תשמעי|שמעי|בקיצור|יעני|כאילו|אהה?)\s+)+/u

export function extractTitle(text: string): string | null {
  let t = normalizeCreateText(text.trim())
  // 1. Strip explanation clauses first
  t = t.replace(EXPLANATION_NOISE, '')
  // 2. Strip a leading conversational lead, then intent phrases / verbs.
  t = t.replace(LEADING_TALK_LEAD, '')
  t = t.replace(NOISE_PHRASES, ' ')
  t = t.replace(NATURAL_NOISE, ' ')
  t = t.replace(SCHEDULE_VERB_LEAD, ' ')
  // 3. Strip time/date
  t = t.replace(HOUR_NOISE, ' ')
  t = t.replace(TIME_NOISE, ' ')
  t = t.replace(BARE_HOUR_PERIOD_NOISE, ' ')
  t = t.replace(DATE_NOISE, ' ')
  t = t.replace(HOUR_DIGIT_NOISE, ' ')
  t = t.replace(BARE_TIME_NOISE, ' ')
  t = t.replace(PERIOD_NOISE, ' ')
  // 4. Clean up
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(LEADING_CONNECTOR, '')
  // Strip trailing politeness / filler words ("…בבקשה", "…תודה", "…טוב") so they
  // never land in the saved title. One-or-more, repeated.
  t = t.replace(/(?:\s+(?:בבקשה|תודה רבה|תודה|אוקיי|אוקי|טוב|נו|כבר|אז))+\s*$/u, '').trim()
  t = t.replace(/[.!?,;]+$/, '').trim()
  // A bare "עם <person>" is a meeting — restore the implicit noun so the
  // stored title is "פגישה עם אופיר", never just "עם אופיר".
  if (/^עם\s/.test(t)) t = `פגישה ${t}`
  return t.length >= 2 ? t : null
}

// ─── Full Intent Parse ──────────────────────────────────────────────────────

export interface ParsedCreateIntent {
  draft: CreateDraft
  missing: Array<'title' | 'date' | 'time'>
}

export function parseCreateIntent(text: string): ParsedCreateIntent | null {
  if (!isCreateIntent(text)) return null

  // ─── Dedicated extraction pass (runs BEFORE title/date/time) ──────────
  // Pulls WHO / WHERE / SUBJECT / notes out of the whole utterance and hands
  // back a residual with the venue + topic phrases removed, so the title stays
  // clean ("פגישה עם אלכסנדרה") instead of swallowing "בקפה גרג רעננה על …".
  const event = extractEventDetails(text)

  let title = extractTitle(event.residualText)
  // Resolve a family relation phrase in the title to the concrete person through
  // the ONE morphology seam: "בת הזוג של מור"→יעל, "החברה של מור"→יעל, "החתן של
  // מור"→גלעד, "הבת של מרטיטה"→מור. Single-referent only (an ambiguous multi-person
  // reference like "הילדים של מור" stays literal). Lazy require breaks the cycle.
  if (title && /\sשל\s/u.test(title)) {
    const ref = resolveSinglePerson(title)
    if (ref) title = title.replace(ref.span, ref.person)
  }
  // Title fallback: a bare "פגישה עם <person>" when the title extractor came up
  // empty but we did capture a person.
  if (!title && event.person) title = `פגישה עם ${event.person}`

  const date = parseCreateDate(text)
  const { time, ambiguous } = parseHebrewTimeDetailed(text)
  const emoji = title ? detectEmoji(title) : '📅'

  const missing: Array<'title' | 'date' | 'time'> = []
  if (!title) missing.push('title')
  if (!date) missing.push('date')
  // No time, OR an understood-but-ambiguous time, both need clarification.
  if (!time || ambiguous) missing.push('time')

  return {
    draft: {
      title, date, time, ambiguousTime: ambiguous, emoji,
      person: event.person,
      location: event.location,
      subject: event.subject,
      notes: event.notes,
    },
    missing,
  }
}

// ─── State Transitions ──────────────────────────────────────────────────────

export function startCreate(text: string): CalendarCreateState {
  // Pipeline step 1: clean the (often messy / voice) transcript, then repair
  // obvious Hebrew STT slips (שחירות→שכירות, "אחר צהריים"→"אחר הצהריים") BEFORE
  // parsing so the extractor never sees garbage.
  const rawTranscript = text
  const cleaned = recoverHebrewStt(cleanTranscript(text)).text
  const parsed = parseCreateIntent(cleaned)
  if (!parsed) return IDLE_STATE

  // Meeting Intelligence: refine the base draft with discourse-level
  // understanding (cross-clause time, purpose/subject synthesis, clean notes,
  // narrative-stripped title). Lazy require breaks the module cycle (same
  // pattern as the familyGraph require in parseCreateIntent).
  const refined: CreateDraft = refineMeeting(parsed.draft, cleaned)

  // Recompute missing critical fields AFTER refinement (the engine may have
  // resolved a previously-missing time or title).
  const missing: Array<'title' | 'date' | 'time'> = []
  if (!refined.title) missing.push('title')
  if (!refined.date) missing.push('date')
  if (!refined.time || refined.ambiguousTime) missing.push('time')

  const draft: CreateDraft = {
    ...refined,
    rawTranscript,
    cleanedTranscript: cleaned,
    confidence: scoreConfidence(refined, missing),
  }

  if (missing.length === 0) {
    return { phase: 'confirming', draft, missing: [] }
  }
  return { phase: 'creating', draft, missing }
}

/** Process a follow-up message while in creating/confirming phase. */
export function updateCreate(state: CalendarCreateState, text: string): CalendarCreateState {
  const t = text.trim()

  // Cancel always works
  if (isCancel(t)) return IDLE_STATE

  // If confirming, check for yes/no
  if (state.phase === 'confirming') {
    if (isConfirm(t)) return state // caller handles save
    // Not a confirm — user may be correcting. Try to re-parse
    // date/time from their message even though fields are filled.
    const correctionDraft = { ...state.draft }
    let corrected = false
    const newDate = parseCreateDate(t)
    if (newDate && newDate !== correctionDraft.date) {
      correctionDraft.date = newDate
      corrected = true
    }
    const { time: newTime, ambiguous } = parseHebrewTimeDetailed(t)
    if (newTime) {
      // A correction like "בעצם בשמונה" gives a bare, AM/PM-ambiguous hour. When
      // a time is already set, inherit its period (19:00 + "שמונה" → 20:00) — what
      // a human assistant infers — instead of re-asking. An unambiguous time wins
      // outright.
      let resolved = newTime
      if (ambiguous && correctionDraft.time) {
        const existingH = parseInt(correctionDraft.time.split(':')[0] ?? '0', 10)
        const [nh, nm] = newTime.split(':')
        const newH = parseInt(nh ?? '0', 10)
        if (existingH >= 12 && newH >= 1 && newH <= 11) resolved = `${String(newH + 12).padStart(2, '0')}:${nm}`
        else if (existingH < 12 && newH >= 13) resolved = `${String(newH - 12).padStart(2, '0')}:${nm}`
      }
      if ((!ambiguous || correctionDraft.time) && resolved !== correctionDraft.time) {
        correctionDraft.time = resolved
        correctionDraft.ambiguousTime = false
        corrected = true
      }
    } else if (correctionDraft.time) {
      // A BARE period correction with no new hour ("לא בערב" / "בערב" / "בבוקר") after a
      // defaulted ambiguous hour ("...בשמונה בבוקר. נכון?"). Flip the AM/PM of the time
      // already set. Tie-break #1: never lose a correction — this used to fall through
      // to the "unclear" loop-breaker so a following "כן" silently saved the wrong time.
      const flipped = resolvePeriodFollowup(correctionDraft.time, t)
      if (flipped && flipped !== correctionDraft.time) {
        correctionDraft.time = flipped
        correctionDraft.ambiguousTime = false
        corrected = true
      }
    }
    // PERSON correction ("לא, לא עם דני, עם מור") — swap the companion + rewrite the title.
    // Requires a negation + a NEW "עם/אצל <name>" different from the current person, so a
    // bare "לא" (handled as cancel earlier) is never mis-read as a person change.
    if (/(?<![א-ת])לא(?![א-ת])/u.test(t)) {
      const names = [...t.matchAll(/(?:עם|אצל)\s+([֐-׿][֐-׿'׳]+(?:\s+[֐-׿][֐-׿'׳]+)?)/gu)]
      if (names.length > 0) {
        const newPerson = names[names.length - 1]![1]!.trim()
        if (newPerson && newPerson !== (correctionDraft.person ?? '').trim()) {
          correctionDraft.person = newPerson
          correctionDraft.title = /עם\s+/u.test(correctionDraft.title ?? '')
            ? (correctionDraft.title ?? '').replace(/עם\s+.*$/u, `עם ${newPerson}`)
            : `פגישה עם ${newPerson}`
          corrected = true
        }
      }
    }
    if (corrected) {
      return { phase: 'confirming', draft: correctionDraft, missing: [] }
    }
  }

  // Try to fill missing fields from the new message
  const draft = { ...state.draft }
  const stillMissing = [...state.missing]

  // "עם X" (or a bare person) during an incremental build is the PERSON slot, not a
  // literal title — capture the person and default a natural title "פגישה עם X" so
  // the create isn't stuck re-asking "מה לרשום?" (which then trips the loop-breaker).
  const personOnly = t.match(/^עם\s+([֐-׿]{2,}(?:\s+[֐-׿]{2,})?)\s*[?.!]*$/u)
  if (stillMissing.includes('title') && personOnly && personOnly[1]) {
    const per = personOnly[1].trim()
    draft.person = draft.person ?? per
    draft.title = `פגישה עם ${per}`
    draft.emoji = draft.emoji || '📅'
    const idx = stillMissing.indexOf('title')
    if (idx !== -1) stillMissing.splice(idx, 1)
  }

  // Title — but not if the text is a confirmation/cancel word
  // If user confirms with only title missing, use default "פגישה"
  if (stillMissing.includes('title') && isConfirm(t)) {
    draft.title = 'פגישה'
    draft.emoji = '📌'
    const idx = stillMissing.indexOf('title')
    if (idx !== -1) stillMissing.splice(idx, 1)
  } else if (stillMissing.includes('title') && !isCancel(t)) {
    const title = extractTitle(t) ?? t.replace(/[.!?,;]+$/, '').trim()
    if (title.length >= 2) {
      draft.title = title
      draft.emoji = detectEmoji(title)
      const idx = stillMissing.indexOf('title')
      if (idx !== -1) stillMissing.splice(idx, 1)
    }
  }

  // Date
  if (stillMissing.includes('date')) {
    const date = parseCreateDate(t)
    if (date) {
      draft.date = date
      const idx = stillMissing.indexOf('date')
      if (idx !== -1) stillMissing.splice(idx, 1)
    }
  }

  // Time
  if (stillMissing.includes('time')) {
    const removeTime = () => {
      const idx = stillMissing.indexOf('time')
      if (idx !== -1) stillMissing.splice(idx, 1)
    }
    const { time, ambiguous } = parseHebrewTimeDetailed(t)
    if (time && !ambiguous) {
      // A clear time in this message wins.
      draft.time = time
      draft.ambiguousTime = false
      removeTime()
    } else if (draft.ambiguousTime && draft.time) {
      // We already heard the hour; this message may just resolve בבוקר/בערב.
      const resolved = resolvePeriodFollowup(draft.time, t)
      if (resolved) {
        draft.time = resolved
        draft.ambiguousTime = false
        removeTime()
      }
    } else if (time && ambiguous) {
      // A fresh bare hour that is AM/PM-ambiguous (7–11). PARITY with the single-utterance
      // smart layer (understandMeetingSmart / cognitiveRuntime calendar_create), which
      // resolves such an hour to its stated reading and moves straight to confirming.
      // The fragment path must behave IDENTICALLY: accept the default reading, move to
      // confirming, and let Martita correct it there ("בשמונה בבוקר. נכון?" → "לא, בערב").
      // Keeping it ambiguous forever meant a following "כן" could never complete the
      // create and dead-ended in the loop-breaker (fragment ≠ single-utterance = a
      // typed/voice parity bug). Correction after confirm is still fully supported
      // (updateCreate's confirming branch re-parses a period follow-up).
      draft.time = time
      draft.ambiguousTime = false
      removeTime()
    }
  }

  // Enrich location / subject / notes / person from this follow-up too — a
  // clarification like "ב-10 בבוקר בקפה נורדאו" carries a LOCATION, not only a
  // time. Merge only into still-empty fields (never overwrite a confirmed value).
  const ev = extractEventDetails(t)
  if (ev.location && !draft.location) draft.location = ev.location
  if (ev.subject && !draft.subject) draft.subject = ev.subject
  if (ev.notes && !draft.notes) draft.notes = ev.notes
  if (ev.person && !draft.person) draft.person = ev.person

  if (stillMissing.length === 0) {
    return { phase: 'confirming', draft, missing: [] }
  }
  return { phase: 'creating', draft, missing: stillMissing }
}

// ─── Friendly date label (inline to avoid circular import with responseShaper) ──

const WEEKDAY_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function friendlyDateLabel(date: string): string {
  const today = new Date().toISOString().split('T')[0]!
  const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]!
  if (date === today) return 'היום'
  if (date === tmrw) return 'מחר'
  const d = new Date(date + 'T00:00:00')
  const dayName = WEEKDAY_LABELS[d.getDay()] ?? ''
  const day = d.getDate()
  const MONTH_LABELS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const monthName = MONTH_LABELS[d.getMonth()] ?? ''
  return `ביום ${dayName}, ${day} ב${monthName}`
}

// ─── Calendar Search Intent ─────────────────────────────────────────────────

const SEARCH_INTENT = /מתי\s+(ה?(פגישה|תור|ביקור|אירוע)\s+(עם|אצל)\s+\S+)|מתי\s+ה?(רופא|רופאה|רופאת|שיניים|עיניים)|מה קבעתי עם|יש לי (פגישה|תור) עם/i

export function isSearchIntent(text: string): boolean {
  return SEARCH_INTENT.test(text.trim())
}

export function searchAppointments(text: string): string {
  // Dynamic import to avoid circular dependency
  const { loadAppointments } = require('../AbuCalendar/service') as { loadAppointments: () => Array<{ id: string; title: string; date: string; time?: string }> }
  const appts = loadAppointments()
  if (appts.length === 0) return 'אין כלום ביומן כרגע.'

  // Extract search term from "עם X" or "אצל X"
  const nameMatch = text.match(/עם\s+(\S+)|אצל\s+(\S+)/)
  const searchTerm = nameMatch?.[1] ?? nameMatch?.[2] ?? ''

  // Also check for role words (רופא, שיניים, etc.)
  const roleMatch = text.match(/ה?(רופא|רופאה|רופאת|שיניים|עיניים)/)
  const roleTerm = roleMatch?.[1] ?? ''

  const query = (searchTerm + ' ' + roleTerm).trim().toLowerCase()
  if (!query) return 'מה לחפש? תגידי לי שם או סוג פגישה.'

  const matches = appts.filter((a: { title: string }) =>
    a.title.toLowerCase().includes(query) ||
    (searchTerm && a.title.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (matches.length === 0) return `אין פגישה עם "${searchTerm || roleTerm}" ביומן.`
  if (matches.length === 1) {
    const m = matches[0]!
    const time = m.time ? ` בשעה ${m.time}` : ''
    return `${m.title} — ${friendlyDateLabel(m.date)}${time}.`
  }
  // Multiple matches
  const lines = matches.slice(0, 3).map((m: { title: string; date: string; time?: string }) => {
    const time = m.time ? ` בשעה ${m.time}` : ''
    return `${m.title} — ${friendlyDateLabel(m.date)}${time}`
  })
  return `יש ${matches.length} פגישות:\n${lines.join('\n')}`
}

// ─── Calendar Delete Intent ─────────────────────────────────────────────────

const DELETE_INTENT = /תמחק[י]?\s+(את\s+)?(ה?(פגישה|תור|אירוע))|תבטל[י]?\s+(את\s+)?(ה?(פגישה|תור|אירוע))|למחוק\s+(את\s+)?(ה?(פגישה|תור))/i

export function isDeleteIntent(text: string): boolean {
  return DELETE_INTENT.test(text.trim())
}

// ─── Calendar Modify Intent ─────────────────────────────────────────────────

const MODIFY_INTENT = /תזיז[י]?\s|תשנ[י]?\s|תעביר[י]?\s|בעצם\s+(ב|ל)|תעדכנ[י]?\s|לשנות\s|להזיז\s/i

export function isModifyIntent(text: string): boolean {
  return MODIFY_INTENT.test(text)
}

// ─── Pending-confirmation Recovery ──────────────────────────────────────────
//
// Resolves a follow-up message that arrives while a create draft is pending
// (creating or confirming). Pure + deterministic so the runtime never blindly
// repeats the same confirmation. `isCalendarReadQuery` is passed in by the
// caller (computed via the router) to avoid a circular import — the router
// imports this module.

export type PendingResolution =
  | { action: 'cancel' }
  | { action: 'save'; draft: CreateDraft }
  | { action: 'replace'; state: CalendarCreateState }
  | { action: 'read' }
  | { action: 'clarify' }
  | { action: 'update'; state: CalendarCreateState }
  // An unrelated current-info question (sports/weather/news) arrived mid-create.
  // Park the pending draft and let the runtime answer the new topic fresh, so a
  // pending calendar never gets answered as a sports/weather confirmation.
  | { action: 'park'; query: string; parked: CalendarCreateState }
  // A side question/topic mid-create (family/date/greeting/off-topic) — ANSWER it
  // but KEEP the pending draft so conversation state survives ("כן" still confirms).
  | { action: 'park_keep'; query: string; parked: CalendarCreateState }
  // "אני לא שומע אותך" / "למה את לא מדברת" — an AUDIO complaint, never a calendar
  // cancel. Respond about audio and KEEP the pending draft (state unchanged).
  | { action: 'audio_help'; message: string; keep: CalendarCreateState }

// A feeling statement (he/es) — during a pending create it must park + warm-answer,
// never cancel coldly. Kept narrow so a scheduling phrase never matches.
const EMOTIONAL_STATEMENT = /מתגעג|התגעג|פאפי|פפה|חסר לי|בוד[דת]|(?<![א-ת])לבד(?![א-ת])|עצוב|עצבת|בוכה|בכי|דואג|געגוע|קשה לי|משעמם לי|מדוכא|(?<![a-zé])(?:sola|solo|triste|extraño|me siento|deprim)(?![a-zé])/i

// An AUDIO / voice complaint ("אני לא שומע אותך", "למה את לא מדברת", "נקטע",
// "הקול נעלם") — must get an audio-help reply, never a calendar cancel/clarify.
const AUDIO_COMPLAINT = /לא\s+שומע|לא\s+שומעת|לא\s+שומעים|למה\s+את\s+לא\s+מדברת|את\s+לא\s+מדברת|לא\s+מדברת\s+איתי|נקטע|נקטעת|מקוטע|מתקטע|הקול\s+(?:נעלם|נגמר|נחתך|לא\s+עובד)|אין\s+קול|נעלם\s+הקול|לא\s+נשמע|no\s+te\s+escucho|no\s+se\s+escucha/i

export function resolvePendingMessage(
  state: CalendarCreateState,
  text: string,
  isCalendarReadQuery: boolean,
): PendingResolution {
  const t = text.trim()
  // Normalised form (deduped words, stripped politeness) for the intent matchers —
  // field extraction below still uses the raw `t`.
  const norm = normalizeUtterance(text)

  // Explicit cancel always wins.
  if (isCancel(t)) return { action: 'cancel' }

  // Explicit confirmation while confirming → save.
  if (state.phase === 'confirming' && isConfirm(t)) {
    return { action: 'save', draft: state.draft }
  }

  // AUDIO complaint mid-create → help with audio, KEEP the draft. Never a cold
  // "בסדר, ביטלתי" or a calendar clarify (the exact iPhone failure).
  if (AUDIO_COMPLAINT.test(norm)) {
    return { action: 'audio_help', message: 'רגע, אני כאן. אם לא שמעת אותי, נסי להעלות את עוצמת הקול או ללחוץ שוב על הכפתור. הפגישה שלך עדיין שמורה כטיוטה — נמשיך כשתשמעי אותי.', keep: state }
  }

  // A calendar SEARCH mid-create ("מתי יש לי פגישה עם מוטי", "יש לי משהו עם מור")
  // must be ANSWERED, never forced into the create machine (the stress harness
  // reproduced a robotic "באיזה יום?" loop). Checked BEFORE the create heuristic,
  // which greedily matches "פגישה". Answer + KEEP the draft. NOTE: "תשני את הפגישה
  // ל…" edits the DRAFT (handled as an update below), so it is NOT parked here.
  if (/^מתי\s+.*(?:יש\s+לי|פגיש|תור|ביקור)/u.test(t) || /(?:^|\s)יש\s+לי\s+(?:משהו|פגיש\S*|תור)\s+(?:עם|אצל|ב)/u.test(t)) {
    return { action: 'park_keep', query: t, parked: state }
  }

  // A brand-new create request replaces the pending draft.
  if (isCreateIntent(t)) {
    const next = startCreate(t)
    if (next.phase !== 'idle') return { action: 'replace', state: next }
  }

  // A calendar read query while pending → answer from local calendar.
  if (isCalendarReadQuery) return { action: 'read' }

  // Pending-state hygiene: an unrelated current-info question (sports / weather /
  // news) mid-create must NOT be forced into the calendar machine. Park the draft
  // and let the runtime answer the new topic — never answer sports as a calendar
  // confirmation, never silently cancel.
  if (isOnlineCurrentInfoQuery(t) && !isConfirm(t)) {
    return { action: 'park_keep', query: t, parked: state }
  }

  // An EMOTIONAL statement mid-create ("אני מתגעגעת לפאפי", "estoy sola") must NOT
  // be answered with a cold "בסדר, ביטלתי" or mis-parsed as a date/field. Answer
  // warmly and KEEP the draft (found by the production simulator).
  if (EMOTIONAL_STATEMENT.test(norm) && !isConfirm(t)) {
    return { action: 'park_keep', query: t, parked: state }
  }

  // A QUESTION or GREETING mid-create ("מה הקשר בין רפי ללאו", "מה השעה", "מה שלומך",
  // "איך בדיוק", "מה הסרטים בכפר סבא", "בוקר טוב") is NOT a calendar field — ANSWER it
  // and KEEP the draft, never a "רגע, את רוצה שאקבע?" loop or a mis-merged venue
  // ("בכפר סבא"). Checked BEFORE the location merge. Reads/searches were handled above.
  if (/^(?:מי|מה|מתי|איפה|איך|למה|כמה|האם)(?:\s|$)/u.test(t) || /\?\s*$/u.test(t)
      || /^(?:בוקר טוב|ערב טוב|צהריים טובים|לילה טוב|מה שלומך|מה נשמע|היי|שלום|הא?לו)(?![א-ת])/u.test(t)) {
    return { action: 'park_keep', query: t, parked: state }
  }

  // A bare LOCATION phrase ("בבית קפה מרוקו", "בקפה נורדאו", "אצל גבי") while a
  // draft is pending → merge it, never cancel. Detected before the off-topic
  // guard so a multi-word venue is not mistaken for an unrelated subject.
  if (looksLikeLocationOnly(t)) {
    const merged = updateCreate(state, t)
    if (!merged.draft.location) {
      // "בבית" (at home) / "אצל גבי" (at Gabi's) — the extractor leaves these to
      // us; set the spoken location verbatim so the merge is never empty.
      const atSomeone = /^אצל\s+(.+)$/u.exec(t)
      const enSomewhere = /^en\s+(.+)$/i.exec(t)
      if (/^בבית(?![א-ת])/u.test(t)) merged.draft = { ...merged.draft, location: 'בבית' }
      else if (atSomeone) merged.draft = { ...merged.draft, location: `אצל ${atSomeone[1]!.trim()}` }
      else if (enSomewhere) merged.draft = { ...merged.draft, location: enSomewhere[1]!.trim() }
    }
    return { action: 'update', state: merged }
  }

  // A PERSON correction while pending ("לא, לא עם דני, עם מור") — a negation + a NEW
  // "עם/אצל <name>". Hand it to updateCreate (which swaps the companion + rewrites the
  // title), never park it as an off-topic side question. Checked before the off-topic guard.
  if (/(?<![א-ת])לא(?![א-ת])/u.test(t) && /(?:עם|אצל)\s+[֐-׿]{2,}/u.test(t)) {
    const merged = updateCreate(state, t)
    if (merged.draft.person !== state.draft.person) return { action: 'update', state: merged }
  }

  // A full NEW-meeting narrative mid-create ("אופיר ביקשה שאבוא מחר בשלוש אליה
  // הביתה") — day + time + a place/person cue + several words — REPLACES the pending
  // draft: park + re-run so the fresh create path builds it (never a clarify loop).
  // Short field answers ("מחר בשלוש") lack the place/person cue + length and are kept.
  if (/(?:מחר|מחרתיים|היום|הערב|ביום\s+\S+)/u.test(t)
      && /(?:בשעה|ב\d|בבוקר|בערב|בצהריים|וחצי|ב(?:שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|אחת|שתיים))/u.test(t)
      && /(?:אצל|אלי[הו]|הביתה|ביקש[הת]?|אמר[הת]?\s+ש|עם\s+[א-ת]{2,})/u.test(t)
      && t.split(/\s+/).length >= 5) {
    return { action: 'park', query: t, parked: state }
  }

  // Off-topic detection: if the user switches to a completely different
  // subject (no date, no time, no scheduling word, not a question about
  // a person or the calendar), PARK the pending draft and answer the new
  // topic — NEVER a cold "בסדר, ביטלתי" (a false cancellation the stress
  // harness reproduced for "ספרי לי על המהפכה", "לא התכוונתי לזה, מה …").
  // Examples: "אני קצת משועממת היום", "ספרי לי בדיחה"
  // NOT off-topic: "מי זה מור?", "מה יש לי מחר?", "בעשר בבוקר"
  const hasDateOrTime = /מחר|מחרתיים|היום|אתמול|שבוע|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|בבוקר|בערב|בצהריים|בלילה|הערב|הלילה|הבוקר|בשעה|ב[־-]?\d|אחרי|אחר\s+הצהריים|לפני|בעוד|בעצם|[בל](?:אחת עשרה|שתים עשרה|אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)(?![א-ת])/i.test(t)
  const hasScheduleWord = /תור|פגישה|רופא|בדיקה|קבוע|אחרי הפגישה|אחרי התור/i.test(t)
  const isQuestion = /^(מי|מה|מתי|איפה|איך|למה|כמה|האם)\s/i.test(t) || t.endsWith('?')
  // Off-topic: 3+ words, no scheduling context, not a question
  // OR: emotional/personal statement (starts with "אני") with no date/time
  const isPersonalStatement = /^אני\s/.test(t) && !hasDateOrTime
  // Guard: an affirmative/scheduling word anywhere ("כן", "תקבעי", "בסדר", "מאושר",
  // "נכון", "קדימה") means this is a (possibly noisy) confirmation, NEVER a silent
  // cancel. Prevents the trust-damaging "כן נכון תקבעי את זה" → cancel the autonomous
  // gauntlet found. Only an EXPLICIT cancel (checked earlier) may cancel.
  const hasAffirmative = /(?<![א-ת])(?:כן|תקבעי|קבעי|תרשמי|רשמי|בסדר|מאושר|מאשרת|נכון|קדימה|בטח|ברור|יאללה|סבבה|בהחלט|לגמרי)(?![א-ת])/u.test(t)
  if (!hasDateOrTime && !hasScheduleWord && !isQuestion && !hasAffirmative && (t.split(/\s+/).length >= 3 || isPersonalStatement)) {
    return { action: 'park_keep', query: t, parked: state }
  }

  // Otherwise try to fill missing fields from this message.
  const next = updateCreate(state, t)

  // Confirming phase that did not advance AND draft unchanged = unclear
  // answer. Do NOT blindly repeat the same confirmation.
  // But if the draft DID change (date/time correction), treat as update.
  if (state.phase === 'confirming' && next.phase === 'confirming') {
    const draftChanged = next.draft.date !== state.draft.date
      || next.draft.time !== state.draft.time
      || next.draft.title !== state.draft.title
      || next.draft.location !== state.draft.location
      || next.draft.subject !== state.draft.subject
      || next.draft.person !== state.draft.person
      || next.draft.notes !== state.draft.notes
    if (!draftChanged) return { action: 'clarify' }
  }

  return { action: 'update', state: next }
}

// A short message that is purely a place — a venue/"אצל <person>"/"בבית" — with
// no competing scheduling content, so during a pending create it is a location
// answer to merge, not an unrelated topic to cancel.
function looksLikeLocationOnly(text: string): boolean {
  const t = text.trim()
  if (!t || t.split(/\s+/).length > 5) return false
  if (/^אצל\s+\S/u.test(t)) return true
  if (/^בבית(?![א-ת])/u.test(t)) return true
  // Spanish: "en el café Morocco", "en casa", "en la clínica".
  if (/^en\s+(?:el|la|los|las|casa|mi|tu)\b/i.test(t)) return true
  const ev = extractEventDetails(t)
  // Has a recognised location and carries no date/time/new-person scheduling cue.
  return !!ev.location && !/\d|מחר|מחרתיים|היום|שבוע|בשעה|בבוקר|בערב|בלילה|בצהריים/u.test(t)
}
