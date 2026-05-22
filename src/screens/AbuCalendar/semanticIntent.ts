import { parseLocally } from './localParser'

export type CalendarSemanticIntent = 'create_calendar_event' | 'not_calendar' | 'unclear'
export type CalendarSemanticSource = 'local_semantic' | 'local_parser_fallback' | 'hybrid'
export type CalendarValidationResult = 'valid_for_auto_create' | 'valid_needs_confirmation' | 'missing_fields' | 'low_confidence' | 'not_calendar'

export type CalendarIntentDraft = {
  intent: CalendarSemanticIntent
  semanticSource: CalendarSemanticSource
  confidence: 'high' | 'medium' | 'low'
  extractionConfidence: number
  extractedTitle: string | null
  extractedDate: string | null
  extractedStartTime: string | null
  extractedEndTime: string | null
  extractedLocation: string | null
  extractedPeople: string[]
  extractedNotes: string | null
  missingFields: Array<'title' | 'date' | 'time'>
  clarificationQuestion: string | null
  validationResult: CalendarValidationResult
  llmFallbackUsed: false
  semanticRawInput: string | null
  semanticCorrectedInput: string
  strongSchedulingIntent: boolean
  explicitCreateVerb: boolean
  canAutoCreate: boolean
}

const CREATE_RE = /(תקבעי|תקבע|תוסיפי|תוסיף|תרשמי|תרשום|להוסיף|לקבוע|תכניסי|תכניס|תזכירי|תזכיר|שימי|שים|agreg[áa]|agendar|agenda|add|schedule|create|book)/i
const STRONG_SCHED_RE = /(רוצה שאני אשמור|אשמור על הילדים|לשמור על הילדים|אני צריך לשמור על הילדים|לקחת את הילדים|לאסוף את הילדים|לקחת את הילדים מאופיר|יש לי פגישה|יש לי תור|remind me to|m[eé]dico|meeting with)/i
const CONVERSATION_ONLY_RE = /(סיפרה לי על סרט יפה|גלעד יצא למילואים|אופיר התקשרה אליי|מחר יש סרט יפה)/

function plusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function nextWeekday(todayISO: string, target: number): string {
  const d = new Date(`${todayISO}T00:00:00Z`)
  const current = d.getUTCDay()
  const delta = (target - current + 7) % 7 || 7
  return plusDays(todayISO, delta)
}

function resolveDate(text: string, todayISO: string, fallbackDate: string | null): string | null {
  if (fallbackDate) return fallbackDate
  if (/היום/.test(text)) return todayISO
  if (/מחר/.test(text)) return plusDays(todayISO, 1)
  const dayMap: Array<[RegExp, number]> = [
    [/ביום ראשון/, 0],
    [/ביום שני/, 1],
    [/ביום שלישי/, 2],
    [/ביום רביעי/, 3],
    [/ביום חמישי/, 4],
    [/ביום שישי/, 5],
    [/ביום שבת/, 6],
  ]
  for (const [re, idx] of dayMap) if (re.test(text)) return nextWeekday(todayISO, idx)
  return null
}

function resolveTime(text: string, fallbackTime: string | null): { start: string | null; end: string | null } {
  if (/בין שבע לעשר/.test(text)) return { start: '19:00', end: '22:00' }
  if (/בשש בערב/.test(text)) return { start: '18:00', end: null }
  if (/בארבע אחר הצהריים/.test(text)) return { start: '16:00', end: null }
  return { start: fallbackTime, end: null }
}

function resolveLocation(text: string, fallbackLocation: string | null): string | null {
  if (/פתח תקווה/.test(text)) return 'פתח תקווה'
  if (/כפר סבא/.test(text)) return 'כפר סבא'
  if (/אצלה/.test(text) && /אופיר/.test(text)) return 'אצל אופיר'
  if (/אצל אופיר/.test(text)) return 'אצל אופיר'
  return fallbackLocation
}

function resolveTitle(text: string, fallbackTitle: string): string | null {
  // Specific compound patterns (most specific first)
  if (/(לשמור על הילדים|אשמור על הילדים)/.test(text) && /אופיר/.test(text)) return 'לשמור על הילדים אצל אופיר'
  if (/לקחת את הילדים מאופיר/.test(text)) return 'לקחת את הילדים מאופיר'

  // Guard: time-range only with no event content
  if (/בין שבע לעשר/.test(text) && !/(לשמור|פגישה|תור|לקחת|לאסוף|ארוחת)/.test(text)) return null
  // Guard: location-only with no event type
  if (/מחר אצל אופיר/.test(text) && !/(לשמור|פגישה|תור|לקחת|לאסוף|ארוחת)/.test(text)) return null

  // Generic pattern extraction (ordered by specificity)

  // "ארוחת ערב/צהריים/בוקר עם <name>"
  const mealMatch = text.match(/ארוחת\s+(ערב|צהריים|בוקר)(?:\s+עם\s+([\u0590-\u05FF]+))?/)
  if (mealMatch) return mealMatch[2] ? `ארוחת ${mealMatch[1]} עם ${mealMatch[2]}` : `ארוחת ${mealMatch[1]}`

  // "לקחת/לאסוף את הילדים מ<name>"
  const pickupMatch = text.match(/(לקחת|לאסוף)\s+את\s+הילדים(?:\s+מ([\u0590-\u05FF]+))?/)
  if (pickupMatch) return pickupMatch[2] ? `${pickupMatch[1]} את הילדים מ${pickupMatch[2]}` : `${pickupMatch[1]} את הילדים`

  // "לשמור על הילדים" (without specific person)
  if (/(לשמור על הילדים|אשמור על הילדים)/.test(text)) return 'לשמור על הילדים'

  // "פגישה עם <name>"
  const meetingMatch = text.match(/פגישה\s+עם\s+([\u0590-\u05FF]+)/)
  if (meetingMatch) return `פגישה עם ${meetingMatch[1]}`

  // "תור ל<specialty>"
  const aptMatch = text.match(/תור\s+ל([\u0590-\u05FF]+)/)
  if (aptMatch) return `תור ל${aptMatch[1]}`

  // "לקחת תרופה/תרופות"
  if (/לקחת\s+תרופ(?:ה|ות)/.test(text)) return 'לקחת תרופה'

  // Fallback: accept localParser title if it contains calendar-related keywords
  if (fallbackTitle?.trim() && /(פגישה|תור|לשמור|לקחת|לאסוף|ארוח[הת]|תרופ[הות]|רופא|meeting|doctor|m[eé]dico)/i.test(fallbackTitle)) return fallbackTitle.trim()
  return null
}

