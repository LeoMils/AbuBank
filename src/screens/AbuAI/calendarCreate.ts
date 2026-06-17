import { parseHebrewDate } from './dateParser'
import { detectEmoji } from '../AbuCalendar/service'

// ─── State Machine ──────────────────────────────────────────────────────────

export type CreatePhase = 'idle' | 'creating' | 'confirming'

export interface CreateDraft {
  title: string | null
  date: string | null
  time: string | null
  /** Hour was understood but AM/PM is unresolved (e.g. bare "בשבע"). */
  ambiguousTime?: boolean
  emoji?: string
  location?: string | null
  notes?: string | null
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
const SCHEDULE_VERB = /(?<![֐-׿])(?:תקבעי|תקבע|קבעי|קבע|תרשמי|תרשום|רשמי|שימי|תשימי|תוסיפי|תוסיף|תזכירי|תכניסי|תכניס|תעשי)(?![֐-׿])/

// A date OR time OR "עם <someone>" clue — enough, combined with a scheduling
// verb, to commit to calendar_create even when a family name is present.
function hasScheduleClue(t: string): boolean {
  const hasDate = /היום|מחר|מחרתיים|(?:ב?יום\s+|ב)(?:ראשון|שני|שלישי|רביעי|רביע|חמישי|שישי|שבת)|בעוד\s+שבוע|שבוע\s+הבא/.test(t)
  const hasTime = /בשעה|בבוקר|בערב|בצהריים|אחהצ|אחה"צ|אחר[י]?\s+הצהריים|[בל](?:שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|אחת|שתיים)|\d{1,2}[:.]\d{2}|\d{1,2}\s*(?:אחהצ|בערב|בבוקר|בצהריים)/.test(t)
  const hasWith = /(?<![֐-׿])עם\s+\S/.test(t)
  return hasDate || hasTime || hasWith
}

export function isCreateIntent(text: string): boolean {
  const t = normalizeCreateText(text.trim())
  if (READ_NOT_CREATE.test(t)) return false
  if (CREATE_INTENT.test(t)) return true
  // Natural speech with "צריכה להיות" etc.
  if (NATURAL_INTENT.test(t)) return true
  // Scheduling verb (even without "לי") + a date/time/with clue. Action beats
  // family Q&A: "תקבע עם מור ברביעי" is a create, not "who is Mor?".
  if (SCHEDULE_VERB.test(t) && hasScheduleClue(t)) return true
  // Implicit: has date + time + an appointment/event noun (describing a future event).
  // Bare "מחר בערב" without a noun must NOT trigger create — it could be casual speech.
  const APPOINTMENT_NOUN = /פגישה|תור|בדיקה|רופא|רופאה|אירוע|ארוחה|שיעור|ביקור|אצל\s|עם\s/i
  if (hasTimeAndDateContext(t) && APPOINTMENT_NOUN.test(t)) return true
  return false
}

// ─── Confirmation / Cancel ──────────────────────────────────────────────────

const CONFIRM = /^(כן|נכון|בדיוק|בסדר|סבבה|יאללה|תרשמי|כן תרשמי|אוקיי|אוקי|ok|yes|כן כן|בטח|ברור|מאשרת|תאשרי)$/i
const CANCEL = /^(לא|לא נכון|עזבי|עזבי את זה|תשכחי|ביטול|לא צריך|בטלי|לא רוצה|חבל|תעזבי|לא לא|לא לא לא|לא לא לא לא|עזבי עזבי|לא לזה התכוונתי|תמחקי|תמחקי את זה|תבטלי|תבטלי את זה|מחקי|תמחקי את הפגישה|תבטלי את הפגישה)$/i

export function isConfirm(text: string): boolean {
  return CONFIRM.test(text.trim())
}

export function isCancel(text: string): boolean {
  return CANCEL.test(text.trim())
}

// ─── Time Parsing ───────────────────────────────────────────────────────────

const HEBREW_HOUR_WORDS: Record<string, number> = {
  'אחת': 1, 'שתיים': 2, 'שלוש': 3, 'ארבע': 4, 'חמש': 5,
  'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10,
  'אחת עשרה': 11, 'שתים עשרה': 12,
}

// Period hints. PM covers evening / noon / afternoon; AM covers morning.
// "אחהצ" (no gershayim) is the common bare abbreviation Martita types.
const PERIOD_PM = /בערב|בלילה|אחר[י]? הצהריים|אחה"צ|אחה״צ|אחהצ|בצהריים/
const PERIOD_AM = /בבוקר|לפנות בוקר/

// Resolve a 1-12 hour to 24h using period hints. With no hint, hours 1-6 are
// taken as PM (appointment convention) and 7-12 stay as the AM reading but are
// flagged ambiguous so the create flow asks "בבוקר או בערב?" instead of
// silently guessing.
function applyPeriod(h: number, t: string): { hour: number; ambiguous: boolean } {
  if (PERIOD_AM.test(t)) return { hour: h >= 12 ? h - 12 : h, ambiguous: false }
  // "בלילה" for hours 1-5 = after midnight (AM), not PM
  if (/בלילה/.test(t) && h >= 1 && h <= 5) return { hour: h, ambiguous: false }
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

  // "בשעה 15:00" / "ב-10:30" / "בשעה 9" / bare "13:22" — numeric is literal
  // (never ambiguous). The "ב"/"בשעה" prefix is optional so a clock time
  // typed on its own ("בשני 13:22") is still understood.
  const numericTime = t.match(/(?:ב[־-]?)?(?:שעה\s+)?(?<![\d/.])(\d{1,2})[:.](\d{2})(?![\d/])/)
  if (numericTime) {
    const h = parseInt(numericTime[1]!, 10)
    const m = parseInt(numericTime[2]!, 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
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

  if (/היום/.test(t)) return todayStr()
  if (/מחרתיים/.test(t)) {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return localDateStr(d)
  }
  if (/מחר/.test(t)) return tomorrowStr()

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

  // "בעוד שבוע"
  if (/בעוד שבוע/.test(t)) {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return localDateStr(d)
  }

  // Fall back to existing dateParser (handles "ב-15 באפריל", etc.)
  return parseHebrewDate(t)
}

// ─── Title Extraction ───────────────────────────────────────────────────────

// Explanation clauses to strip ("כי היא ביקשה...", "אם...")
// Hebrew has no \b word boundary — use space/start-of-string anchor
const EXPLANATION_NOISE = /\s+(?:כי|כיוון ש|בגלל ש|למרות ש)\s.*/gi
// Intent prefixes to strip (anywhere, not just start)
const NOISE_PHRASES = /(תקבעי? לי|תרשמי? לי|תוסיפי? לי|תזכירי? לי|תכניסי? לי|תעשי? לי|שימי? לי|קבעי? לי|רשמי? לי|תכניסי? ליומן|תשימי? ביומן|צריכה? לקבוע|רוצה? לקבוע|אני רוצה|יש לי)\s*/gi
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
const PERIOD_NOISE = /(בבוקר|בערב|בלילה|בצהריים|אחר הצהריים|אחרי הצהריים|אחהצ|אחה"צ|אחה״צ)/gi
// Leading scheduling verb without "לי" ("תקבע עם מור" → "עם מור").
const SCHEDULE_VERB_LEAD = /^(?:תקבעי|תקבע|קבעי|קבע|תרשמי|תרשום|רשמי|שימי|תשימי|תוסיפי|תוסיף|תזכירי|תכניסי|תכניס|תעשי)\s+(?:לי\s+)?/
// Connector word leftover
const LEADING_CONNECTOR = /^[שו]\s+/

export function extractTitle(text: string): string | null {
  let t = normalizeCreateText(text.trim())
  // 1. Strip explanation clauses first
  t = t.replace(EXPLANATION_NOISE, '')
  // 2. Strip intent phrases and natural speech verbs
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

  const title = extractTitle(text)
  const date = parseCreateDate(text)
  const { time, ambiguous } = parseHebrewTimeDetailed(text)
  const emoji = title ? detectEmoji(title) : '📅'

  const missing: Array<'title' | 'date' | 'time'> = []
  if (!title) missing.push('title')
  if (!date) missing.push('date')
  // No time, OR an understood-but-ambiguous time, both need clarification.
  if (!time || ambiguous) missing.push('time')

  return {
    draft: { title, date, time, ambiguousTime: ambiguous, emoji },
    missing,
  }
}

// ─── State Transitions ──────────────────────────────────────────────────────

export function startCreate(text: string): CalendarCreateState {
  const parsed = parseCreateIntent(text)
  if (!parsed) return IDLE_STATE

  if (parsed.missing.length === 0) {
    return { phase: 'confirming', draft: parsed.draft, missing: [] }
  }
  return { phase: 'creating', draft: parsed.draft, missing: parsed.missing }
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
    if (newTime && !ambiguous && newTime !== correctionDraft.time) {
      correctionDraft.time = newTime
      correctionDraft.ambiguousTime = false
      corrected = true
    }
    if (corrected) {
      return { phase: 'confirming', draft: correctionDraft, missing: [] }
    }
  }

  // Try to fill missing fields from the new message
  const draft = { ...state.draft }
  const stillMissing = [...state.missing]

  // Title
  if (stillMissing.includes('title')) {
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
      // A fresh but still-ambiguous hour — keep asking.
      draft.time = time
      draft.ambiguousTime = true
    }
  }

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

export function resolvePendingMessage(
  state: CalendarCreateState,
  text: string,
  isCalendarReadQuery: boolean,
): PendingResolution {
  const t = text.trim()

  // Explicit cancel always wins.
  if (isCancel(t)) return { action: 'cancel' }

  // Explicit confirmation while confirming → save.
  if (state.phase === 'confirming' && isConfirm(t)) {
    return { action: 'save', draft: state.draft }
  }

  // A brand-new create request replaces the pending draft.
  if (isCreateIntent(t)) {
    const next = startCreate(t)
    if (next.phase !== 'idle') return { action: 'replace', state: next }
  }

  // A calendar read query while pending → answer from local calendar.
  if (isCalendarReadQuery) return { action: 'read' }

  // Off-topic detection: if the user switches to a completely different
  // subject (no date, no time, no scheduling word, not a question about
  // a person or the calendar), cancel the pending draft silently rather
  // than forcing it into the create state machine.
  // Examples: "אני קצת משועממת היום", "ספרי לי בדיחה"
  // NOT off-topic: "מי זה מור?", "מה יש לי מחר?", "בעשר בבוקר"
  const hasDateOrTime = /מחר|היום|אתמול|שבוע|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|בבוקר|בערב|בצהריים|בלילה|בשעה|ב[־-]?\d|אחרי|לפני|בעוד/i.test(t)
  const hasScheduleWord = /תור|פגישה|רופא|בדיקה|קבוע|אחרי הפגישה|אחרי התור/i.test(t)
  const isQuestion = /^(מי|מה|מתי|איפה|איך|למה|כמה|האם)\s/i.test(t) || t.endsWith('?')
  // Off-topic: 3+ words, no scheduling context, not a question
  // OR: emotional/personal statement (starts with "אני") with no date/time
  const isPersonalStatement = /^אני\s/.test(t) && !hasDateOrTime
  if (!hasDateOrTime && !hasScheduleWord && !isQuestion && (t.split(/\s+/).length >= 3 || isPersonalStatement)) {
    return { action: 'cancel' }
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
    if (!draftChanged) return { action: 'clarify' }
  }

  return { action: 'update', state: next }
}
