/*
 * Conversation Engine v2 — a FORMAL dialogue state machine that replaces the fragile
 * regex-cascade pending/confirmation control. PURE (no I/O, no runtime import): it maps
 * (current phase, user input) → a signal → an explicit state transition + action. The
 * runtime (cognitiveRuntime.runConversationV2Turn) executes the action using the
 * existing calendar/search reasoners — this engine owns ONLY dialogue control.
 *
 * Hard rules (enforced here, not by ordering):
 *  1/2. Pending + "כן" → execute once; "כן" is NEVER re-classified as a fresh intent.
 *  3. Audio complaints never cancel.   4. Frustration never cancels.
 *  5. Side questions never erase the pending action.   6. Only explicit cancel cancels.
 *  7. No "יומן/פגישה/משפחה" fallback unless there is no intent AND no state.
 *  8. No "באיזה יום?" for a calendar search.   9. No "תגידי מילה אחת".
 *  10. No repeated greeting per turn.
 */
import { isConfirm, isCancel, isCreateIntent } from './calendarCreate'

// Any Hebrew letter — used to scope the cross-language new-create rule to NON-Hebrew
// (Rioplatense) input, so Hebrew incremental collecting is left exactly as-is.
const HE_CHAR = /[֐-׿]/

export type V2Mode =
  | 'IDLE' | 'ASKING' | 'PENDING_ACTION' | 'PENDING_CONFIRMATION'
  | 'SIDE_QUESTION' | 'CORRECTION' | 'EXECUTING' | 'DONE'
  | 'FAILED_RECOVERABLE' | 'FAILED_BLOCKED'

export type V2Signal =
  | 'confirm' | 'explicit_cancel' | 'audio' | 'frustration' | 'why'
  | 'search' | 'read' | 'new_create' | 'field_answer' | 'side_question' | 'fresh'

export type V2Action =
  | 'execute_save' | 'cancel' | 'audio_help' | 'frustration_keep' | 'why_explain'
  | 'search' | 'read_keep' | 'side_keep' | 'replace' | 'update' | 'reconfirm' | 'defer'

export interface V2Transition { mode: V2Mode; action: V2Action; keepsPending: boolean }

