/*
 * AbuCalendar P0.1 — voice-transcript → action decision.
 *
 * The previous voice flow required the user to find a "Save" button in
 * VoiceCard even for a complete, unambiguous "תקבעי פגישה עם לאו מחר
 * בעשר בבוקר". This module turns a final transcript into one of six
 * explicit actions; the UI is responsible for rendering each one
 * visibly. No silent dismissal, no hidden confirm.
 *
 * Truth Contract preserved:
 *  • auto_created → createAppointmentSafe was called AND succeeded.
 *  • failed_to_save → createAppointmentSafe rejected (storage failure).
 *  • Other paths → no event is written.
 */

import { parseLocally, type LocalDraft } from './localParser'
import { extractCalendarIntentLocally, type CalendarIntentDraft } from './semanticIntent'
import { createAppointmentSafe, type Appointment } from './service'
import { extractPersonPhrase, isRelationshipDescriptor } from './familyResolve'

// ─── Create-verb detector ─────────────────────────────────────────────────
//
// We only auto-create when the speaker used an explicit imperative
// CREATE verb. A passive utterance like "פגישה עם לאו מחר בעשר" still
// goes through the visible confirmation card so we never create from
// a chance overheard statement.

// Hebrew imperatives + infinitives that mean "add/schedule/remind/put".
const HE_CREATE_VERBS = [
  'תוסיפי', 'תוסיף', 'תוסיפו',
  'תקבעי', 'תקבע',
  'תרשמי', 'תרשום',
  'תזכירי', 'תזכיר',
  'תכניסי', 'תכניס',
  'תעדכני',
  'להוסיף', 'לקבוע', 'לרשום', 'לזכור',
  'שימי', 'שים', 'לשים',
]

// Spanish (Rioplatense + general) — voseo and tuteo forms.
const ES_CREATE_VERBS = [
  'agregá', 'agrega', 'agregame', 'agregar',
  'agendá', 'agenda', 'agendar',
  'poneme', 'pone', 'poner',
  'anotá', 'anota', 'anotame',
  'añade', 'añadir',
  'record[aá]me',  // "recordame" / "recórdame"
  'programá', 'programa',
]

// English — imperatives.
const EN_CREATE_VERBS = [
  'add', 'schedule', 'create', 'put', 'set',
  'remind me to',
  'book',
]

function buildVerbRegex(list: string[], flags = 'i'): RegExp {
  return new RegExp(`(?:^|[\\s,.;])(?:${list.join('|')})(?=[\\s,.;]|$)`, flags)
}

const HE_CREATE_RE = new RegExp(`(?:^|\\s)(?:${HE_CREATE_VERBS.join('|')})(?=\\s|$|[.,!?])`, '')
const ES_CREATE_RE = buildVerbRegex(ES_CREATE_VERBS, 'i')
const EN_CREATE_RE = buildVerbRegex(EN_CREATE_VERBS, 'i')

export function containsCreateVerb(text: string): boolean {
  if (!text) return false
  return HE_CREATE_RE.test(text) || ES_CREATE_RE.test(text) || EN_CREATE_RE.test(text)
}

// ─── Transcript → action ─────────────────────────────────────────────────

export type ProcessAction =
  | { action: 'not_calendar'; message: string; semantic: CalendarIntentDraft }
  | { action: 'low_confidence'; message: string; semantic: CalendarIntentDraft }

  | { action: 'auto_created'; appointment: Appointment }
  | { action: 'show_confirm_card'; draft: LocalDraft }
  | { action: 'needs_am_pm'; draft: LocalDraft }
  | { action: 'needs_clarification'; missing: Array<'title' | 'date' | 'time'>; question: string; draft: LocalDraft }
  | { action: 'failed_to_save'; draft: LocalDraft; reason: string }
  | { action: 'failed_to_understand'; transcript: string; semantic?: CalendarIntentDraft }

function clarifyQuestion(missing: Array<'title' | 'date' | 'time'>, text: string): string {
  const t = (text || '').trim()
  const isHebrew = /[֐-׿]/.test(t)
  const isSpanish = /[áéíóúñ¿¡]|\b(agregá|agenda|mañana|hoy|m[eé]dico)\b/i.test(t)
  if (missing.includes('time')) {
    if (isSpanish) return '¿A qué hora querés que la agende?'
    if (isHebrew || (!isSpanish && /[א-ת]/.test(t))) return 'באיזו שעה לקבוע את הפגישה?'
    if (!isHebrew && !isSpanish) return 'What time should I set?'
    return 'באיזו שעה לקבוע את הפגישה?'
  }
  if (missing.includes('date')) {
    if (isSpanish) return '¿Para qué día?'
    if (isHebrew) return 'מתי לקבוע את הפגישה?'
    return 'What day?'
  }
  if (missing.includes('title')) {
    if (isSpanish) return '¿Qué nombre le ponemos a la cita?'
    if (isHebrew) return 'מה השם של הפגישה?'
    return 'What should I call this meeting?'
  }
  return ''
}

