import { cleanTranscript, parseLocally } from '../localParser'
import { extractPersonPhrase, resolvePersonPhrase } from '../familyResolve'
import type { ReminderDraft, ReminderCategory, Reminder } from './types'

// ─── Intent detection ────────────────────────────────────────────────────────

// Flexible reminder trigger: allows filler words between "צריכה/צריך" and "לזכור".
const REMINDER_TRIGGERS = /תזכירי\s+לי|תזכרי\s+לי|תזכיר\s+לי|תזכורת|להזכיר\s+לי|אני\s+צריכ[הי](?:\s+\S+){0,3}\s+לזכור/
const APPOINTMENT_CONTENT = /פגישה\s+עם|תור\s+ל|לקבוע\s+פגישה|להיפגש\s+עם|להפגש\s+עם/
// Verbs that always mean "schedule an appointment".
// Hebrew word-boundary guards prevent substring matches (e.g. "שים" inside "שלושים").
const STRONG_APPOINTMENT_VERBS = /(?<![֐-׿])(?:תקבעי|תקבע|קבעי|קבע|אגנד[אה]|תרשמי|תרשום|שימי|שים|תכניסי|תכניס)(?![֐-׿])/
// Verbs that mean appointment only when paired with an appointment noun.
const WEAK_APPOINTMENT_VERBS = /תוסיפי|תוסיף/
// Appointment nouns, allowing a single Hebrew prepositional prefix (ל/ב/ה/א).
// Hebrew has no \b, so guard with non-Hebrew-letter lookarounds.
const APPOINTMENT_NOUN_RE = /(?<![֐-׿])[להאב]?(?:פגישה|תור|בדיקה|בדיקת|אירוע|תופרת|רופא|רופאה|דנטיסט|דיקור|קרדיולוג|יועץ|ספא|ביקור)(?![֐-׿])/
// Bare recurring pattern without explicit reminder trigger.
const RECURRING_RE = /(?:^|\s)כל\s+(?:ערב|בוקר|יום|לילה|שבת|שישי|חמישי|ראשון|שני|שלישי|רביעי|שבוע)/
// Relative-time opener without an explicit reminder trigger.
const RELATIVE_TIME_START_RE = /(?:^|\s)(?:בעוד|עוד)\s+(?:(?:\d+|[֐-׿]+)\s+(?:דקות?|שעות?|שעה|שעתיים)|שעה(?:\s*ו(?:חצי|רבע)|\s|$)|שעתיים|חצי\s+שעה|רבע\s+שעה)/
// At least one calendar/time context clue (needed for bare-noun rule to fire).
const APPT_CONTEXT_RE = /מחר|היום|מחרתיים|ביום\s|בשעה\s|\d{1,2}[:.]\d{2}|\d{1,2}\s+(?:בלילה|בבוקר|בצהריים|בערב|לפנות)|עם\s+[֐-׿]|ב-\d/

/**
 * Classify transcript intent for routing.
 * Priority order matters: stronger signals evaluated first.
 */
export function detectReminderIntent(text: string): 'reminder' | 'appointment' | 'unknown' {
  const t = text.trim()
  // 1. Strong appointment verbs always mean calendar event.
  if (STRONG_APPOINTMENT_VERBS.test(t)) return 'appointment'
  // 2. Weak verbs become appointment only alongside an appointment noun.
  if (WEAK_APPOINTMENT_VERBS.test(t) && APPOINTMENT_NOUN_RE.test(t)) return 'appointment'
  const hasReminderTrigger = REMINDER_TRIGGERS.test(t)
  // 3. Reminder trigger + appointment content → scheduling-via-reminder phrasing.
  if (hasReminderTrigger && APPOINTMENT_CONTENT.test(t)) return 'appointment'
  // 4. Reminder trigger alone → reminder.
  if (hasReminderTrigger) return 'reminder'
  // 5. Declarative possession: "יש לי <appointment noun>". Schedule queries
  //    ("מה יש לי …") are caught upstream by isScheduleQuery.
  if (!/^מה\s/.test(t) && /יש\s+לי/.test(t) && APPOINTMENT_NOUN_RE.test(t)) return 'appointment'
  // 6. Standalone appointment-content phrase (no trigger needed).
  if (APPOINTMENT_CONTENT.test(t)) return 'appointment'
  // 7. Medication keyword without appointment noun → standalone reminder.
  if (MEDICATION_RE.test(t) && !APPOINTMENT_NOUN_RE.test(t)) return 'reminder'
  // 8. Recurring time pattern without explicit trigger → reminder.
  if (RECURRING_RE.test(t)) return 'reminder'
  // 9. Bare appointment noun + at least one calendar context clue → appointment.
  if (!/^מה\s/.test(t) && APPOINTMENT_NOUN_RE.test(t) && APPT_CONTEXT_RE.test(t)) return 'appointment'
  // 10. Relative-time opener without trigger → reminder.
  if (RELATIVE_TIME_START_RE.test(t)) return 'reminder'
  return 'unknown'
}