// ── signal detectors (Hebrew-aware; no ASCII \b against Hebrew) ──
const AUDIO_RE = /(?:^|\s)(?:לא\s+שומעת?|לא\s+שמעתי|לא\s+שומע|התמלול|לא\s+מדבר\S*|לא\s+עונ\S*\s+לי\s+קול)/u
const RESUME_RE = /תמשיכי|תמשיך|המשיכי|תשלימי|לא\s+שמעתי\s+תמשיכי/u
const FRUSTRATION_RE = /את\s+לא\s+מבינה|לא\s+הבנת\s+אותי|את\s+לא\s+עונה|למה\s+את\s+לא\s+מבינה|נמאס\s+לי/u
const WHY_NOT_RE = /^\s*למה\s+(?:עוד\s+)?לא\s+(?:קבעת|קבע|שמרת|רשמת|עשית)/u
const SEARCH_RE = /(?:^\s*מתי\s+.*(?:יש\s+לי|ה?פגיש|ה?תור|ה?ביקור))|(?:(?:^|\s)יש\s+לי\s+(?:משהו|ה?פגיש\S*|ה?תור)\s+(?:עם|אצל|ב))|(?:באיזה\s+יום\s+[^?]*?(?:פגיש|תור)[^?]*?(?:עם|של))/u
const READ_RE = /(?:מה\s+יש\s+לי(?![א-ת]))|(?:^\s*יומן\s*$)|(?:מה\s+ה?תוכניות\s+שלי)/u
// Explicit DRAFT cancel ("בטלי את זה"). Deliberately excludes "תמחקי את הפגישה עם X",
// which deletes a NAMED stored event (a side action) and must never cancel the draft.
const CANCEL_PHRASE_RE = /^(?:בטלי|תבטלי|בטל|תבטל|עזבי|תעזבי)\s+(?:את\s+)?(?:זה|הפגישה|הכל|התור)(?![א-ת])/u
// Natural EXIT of the active object (EXIT DETECTION): a bare "עזוב" / "לא משנה" /
// "תצא מזה" / "נעבור לנושא אחר" while a draft is pending must TERMINATE the draft,
// not leak as a side-question that leaves it half-open (pending pollution). This
// is exit-of-the-object, distinct from the "תמחקי את הפגישה עם X" stored-event delete.
const SOFT_EXIT_RE = /^(?:עזוב(?:י|ו)?|תעזב[יו]?(?:\s+את\s+זה)?|תעזוב(?:\s+את\s+זה)?|עזבי(?:\s+את\s+זה)?|לא\s+משנה|תצא\s+מזה|תצאי\s+מזה|צא[יי]?\s+מזה|נעבור\s+לנושא\s+אחר|נושא\s+אחר|משהו\s+אחר|שכח[יי]?\s+מזה|די(?:\s+עם\s+זה)?|מספיק|עצרי|תעצרי)[\s.,!?]*$/u
// An EXPLICIT topic switch ("בעצם בואי נדבר על משהו אחר", "בא לי לדבר על משהו אחר")
// abandons the pending draft — otherwise it lingers and a later unrelated "כן"
// silently saves it (a data-integrity bug). Un-anchored: it can appear in a phrase.
const CONTEXT_SWITCH_RE = /(?:בעצם\s+)?(?:בואי\s+)?(?:בא\s+לי\s+)?(?:נדבר|לדבר|נעבור|לעבור)\s+על\s+(?:משהו|נושא)\s+אחר|עזבי,?\s+בא\s+לי\s+לדבר/u
const FIELD_RE = /^(?:ב|ל)?(?:שעה\s+\S+|שמונה|תשע|עשר|אחת|שתיים|שלוש|ארבע|חמש|שש|שבע)(?:\s+(?:בבוקר|בערב|בצהריים|וחצי|ורבע))?$|^ביום\s+\S+$|^(?:מחר|מחרתיים|היום|הערב)$|^ב\d{1,2}(?::\d{2})?$/u
const QUESTION_RE = /^(?:מי|מה|מתי|איפה|איך|למה|כמה|האם)(?:\s|$)|\?\s*$/u
// An emotional aside mid-create ("אני מתגעגעת", "קצת עצובה") must be answered warmly
// with the draft KEPT — never mistaken for a slot answer to fold into the draft.
const EMOTIONAL_RE = /מתגעגע|געגוע|עצוב|בוד[דה]|לבד|קשה\s+לי|אין\s+לי\s+כוח|מדוכא|בוכ|מפחד|דואג/u
const GREETING_RE = /^(?:בוקר טוב|ערב טוב|צהריים טובים|לילה טוב|מה שלומך|מה נשמע|היי|שלום|הא?לו)(?![א-ת])/u
const NEW_MEETING_RE = /(?:מחר|מחרתיים|היום|הערב|ביום\s+\S+)/u
const NEW_TIME_RE = /(?:בשעה|ב\d|בבוקר|בערב|בצהריים|וחצי|ב(?:שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|אחת|שתיים))/u
const NEW_PLACE_RE = /(?:אצל|אלי[הו]|הביתה|עם\s+[א-ת]{2,}|ביקש[הת]?|אמר[הת]?\s+ש)/u
// Imperative draft edits ("תשנה לעשר", "תעדכני", "תוסיפי", "תכתבי …") and
// "לא, <value>" corrections ("לא, מחר", "לא, בשבוע הבא", "לא, בעשר"). During a
// pending draft these MUST update it via updateCreate — never fall through to the
// general LLM as a side-question, or a later "כן" saves the STALE value (a
// data-integrity bug). Genuine side-questions are QUESTIONS and never match this.
const EDIT_VERB_RE = /^(?:ל?תשנ[יה]|שנ[יה]|ל?תעדכנ[יי]?|עדכנ[יי]?|ל?תוסיפ[יי]?|הוסיפ[יי]?|ל?תכת[בו][יי]?|ל?תרשמ[יי]?)(?![א-ת])/u
const CORRECTION_VALUE_RE = /^לא[,\s]+(?=.*(?:מחר|מחרתיים|היום|הערב|ביום|שבוע|בשעה|ב\d|בבוקר|בערב|בצהריים|וחצי|ורבע|בשלוש|בארבע|בחמש|בשש|בשבע|בשמונה|בתשע|בעשר|באחת|בשתיים))/u
// A PERSON correction ("לא, לא עם דני, עם מור" / "לא אצל X, אצל Y") — a negation + a NEW
// companion. Must be a draft edit (→ updateCreate swaps the person), never a side-question.
const PERSON_CORRECTION_RE = /^לא[,\s].*(?:עם|אצל)\s+[א-ת]{2,}/u
function isDraftEdit(t: string): boolean { return EDIT_VERB_RE.test(t) || CORRECTION_VALUE_RE.test(t) || PERSON_CORRECTION_RE.test(t) }

/** phase from the calendar create state. */
export type Phase = 'idle' | 'collecting' | 'confirming' | string
export function modeOfPhase(phase: Phase): V2Mode {
  if (phase === 'confirming') return 'PENDING_CONFIRMATION'
  if (phase === 'idle') return 'IDLE'
  return 'PENDING_ACTION'
}

