import { loadFamilyData } from '../../services/familyLoader'
import { parseHebrewDate, parseHebrewMonth } from './dateParser'
import { isCreateIntent } from './calendarCreate'

export type RouteType =
  | 'family_lookup' | 'family_location'
  | 'calendar_today' | 'calendar_tomorrow' | 'calendar_upcoming'
  | 'calendar_exact_date' | 'calendar_month'
  | 'calendar_create'
  | 'birthday_lookup' | 'memorial_lookup'
  | 'non_personal'

export interface RouteResult {
  type: RouteType
  query: string
  familyQuery?: string
  dateStr?: string
  month?: number
}

const CALENDAR_TODAY = /מה יש לי היום|מה יש היום|יש לי משהו היום|מה קבעתי היום|מה קורה היום|מה התוכנית היום/i
const CALENDAR_TOMORROW = /מה יש מחר|מה יש לי מחר|יש לי משהו מחר|מה קבעתי מחר|מה קורה מחר|מה התוכנית מחר|צריך לקום מחר/i
const CALENDAR_UPCOMING = /מה יש השבוע|מה יש לי השבוע|מה יש בשבוע|מה הפגישות הקרובות|מה התורים הקרובים|מה האירועים הקרובים|יש לי משהו השבוע|מה התוכנית/i
const FAMILY_LOCATION = /איפה .+ גר|איפה גר/i
const FAMILY_PATTERNS = /מי (זה|זאת|זו|הוא|היא)\s|מי ה(בן|בת|נכד|נכדה)|איך קוראים ל|מה הקשר (של|עם)|איך .+ קשור|הנכד שלי|הנכדה שלי|הבן שלי|הבת שלי|הילדים שלי|הנכדים שלי/i

const BIRTHDAY_LOOKUP = /מתי (יום ה?הולדת|היום הולדת|ה?יומולדת) (של |שלי |של ה?)?(.+)/i
const MEMORIAL_LOOKUP = /מתי (יום ה?זיכרון|ה?אזכרה) (של |שלי |של ה?)?(.+)/i

// Past calendar: "מה היה לי אתמול", "מה היה באחד באפריל", "מה היה בפסח"
const CALENDAR_PAST = /מה היה|מה קרה|מה עשיתי|מה עשית/i
// Exact date: "מה יש ב-5 במאי", "מה יש באחד באפריל"
const CALENDAR_DATE = /מה יש ב[־-]?\d|מה יש ב[אבגדהוזחטיכלמנסעפצקרשת]/i
// Month: "למי יש יום הולדת באפריל", "מה יש באפריל"
const BIRTHDAY_MONTH = /למי (יש )?יום הולדת ב/i

export function routePersonalQuery(text: string): RouteResult {
  const t = text.trim()

  // Calendar create — must come BEFORE read queries
  // "תקבעי לי / יש לי תור / תזכירי לי" = create, not read
  if (isCreateIntent(t)) return { type: 'calendar_create', query: t }

  // Fixed-scope calendar (order matters: today/tomorrow before general date)
  if (CALENDAR_TODAY.test(t)) return { type: 'calendar_today', query: t }
  if (CALENDAR_TOMORROW.test(t)) return { type: 'calendar_tomorrow', query: t }
  if (CALENDAR_UPCOMING.test(t)) return { type: 'calendar_upcoming', query: t }

  // Birthday lookup: "מתי יום ההולדת של פפי"
  const bdayMatch = t.match(BIRTHDAY_LOOKUP)
  if (bdayMatch) {
    const name = bdayMatch[3]?.trim().replace(/[?？]/g, '') ?? ''
    return { type: 'birthday_lookup', query: t, familyQuery: name }
  }

  // Memorial lookup: "מתי יום הזיכרון של פפי"
  const memMatch = t.match(MEMORIAL_LOOKUP)
  if (memMatch) {
    const name = memMatch[3]?.trim().replace(/[?？]/g, '') ?? ''
    return { type: 'memorial_lookup', query: t, familyQuery: name }
  }

  // Birthday by month: "למי יש יום הולדת באפריל"
  if (BIRTHDAY_MONTH.test(t)) {
    const month = parseHebrewMonth(t)
    if (month) return { type: 'calendar_month', query: t, month }
  }

  // Past queries: "מה היה לי אתמול", "מה היה באחד באפריל"
  if (CALENDAR_PAST.test(t)) {
    const dateStr = parseHebrewDate(t)
    if (dateStr) return { type: 'calendar_exact_date', query: t, dateStr }
    // If no specific date parsed but has month, route to month
    const month = parseHebrewMonth(t)
    if (month) return { type: 'calendar_month', query: t, month }
  }

  // Exact date queries: "מה יש ב-5 במאי"
  if (CALENDAR_DATE.test(t)) {
    const dateStr = parseHebrewDate(t)
    if (dateStr) return { type: 'calendar_exact_date', query: t, dateStr }
    const month = parseHebrewMonth(t)
    if (month) return { type: 'calendar_month', query: t, month }
  }

  // Family location
  if (FAMILY_LOCATION.test(t)) {
    const nameMatch = extractFamilyName(t) ?? matchKnownFamilyName(t)
    return { type: 'family_location', query: t, familyQuery: nameMatch ?? t }
  }

  // Family lookup
  if (FAMILY_PATTERNS.test(t)) {
    const nameMatch = extractFamilyName(t)
    return { type: 'family_lookup', query: t, familyQuery: nameMatch ?? t }
  }

  // Known family name mentioned
  const knownName = matchKnownFamilyName(t)
  if (knownName) {
    return { type: 'family_lookup', query: t, familyQuery: knownName }
  }

  return { type: 'non_personal', query: t }
}

function extractFamilyName(text: string): string | null {
  const patterns = [
    /מי (?:זה|זאת|זו|הוא|היא)\s+(.+)/i,
    /איך קוראים ל(.+)/i,
    /מה הקשר (?:של|עם) (.+)/i,
    /איפה (.+?) גר/i,
    /איפה גר[הא]?\s+(.+)/i,
  ]
  for (const p of patterns) {
    const match = text.match(p)
    if (match?.[1]) return match[1].trim().replace(/[?？]/g, '')
  }
  return null
}

function matchKnownFamilyName(text: string): string | null {
  const members = loadFamilyData()
  const lower = text.toLowerCase()
  for (const m of members) {
    if (m.hebrew && lower.includes(m.hebrew)) return m.hebrew
    for (const alias of m.aliases) {
      if (lower.includes(alias.toLowerCase())) return alias
    }
  }
  return null
}