// ─── Hebrew minute words ─────────────────────────────────────────────────────

const HEB_UNITS: Record<string, number> = {
  'אחת': 1, 'אחד': 1, 'שתיים': 2, 'שניים': 2, 'שתי': 2,
  'שלוש': 3, 'שלושה': 3, 'ארבע': 4, 'ארבעה': 4,
  'חמש': 5, 'חמישה': 5, 'שש': 6, 'שישה': 6,
  'שבע': 7, 'שבעה': 7, 'שמונה': 8, 'תשע': 9, 'תשעה': 9,
  'עשר': 10, 'עשרה': 10,
}
const HEB_TENS: Record<string, number> = {
  'עשרים': 20, 'שלושים': 30, 'ארבעים': 40, 'חמישים': 50,
}
const HEB_SPECIAL_MINUTES: Array<[RegExp, number]> = [
  [/שעה\s+וחצי/, 90],
  [/שעה\s+ורבע/, 75],
  [/חצי\s+שעה/, 30],
  [/רבע\s+שעה/, 15],
  [/שלושת\s+רבעי\s+שעה|שלושה\s+רבעי\s+שעה/, 45],
  [/שעתיים/, 120],
  [/שלוש\s+שעות/, 180],
  [/ארבע\s+שעות/, 240],
  [/חמש\s+שעות/, 300],
  [/שש\s+שעות/, 360],
]

function hebrewNumberToInt(word: string): number | null {
  const w = word.trim()
  if (HEB_UNITS[w] !== undefined) return HEB_UNITS[w]!
  if (HEB_TENS[w] !== undefined) return HEB_TENS[w]!
  // try "עשרים ואחד" style
  for (const [tens, tval] of Object.entries(HEB_TENS)) {
    const re = new RegExp(`^${tens}\\s+ו([\\u0590-\\u05FF]+)$`)
    const m = w.match(re)
    if (m) {
      const uval = HEB_UNITS[m[1]!]
      if (uval !== undefined) return tval + uval
    }
  }
  return null
}

// ─── Relative time parser ─────────────────────────────────────────────────────

interface RelativeTimeResult {
  dueAt: string
  displayTimeLabel: string
  displayDateLabel: string
  minutesFromNow: number
}

/**
 * Parse "בעוד X" / "עוד X" patterns. Returns null if not a relative-time
 * expression.
 */