/** Classify the user's turn into ONE formal signal, given the current pending phase. */
export function classifySignalV2(rawInput: string, phase: Phase): V2Signal {
  const t = rawInput.trim()
  if (phase !== 'idle') {
    // "לא שמעתי תמשיכי" is a resume, not an audio complaint — defer to the resume path.
    if (AUDIO_RE.test(t) && !RESUME_RE.test(t)) return 'audio'
    if (phase === 'confirming' && isConfirm(t)) return 'confirm'   // rule 1/2
    if (isCancel(t) || CANCEL_PHRASE_RE.test(t) || SOFT_EXIT_RE.test(t) || CONTEXT_SWITCH_RE.test(t)) return 'explicit_cancel' // rule 6 + EXIT DETECTION + explicit context switch
    if (WHY_NOT_RE.test(t)) return 'why'
    // Resume of an interrupted draft ("תמשיכי") → re-surface the pending confirm
    // (the 'why' action explains the pending draft + how to save), never a dead-end.
    if (RESUME_RE.test(t)) return 'why'
    if (FRUSTRATION_RE.test(t)) return 'frustration'
    if (SEARCH_RE.test(t)) return 'search'                          // rule 5/8
    if (READ_RE.test(t)) return 'read'                             // rule 5
    if (NEW_MEETING_RE.test(t) && NEW_TIME_RE.test(t) && NEW_PLACE_RE.test(t) && t.split(/\s+/).length >= 5) return 'new_create'
    // Cross-language supersession: a genuine NEW create in a NON-Hebrew (Rioplatense)
    // utterance — "agendá una reunión con Gabi mañana a las tres" — also replaces the
    // pending draft. The Hebrew full-create is already caught above; this closes the
    // Spanish gap where such a turn was misread as a side-question, so a later
    // "dale, agendalo" saved the STALE Hebrew draft instead of the read-back person.
    // Guarded by !isDraftEdit so a "no, con Mor" style correction still updates.
    if (!HE_CHAR.test(t) && !isDraftEdit(t) && isCreateIntent(t)) return 'new_create'
    if (FIELD_RE.test(t)) return 'field_answer'
    if (isDraftEdit(t)) return 'field_answer'                       // edit/correction → updateCreate, never LLM
    // Incremental create: while COLLECTING (not yet confirming), a non-question,
    // non-emotional turn is a SLOT ANSWER ("מחר", "עם מור", "מחר בשלוש עם מור") —
    // fold it into the draft via updateCreate instead of punting to the LLM. Genuine
    // side-questions are QUESTIONS; emotional asides are excluded and kept as side_keep.
    if (phase !== 'confirming' && !QUESTION_RE.test(t) && !EMOTIONAL_RE.test(t)) return 'field_answer'
    return 'side_question'                                          // rule 5 (answer + keep)
  }
  // IDLE — v2 owns ONLY the search-vs-create precedence fix (C/D); everything else
  // defers to the existing intent engine (rule 7: no forced fallback).
  if (SEARCH_RE.test(t)) return 'search'
  return 'fresh'
}

/** The state machine: (phase, signal) → transition. Pure + total. */
export function reduceV2(phase: Phase, signal: V2Signal): V2Transition {
  const mode = modeOfPhase(phase)
  const pending = mode === 'PENDING_ACTION' || mode === 'PENDING_CONFIRMATION'
  switch (signal) {
    case 'confirm':
      return { mode: 'EXECUTING', action: 'execute_save', keepsPending: false }        // rule 1/2
    case 'explicit_cancel':
      return { mode: 'DONE', action: 'cancel', keepsPending: false }                    // rule 6
    case 'audio':
      return { mode, action: 'audio_help', keepsPending: pending }                      // rule 3
    case 'frustration':
      return { mode, action: 'frustration_keep', keepsPending: pending }                // rule 4
    case 'why':
      return { mode, action: 'why_explain', keepsPending: pending }                     // F: explain state
    case 'search':
      return { mode: pending ? 'SIDE_QUESTION' : 'IDLE', action: 'search', keepsPending: pending } // rule 5/8
    case 'read':
      return { mode: 'SIDE_QUESTION', action: 'read_keep', keepsPending: pending }      // rule 5
    case 'new_create':
      return { mode: 'PENDING_ACTION', action: 'replace', keepsPending: false }
    case 'field_answer':
      return { mode, action: 'update', keepsPending: true }
    case 'side_question':
      return { mode: 'SIDE_QUESTION', action: 'side_keep', keepsPending: pending }      // rule 5
    case 'fresh':
    default:
      return { mode: 'IDLE', action: 'defer', keepsPending: false }                     // rule 7: hand to intent engine
  }
}

// ── flag (default from build env; settable for tests) ──
let _enabled = ((import.meta.env.VITE_ABUAI_CONVERSATION_ENGINE_V2 as string | undefined) ?? 'true') !== 'false'
export function conversationV2Enabled(): boolean { return _enabled }
export function setConversationV2Enabled(on: boolean): void { _enabled = on }
