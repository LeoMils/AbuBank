import { loadFamilyData } from '../../services/familyLoader'

export type RouteType = 'family_lookup' | 'calendar_today' | 'calendar_tomorrow' | 'calendar_upcoming' | 'non_personal'

export interface RouteResult {
  type: RouteType
  query: string
  familyQuery?: string
}

const CALENDAR_TODAY = /מה יש לי היום|מה יש היום|יש לי משהו היום|מה קבעתי היום|מה קורה היום|מה התוכנית היום/i
const CALENDAR_TOMORROW = /מה יש מחר|מה יש לי מחר|יש לי משהו מחר|מה קבעתי מחר|מה קורה מחר|מה התוכנית מחר|צריך לקום מחר/i
const CALENDAR_UPCOMING = /מה יש השבוע|מה יש לי השבוע|מה יש בשבוע|מה הפגישות הקרובות|מה התורים הקרובים|מה האירועים הקרובים|יש לי משהו השבוע|מה התוכנית/i
const FAMILY_PATTERNS = /מי (זה|זאת|זו|הוא|היא)\s|מי ה(בן|בת|נכד|נכדה)|איך קוראים ל|מה הקשר (של|עם)|איך .+ קשור|הנכד שלי|הנכדה שלי|הבן שלי|הבת שלי|הילדים שלי|הנכדים שלי/i

export function routePersonalQuery(text: string): RouteResult {
  const t = text.trim()

  if (CALENDAR_TODAY.test(t)) return { type: 'calendar_today', query: t }
  if (CALENDAR_TOMORROW.test(t)) return { type: 'calendar_tomorrow', query: t }
  if (CALENDAR_UPCOMING.test(t)) return { type: 'calendar_upcoming', query: t }

  if (FAMILY_PATTERNS.test(t)) {
    const nameMatch = extractFamilyName(t)
    return { type: 'family_lookup', query: t, familyQuery: nameMatch ?? t }
  }

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