export function parseRelativeTime(text: string, now: Date): RelativeTimeResult | null {
  const t = text.trim()

  // Hebrew special forms first (שעתיים, חצי שעה, etc.)
  for (const [re, minutes] of HEB_SPECIAL_MINUTES) {
    const full = new RegExp(`(?:בעוד|עוד)\\s+${re.source}`)
    if (full.test(t)) {
      const due = new Date(now.getTime() + minutes * 60_000)
      return buildRelResult(due, minutes)
    }
  }

  // Numeric: "בעוד 5 דקות" / "עוד 5 דקות" / "בעוד 2 שעות" / "עוד שעה"
  const numMinutes = t.match(/(?:בעוד|עוד)\s+(\d+)\s+דקות?/)
  if (numMinutes) {
    const min = parseInt(numMinutes[1]!, 10)
    if (min > 0 && min < 1440) {
      const due = new Date(now.getTime() + min * 60_000)
      return buildRelResult(due, min)
    }
  }
  const numHours = t.match(/(?:בעוד|עוד)\s+(\d+)\s+שעות?/)
  if (numHours) {
    const hr = parseInt(numHours[1]!, 10)
    if (hr > 0 && hr < 24) {
      const due = new Date(now.getTime() + hr * 60 * 60_000)
      return buildRelResult(due, hr * 60)
    }
  }

  // Hebrew word: "בעוד חמש דקות" / "עוד שעה"
  const hebMinPat = new RegExp(`(?:בעוד|עוד)\\s+([\\u0590-\\u05FF\\s]+?)\\s+דקות?`)
  const hmMin = t.match(hebMinPat)
  if (hmMin) {
    const v = hebrewNumberToInt(hmMin[1]!.trim())
    if (v !== null && v > 0 && v < 1440) {
      const due = new Date(now.getTime() + v * 60_000)
      return buildRelResult(due, v)
    }
  }

  // Compound: "בעוד שעה ו<X> דקות" → 60 + X minutes.
  // Must come before the bare "שעה" match below.
  const compoundHourMin = t.match(/(?:בעוד|עוד)\s+שעה\s+ו(\d+)\s+דקות?/)
  if (compoundHourMin) {
    const extraMin = parseInt(compoundHourMin[1]!, 10)
    if (extraMin > 0 && extraMin < 60) {
      const total = 60 + extraMin
      const due = new Date(now.getTime() + total * 60_000)
      return buildRelResult(due, total)
    }
  }
  // Hebrew word compound: "בעוד שעה ועשרים דקות" / "שעה וחמש דקות"
  const compoundHourMinHeb = t.match(/(?:בעוד|עוד)\s+שעה\s+ו([\u0590-\u05FF\s]+?)\s+דקות?/)
  if (compoundHourMinHeb) {
    const v = hebrewNumberToInt(compoundHourMinHeb[1]!.trim())
    if (v !== null && v > 0 && v < 60) {
      const total = 60 + v
      const due = new Date(now.getTime() + total * 60_000)
      return buildRelResult(due, total)
    }
  }

  // "בעוד שעה" / "עוד שעה" (single hour)
  if (/(?:בעוד|עוד)\s+שעה(?!\s+ו)/.test(t)) {
    const due = new Date(now.getTime() + 60 * 60_000)
    return buildRelResult(due, 60)
  }

  // Hebrew word hours: "בעוד שלוש שעות"
  const hebHrPat = new RegExp(`(?:בעוד|עוד)\\s+([\\u0590-\\u05FF\\s]+?)\\s+שעות?`)
  const hmHr = t.match(hebHrPat)
  if (hmHr) {
    const v = hebrewNumberToInt(hmHr[1]!.trim())
    if (v !== null && v > 0 && v < 24) {
      const due = new Date(now.getTime() + v * 60 * 60_000)
      return buildRelResult(due, v * 60)
    }
  }

  return null
}

function buildRelResult(due: Date, minutesFromNow: number): RelativeTimeResult {
  const dueAt = localISOString(due)
  const displayTimeLabel = due.toTimeString().slice(0, 5)
  const today = new Date()
  const dueDay = due.toDateString()
  const todayStr = today.toDateString()
  const tomorrowStr = new Date(today.getTime() + 86_400_000).toDateString()
  const displayDateLabel =
    dueDay === todayStr ? 'היום' :
    dueDay === tomorrowStr ? 'מחר' :
    `${due.getDate()}/${due.getMonth() + 1}`
  let label: string
  if (minutesFromNow < 60) label = `בעוד ${minutesFromNow} דקות`
  else if (minutesFromNow === 60) label = 'בעוד שעה'
  else if (minutesFromNow === 75) label = 'בעוד שעה ורבע'
  else if (minutesFromNow === 90) label = 'בעוד שעה וחצי'
  else if (minutesFromNow === 120) label = 'בעוד שעתיים'
  else if (minutesFromNow % 60 === 0) label = `בעוד ${minutesFromNow / 60} שעות`
  else label = `בעוד ${Math.round(minutesFromNow / 60)} שעות`
  return { dueAt, displayTimeLabel, displayDateLabel: `${displayDateLabel} (${label})`, minutesFromNow }
}

function localISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

// ─── Recurrence parser ────────────────────────────────────────────────────────