function isPlausibleTranscript(text: string): boolean {
  const t = text.trim()
  if (t.length < 3) return false
  // Reject tokens that look like a stutter / um / hum with no content.
  if (/^(emm+|um+|hum+|ehh+|ah+)\b/i.test(t)) return false
  return true
}

export function processVoiceTranscript(transcript: string, todayISO: string, opts?: { rawTranscript?: string | null; asr?: { avgLogprob?: number | null; noSpeechProb?: number | null; compressionRatio?: number | null } }): ProcessAction {
  if (!isPlausibleTranscript(transcript)) {
    return { action: 'failed_to_understand', transcript }
  }

  const semantic = extractCalendarIntentLocally({ ...(opts?.rawTranscript !== undefined ? { rawTranscript: opts.rawTranscript } : {}), correctedTranscript: transcript, todayISO, ...(opts?.asr ? { asr: opts.asr } : {}) })
  const draft = parseLocally(transcript, todayISO)
  // Capture the WHOLE person phrase ("הבת של מור"), which the word-level title
  // extractor truncates. Used for family resolution + a clean title.
  const personPhrase = extractPersonPhrase(transcript)
  let title = semantic.extractedTitle ?? draft.title
  if (personPhrase && /פגישה\s+עם/.test(title)) title = `פגישה עם ${personPhrase}`
  const effectiveDraft: LocalDraft = {
    ...draft,
    title,
    date: semantic.extractedDate ?? draft.date,
    time: semantic.extractedStartTime ?? draft.time,
    location: semantic.extractedLocation ?? draft.location ?? null,
    notes: semantic.extractedNotes ?? draft.notes ?? null,
    personPhrase,
  }
  if (semantic.validationResult === 'not_calendar') return { action: 'not_calendar', message: 'לא זיהיתי משהו לקבוע ביומן.', semantic }
  if (semantic.validationResult === 'low_confidence') return { action: 'low_confidence', message: 'לא שמעתי מספיק ברור. תוכלי להגיד שוב?', semantic }

  // 1) Ambiguous time → ALWAYS show resolver, never auto-create.
  if (effectiveDraft.time && effectiveDraft.ambiguousTime) {
    return { action: 'needs_am_pm', draft: effectiveDraft }
  }

  // 2) Missing required fields → explicit clarification.
  const missing: Array<'title' | 'date' | 'time'> = []
  if (!effectiveDraft.title || effectiveDraft.title.trim().length < 2) missing.push('title')
  if (!effectiveDraft.date) missing.push('date')
  if (!effectiveDraft.time) missing.push('time')
  if (missing.length > 0) {
    return { action: 'needs_clarification', missing, question: semantic.clarificationQuestion ?? clarifyQuestion(missing, transcript), draft: effectiveDraft }
  }

  // 2b) A family relationship phrase ("הבת של מור") must always be reviewed in
  // the confirmation card (resolved / clarified / preserved) — never silently
  // auto-created, even with a create-verb.
  if (isRelationshipDescriptor(personPhrase)) {
    return { action: 'show_confirm_card', draft: effectiveDraft }
  }

  // 3) Complete + create-verb → auto-create through the safe path.
  if (semantic.canAutoCreate) {
    const result = createAppointmentSafe({
      title: effectiveDraft.title,
      date: effectiveDraft.date!,
      time: effectiveDraft.time!,
      emoji: effectiveDraft.emoji,
      ...(effectiveDraft.location ? { location: effectiveDraft.location } : {}),
      ...(effectiveDraft.notes ? { notes: effectiveDraft.notes } : {}),
    })
    if (result.ok) return { action: 'auto_created', appointment: result.appointment }
    return { action: 'failed_to_save', draft: effectiveDraft, reason: result.code }
  }

  // 4) Complete but no explicit create-verb → visible confirmation card.
  return { action: 'show_confirm_card', draft: effectiveDraft }
}