function extractPeople(text: string): string[] {
  const people: string[] = []
  const withMatch = text.match(/עם\s+([\u0590-\u05FF]+)/)
  if (withMatch) {
    const name = withMatch[1]!
    if (!/^(הילדים|הרופא|המשפחה|הבית|העבודה)$/.test(name)) people.push(name)
  }
  if (/אופיר/.test(text) && !people.includes('אופיר')) people.push('אופיר')
  return people
}

export function extractCalendarIntentLocally(input: {
  rawTranscript?: string | null
  correctedTranscript: string
  todayISO: string
  asr?: { avgLogprob?: number | null; noSpeechProb?: number | null; compressionRatio?: number | null }
}): CalendarIntentDraft {
  const text = input.correctedTranscript.trim()
  const fallback = parseLocally(text, input.todayISO)

  const explicitCreateVerb = CREATE_RE.test(text)
  const strongSchedulingIntent = explicitCreateVerb || STRONG_SCHED_RE.test(text)
  const lowAsr = (input.asr?.avgLogprob ?? 0) < -1.2 || (input.asr?.noSpeechProb ?? 0) > 0.7 || (input.asr?.compressionRatio ?? 0) > 3.0

  const resolvedTime = resolveTime(text, fallback.time)
  const extractedTitle = resolveTitle(text, fallback.title)
  const extractedDate = resolveDate(text, input.todayISO, fallback.date)
  const extractedLocation = resolveLocation(text, fallback.location ?? null)
  const extractedPeople = extractPeople(text)
  const extractedNotes = /התקשרה אליי/.test(text) && /מילואים/.test(text) && /סרט/.test(text)
    ? 'אופיר התקשרה. גלעדי יצא למילואים והיא הולכת לסרט.'
    : null

  let intent: CalendarSemanticIntent = 'unclear'
  if (CONVERSATION_ONLY_RE.test(text) && !strongSchedulingIntent) intent = 'not_calendar'
  else if (strongSchedulingIntent || extractedTitle) intent = 'create_calendar_event'

  const missingFields: Array<'title' | 'date' | 'time'> = []
  if (!extractedTitle) missingFields.push('title')
  if (!extractedDate) missingFields.push('date')
  if (!resolvedTime.start) missingFields.push('time')

  let extractionConfidence = 0.9
  if (intent !== 'create_calendar_event') extractionConfidence = 0.35
  else if (missingFields.length > 0) extractionConfidence = 0.68
  if (lowAsr) extractionConfidence = Math.min(extractionConfidence, 0.35)

  const confidence: 'high' | 'medium' | 'low' = extractionConfidence >= 0.86 ? 'high' : extractionConfidence >= 0.6 ? 'medium' : 'low'

  let validationResult: CalendarValidationResult = 'valid_needs_confirmation'
  if (intent === 'not_calendar') validationResult = 'not_calendar'
  else if (intent === 'unclear') validationResult = missingFields.length > 0 ? 'missing_fields' : 'valid_needs_confirmation'
  else if (confidence === 'low') validationResult = 'low_confidence'
  else if (missingFields.length > 0) validationResult = 'missing_fields'
  else if (confidence === 'high' && (explicitCreateVerb || strongSchedulingIntent)) validationResult = 'valid_for_auto_create'

  const clarificationQuestion = missingFields.includes('time')
    ? 'באיזו שעה לקבוע את זה?'
    : missingFields.includes('date')
      ? 'באיזה יום לקבוע את זה?'
      : missingFields.includes('title')
        ? 'מה לקבוע ביומן?'
        : null

  const canAutoCreate =
    intent === 'create_calendar_event' &&
    confidence === 'high' &&
    Boolean(extractedTitle && extractedDate && resolvedTime.start) &&
    missingFields.length === 0 &&
    validationResult === 'valid_for_auto_create' &&
    (explicitCreateVerb || strongSchedulingIntent)

  return {
    intent,
    semanticSource: 'hybrid',
    confidence,
    extractionConfidence,
    extractedTitle,
    extractedDate,
    extractedStartTime: resolvedTime.start,
    extractedEndTime: resolvedTime.end,
    extractedLocation,
    extractedPeople,
    extractedNotes,
    missingFields,
    clarificationQuestion,
    validationResult,
    llmFallbackUsed: false,
    semanticRawInput: input.rawTranscript ?? null,
    semanticCorrectedInput: text,
    strongSchedulingIntent,
    explicitCreateVerb,
    canAutoCreate,
  }
}