export function parseRecurrence(text: string): Reminder['recurrence'] | null {
  const t = text.trim()

  // "כל יום" / "כל בוקר" / "כל ערב" / "כל לילה"
  const dailyMatch = /כל\s+(יום|בוקר|ערב|לילה)/.test(t)
  if (dailyMatch) {
    // Extract the time from the local parser result
    return { frequency: 'daily', time: '' }  // time filled later
  }

  // "כל שבוע ביום X"
  if (/כל\s+שבוע/.test(t)) {
    return { frequency: 'weekly', time: '' }  // time filled later
  }

  return null
}

type ReminderRecurrence = NonNullable<ReminderDraft['recurrence']>

// ─── Command verb stripping ───────────────────────────────────────────────────

const REMINDER_COMMAND_PATTERNS = [
  /^תזכירי\s+לי\s*/i,
  /^תזכרי\s+לי\s*/i,
  /^תזכיר\s+לי\s*/i,
  /^תזכורת[:\s]*/i,
  /^להזכיר\s+לי\s*/i,
  // secondary: strip leading "לי" if left after stripping command
  /^לי\s+/,
]

function stripReminderCommand(text: string): string {
  let t = text.trim()
  for (const re of REMINDER_COMMAND_PATTERNS) {
    t = t.replace(re, '').trim()
  }
  return t
}

// ─── Category detection ───────────────────────────────────────────────────────

const MEDICATION_RE = /כדור|תרופה|תרופות|גלולה|ויטמין|אנטיביוטיקה/
const WATER_RE = /לשתות\s+מים|שתיית\s+מים/
const CALL_RE = /להתקשר|לדבר\s+עם|לצלצל|לשלוח\s+הודעה|לכתוב\s+ל/
const HOME_RE = /סיר|תנור|כביסה|מקרר|בישול|לכבות|לנקות|לבדוק\s+את\s+הסיר|לאפות|להפשיר/
const APPT_PREP_RE = /רופא|מסמכים|להתארגן|לארגן|מסמך|לבדוק\s+מסמכים|תור\s+ל/

function detectCategory(text: string): ReminderCategory {
  if (MEDICATION_RE.test(text)) return 'medication'
  if (WATER_RE.test(text)) return 'water'
  if (CALL_RE.test(text)) return 'call'
  if (HOME_RE.test(text)) return 'home'
  if (APPT_PREP_RE.test(text)) return 'appointment_prep'
  return 'general'
}

// ─── Person phrase extraction for reminders ──────────────────────────────────

/**
 * For reminders, person phrases can appear after "להתקשר/לדבר/לצלצל" + "ל".
 * Falls back to the standard extractPersonPhrase for "עם X" and "X של Y".
 */
function extractReminderPersonPhrase(text: string): string | null {
  // Standard resolver first (handles "עם X", "X של Y")
  const standard = extractPersonPhrase(text)
  if (standard) return standard

  // "להתקשר לאופיר" / "לדבר עם אופיר"
  const callTo = text.match(/(?:להתקשר|לצלצל|לדבר)\s+ל([֐-׿']+)/)
  if (callTo) {
    const name = callTo[1]!
    // Reject common non-name tokens
    if (!/^(רופא|הרופא|הבית|משרד|עבודה)$/.test(name)) return name
  }

  return null
}

// ─── Readback text builder ────────────────────────────────────────────────────

function buildReadbackText(
  title: string | undefined,
  dateLabel: string | undefined,
  timeLabel: string | undefined,
  recurrence: ReminderRecurrence | undefined,
): string {
  const action = title ? `להזכיר לך ${title}` : 'להזכיר לך'
  if (recurrence) {
    const freq = recurrence.frequency === 'daily' ? 'כל יום' : 'כל שבוע'
    const t = recurrence.time || timeLabel || ''
    return t ? `${freq} בשעה ${t} ${action}` : `${freq} ${action}`
  }
  if (dateLabel && timeLabel) return `${dateLabel} בשעה ${timeLabel} ${action}`
  if (timeLabel) return `בשעה ${timeLabel} ${action}`
  if (dateLabel) return `${dateLabel} ${action}`
  return action
}

// ─── Main parser ─────────────────────────────────────────────────────────────

/**
 * Parse a Hebrew reminder transcript into a ReminderDraft.
 * Always returns a result — never throws.
 * readbackText is always built from normalized fields, never from raw input.
 */
export function parseReminder(rawText: string, todayISO: string): ReminderDraft {
  const now = new Date()
  // cleanTranscript runs self-correction normalization ("X סליחה Y" → "Y")
  // and digit-time cleanup before any downstream extractor sees the text.
  const t = cleanTranscript(rawText)

  // Step 1: detect recurrence
  const recurBase = parseRecurrence(t)
  const isRecurring = !!recurBase

  // Step 2: detect relative time
  const relTime = !isRecurring ? parseRelativeTime(t, now) : null

  // Step 3: use localParser for absolute date+time if no relative time
  const localDraft = !relTime ? parseLocally(t, todayISO) : null

  // Step 4: strip command verbs to get the action phrase
  const stripped = stripReminderCommand(t)

  // Step 5: extract person phrase
  const personPhrase = extractReminderPersonPhrase(stripped)
  let familyResolution: ReminderDraft['familyResolution'] | undefined
  let resolvedTitle: string | undefined

  if (personPhrase) {
    const resolved = resolvePersonPhrase(personPhrase)
    if (resolved.status === 'resolved') {
      familyResolution = { status: 'resolved', originalPhrase: personPhrase, resolvedName: resolved.name }
    } else if (resolved.status === 'ambiguous') {
      familyResolution = { status: 'ambiguous', originalPhrase: personPhrase, candidates: resolved.candidates }
    } else if (resolved.status === 'missing') {
      familyResolution = { status: 'missing', originalPhrase: personPhrase }
    }
  }

  // Step 6: determine title
  // Use localParser title if available (also strip any leaking command verbs), else compute from stripped text
  let rawTitle: string | undefined = localDraft?.title ? stripReminderCommand(localDraft.title).trim() || undefined : undefined
  if (!rawTitle) {
    // Fall back: use stripped text but remove time/date words
    rawTitle = stripped
      .replace(/(?:בעוד|עוד)\s+[֐-׿\s\d]+(?:דקות|שעות|שעה|שעתיים|חצי\s+שעה|רבע\s+שעה)/g, '')
      .replace(/(?:כל\s+(?:יום|בוקר|ערב|שבוע)(?:\s+ביום\s+[֐-׿]+)?)/g, '')
      .replace(/(?:מחר|היום|מחרתיים|ביום\s+[֐-׿]+)/g, '')
      .replace(/(?:בשעה|ב-)\s*\d{1,2}(?::\d{2})?/g, '')
      .replace(/\s+/g, ' ')
      .trim() || undefined
  }

  // Replace person phrase with resolved name in title if resolved
  if (rawTitle && familyResolution?.status === 'resolved' && familyResolution.originalPhrase && familyResolution.resolvedName) {
    resolvedTitle = rawTitle.replace(familyResolution.originalPhrase, familyResolution.resolvedName)
  } else {
    resolvedTitle = rawTitle
  }

  // Step 7: detect category
  const category = detectCategory(rawTitle ?? t)

  // Step 8: compute dueAt / labels
  let dueAt: string | undefined
  let displayDateLabel: string | undefined
  let displayTimeLabel: string | undefined
  let recurrence: ReminderRecurrence | undefined

  if (relTime) {
    dueAt = relTime.dueAt
    displayDateLabel = relTime.displayDateLabel
    displayTimeLabel = relTime.displayTimeLabel
  } else if (localDraft?.date && localDraft?.time) {
    dueAt = `${localDraft.date}T${localDraft.time}:00`
    displayDateLabel = buildDateLabel(localDraft.date, todayISO)
    displayTimeLabel = localDraft.time
  } else if (localDraft?.date) {
    displayDateLabel = buildDateLabel(localDraft.date, todayISO)
  } else if (localDraft?.time) {
    // Time only (today implied)
    dueAt = `${todayISO}T${localDraft.time}:00`
    displayDateLabel = 'היום'
    displayTimeLabel = localDraft.time
  }

  // Recurrence: if recurring, override dueAt with next occurrence
  if (isRecurring && recurBase) {
    const timeStr = localDraft?.time || extractTimeFromText(t) || '09:00'
    recurrence = { ...recurBase, time: timeStr }
    const [h, m] = timeStr.split(':').map(Number)
    const nextDue = new Date(now)
    nextDue.setHours(h ?? 9, m ?? 0, 0, 0)
    if (nextDue <= now) nextDue.setDate(nextDue.getDate() + 1)
    dueAt = localISOString(nextDue)
    displayDateLabel = 'כל יום'
    displayTimeLabel = timeStr

    // Weekly: find next occurrence of the right day
    if (recurBase.frequency === 'weekly' && recurBase.daysOfWeek?.length) {
      const target = recurBase.daysOfWeek[0]!
      const cur = now.getDay()
      let diff = (target - cur + 7) % 7
      if (diff === 0 && now.getHours() >= (h ?? 9)) diff = 7
      const d = new Date(now)
      d.setDate(d.getDate() + diff)
      d.setHours(h ?? 9, m ?? 0, 0, 0)
      dueAt = localISOString(d)
    }
  }

  // Step 9: compute missingFields
  const missingFields: Array<'title' | 'date' | 'time'> = []
  if (!resolvedTitle) missingFields.push('title')
  if (!dueAt && !recurrence) {
    if (!displayDateLabel) missingFields.push('date')
    if (!displayTimeLabel) missingFields.push('time')
  }

  // Step 10: detect ambiguity
  let ambiguity: ReminderDraft['ambiguity'] | undefined
  if (localDraft?.ambiguousTime && !recurrence) {
    const rawHour = localDraft.time?.slice(0, 2) ?? '?'
    const h24 = parseInt(rawHour, 10)
    const hPm = h24 >= 12 ? h24 : h24 + 12
    ambiguity = {
      type: 'time',
      question: 'לאיזו שעה התכוונת?',
      options: [
        { label: `${String(h24).padStart(2, '0')}:00 בבוקר`, value: `${String(h24).padStart(2, '0')}:00` },
        { label: `${String(hPm).padStart(2, '0')}:00 בערב`, value: `${String(hPm).padStart(2, '0')}:00` },
      ],
    }
  } else if (familyResolution?.status === 'ambiguous' && familyResolution.candidates) {
    ambiguity = {
      type: 'person',
      question: 'למי התכוונת?',
      options: familyResolution.candidates.map(c => ({ label: c, value: c })),
    }
  } else if (missingFields.includes('time')) {
    ambiguity = {
      type: 'time',
      question: 'מתי להזכיר לך?',
      options: [
        { label: 'בעוד שעה', value: 'in_1h' },
        { label: 'היום בערב', value: 'today_evening' },
        { label: 'מחר בבוקר', value: 'tomorrow_morning' },
        { label: 'לבחור שעה', value: 'manual' },
      ],
    }
  }

  // Step 11: readback
  const readbackText = buildReadbackText(resolvedTitle, displayDateLabel, displayTimeLabel, recurrence)

  const draft: ReminderDraft = {
    intent: 'reminder',
    category,
    alertPolicyDraft: { sound: true, voice: true, snoozeMinutes: 10 },
    missingFields,
    readbackText,
  }
  if (resolvedTitle !== undefined) draft.title = resolvedTitle
  if (dueAt !== undefined) draft.dueAt = dueAt
  if (displayDateLabel !== undefined) draft.displayDateLabel = displayDateLabel
  if (displayTimeLabel !== undefined) draft.displayTimeLabel = displayTimeLabel
  if (recurrence !== undefined) draft.recurrence = recurrence
  if (ambiguity !== undefined) draft.ambiguity = ambiguity
  if (familyResolution !== undefined) draft.familyResolution = familyResolution
  return draft
}

function buildDateLabel(dateISO: string, todayISO: string): string {
  if (dateISO === todayISO) return 'היום'
  const tomorrow = new Date(todayISO + 'T00:00:00Z')
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  if (dateISO === tomorrow.toISOString().slice(0, 10)) return 'מחר'
  const [, m, d] = dateISO.split('-').map(Number)
  return `ב-${d} ב${hebrewMonthName(m ?? 1)}`
}

const HEB_MONTHS = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

function hebrewMonthName(m: number): string {
  return HEB_MONTHS[m] ?? ''
}

function extractTimeFromText(text: string): string | null {
  const numMatch = text.match(/(?:בשעה\s+|ב-)(\d{1,2})(?::(\d{2}))?/)
  if (numMatch) {
    const h = parseInt(numMatch[1]!, 10)
    const m = parseInt(numMatch[2] ?? '0', 10)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }
  return null
}

export type { ReminderDraft }
