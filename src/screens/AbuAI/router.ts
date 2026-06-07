import { loadFamilyData } from '../../services/familyLoader'
import { parseHebrewDate, parseHebrewMonth } from './dateParser'
import { isCreateIntent, parseCreateDate } from './calendarCreate'

export type RouteType =
  | 'family_lookup' | 'family_location' | 'family_relationship_between'
  | 'calendar_today' | 'calendar_tomorrow' | 'calendar_upcoming'
  | 'calendar_exact_date' | 'calendar_month'
  | 'calendar_create'
  | 'birthday_lookup' | 'memorial_lookup'
  | 'contact_action'
  | 'non_personal'

export interface RouteResult {
  type: RouteType
  query: string
  familyQuery?: string
  /** Second person name when type === 'family_relationship_between'. */
  familyQueryB?: string
  dateStr?: string
  month?: number
  /** When type === 'contact_action', the requested action verb. */
  contactAction?: 'call' | 'whatsapp' | 'message'
}

// ─── Hebrew patterns (preserved + extended) ─────────────────────────────────
const CALENDAR_TODAY = /מה יש לי היום|מה יש היום|יש לי משהו היום|מה קבעתי היום|מה קורה היום|מה התוכנית היום/i
const CALENDAR_TOMORROW = /מה יש (לי )?מחר|יש לי משהו מחר|מה קבעתי מחר|מה קורה (לי )?מחר|מה התוכנית מחר|צריך לקום (מוקדם )?מחר/i
const CALENDAR_UPCOMING = /מה יש (לי )?השבוע|מה יש (לי )?בשבוע|מה יש שבוע הבא|שבוע הבא\??$|מה הפגישות הקרובות|מה התורים הקרובים|מה האירועים הקרובים|יש לי משהו .{0,16}השבוע|מה התוכני[ותי]+|מה יש (לי )?ביומן|מה יש ביומן/i

// Forgiving week/upcoming variants for an elderly Hebrew user. Covers
// "איזה פגישות יש לי (ב)שבוע הקרוב", "מה הפגישות שלי השבוע",
// "תראי לי את הפגישות שלי", "יש לי פגישות/משהו (ב)שבוע הקרוב".
const CALENDAR_UPCOMING_EXT = /איזה\s+(?:פגישות|תורים|אירועים)\s+(?:יש\s+לי|יש|שלי)|מה\s+ה?(?:פגישות|תורים|אירועים)\s+שלי|תראי לי\s+(?:את\s+)?ה?(?:פגישות|תורים|אירועים|יומן)|יש\s+לי\s+(?:פגישות|תורים|אירועים|משהו)\s+.{0,8}(?:שבוע|השבוע)/i

// Specific-weekday READ: "יש לי משהו ביום חמישי", "מה יש לי ביום חמישי",
// "מה יש בחמישי", "מה קבעתי ביום שני". Resolves the weekday to a concrete
// date locally (no server) and reads that day's events.
const CALENDAR_WEEKDAY_READ = /(?:מה\s+יש(?:\s+לי)?|יש\s+לי\s+משהו|מה\s+קבעתי|מה\s+התוכנית|מה\s+קורה)\s+ב(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?![֐-׿])/i
const FAMILY_LOCATION = /איפה .+ גר|איפה גר/i
const FAMILY_PATTERNS = /מי (זה|זאת|זו|הוא|היא)\s|מי ה(בן|בת|נכד|נכדה)|איך קוראים ל|מה הקשר (של|עם)|איך .+ קשור|הנכד שלי|הנכדה שלי|הבן שלי|הבת שלי|הילדים שלי|הנכדים שלי/i

const BIRTHDAY_LOOKUP = /מתי (יום ה?הולדת|היום הולדת|ה?יומולדת) (של |שלי |של ה?)?(.+)/i
const MEMORIAL_LOOKUP = /מתי (יום ה?זיכרון|ה?אזכרה) (של |שלי |של ה?)?(.+)/i

// Hebrew loose calendar — broader phrasing the original isPersonalQuery
// captured before the unification. Examples:
//   "מה קורה השבוע?" / "מתי יש לי רופא?" / "מתי התור הבא שלי?"
//   "מתי הרופא הבא שלי?" / "יש אירוע ביומן?" / "תזכירי לי מחר"
//   "יש לי פגישה מחר" / "יש לי יום עמוס?" / "אני פנוי השבוע?"
const CALENDAR_HEBREW_LOOSE = /מה קורה ה?שבוע|מתי (יש לי )?(הרופא|רופא|רופאה|דוקטור|דוקטורה|דנטיסט|תור|פגישה|אירוע)|מתי התור.{0,8}שלי|יש (אירוע|תור|פגישה).{0,12}ביומן|יש לי (פגישה|אירוע|תור) (מחר|היום|השבוע)|תזכירי לי|תזכרי לי|יש לי יום עמוס|יום עמוס|אני פנוי השבוע|פנוי השבוע|פנוי מחר|פנויה השבוע/i

// Past calendar: "מה היה לי אתמול", "מה היה באחד באפריל", "מה היה בפסח"
const CALENDAR_PAST = /מה היה|מה קרה|מה עשיתי|מה עשית/i
// Exact date: "מה יש ב-5 במאי", "מה יש באחד באפריל"
const CALENDAR_DATE = /מה יש ב[־-]?\d|מה יש ב[אבגדהוזחטיכלמנסעפצקרשת]/i
// Month: "למי יש יום הולדת באפריל", "מה יש באפריל"
const BIRTHDAY_MONTH = /למי (יש )?יום הולדת ב/i

// ─── Spanish patterns (B1 patch) ────────────────────────────────────────────
// Calendar — today / tomorrow / this-week / medical appointment.
// Accent-tolerant: accept "qué" or "que", "mañana" or "manana", "médico" or "medico".
const SPANISH_CAL_TODAY = /(?:^|[^a-záéíóúñ])(?:qu[eé])\s+(?:tengo|ten[eé]s)\s+(?:para\s+)?hoy(?:[^a-záéíóúñ]|$)|calendario\s+(?:de\s+)?hoy|agenda\s+(?:de\s+)?hoy/i
const SPANISH_CAL_TOMORROW = /(?:^|[^a-záéíóúñ])(?:qu[eé])\s+(?:tengo|ten[eé]s)\s+(?:para\s+)?ma[nñ]ana(?:[^a-záéíóúñ]|$)|calendario\s+(?:de\s+)?ma[nñ]ana|agenda\s+(?:de\s+)?ma[nñ]ana/i
const SPANISH_CAL_UPCOMING = /(?:^|[^a-záéíóúñ])(?:qu[eé])\s+(?:tengo|ten[eé]s)\s+(?:esta\s+semana|en\s+la\s+semana|pr[oó]xim)|calendario\s+esta\s+semana|agenda\s+de\s+la\s+semana/i
const SPANISH_CAL_MEDICAL = /(?:^|[^a-záéíóúñ])cu[aá]ndo\s+tengo\s+(?:m[eé]dico|doctor|dentista|cita|turno)/i

// Family — Háblame de X / Cuéntame de X / Quién es X / Contame de X.
const SPANISH_FAMILY_Q = /(?:^|[^a-záéíóúñ])(?:h[aá]blame|cu[eé]ntame|c[oó]ntame|contame|cuentame)\s+(?:de|sobre)\s+([^?¿!.]+)/i
const SPANISH_WHO_IS = /(?:^|[^a-záéíóúñ])(?:qui[eé]n)\s+es\s+([^?¿!.]+)/i

// ─── English patterns (B1 patch) ────────────────────────────────────────────
const ENGLISH_CAL_TODAY = /\bwhat(?:'?s| is| do i have)\s+(?:on\s+)?today\b|\b(?:my\s+)?(?:calendar|agenda)\s+today\b|\btoday'?s\s+(?:calendar|agenda|appointments?|schedule)\b/i
const ENGLISH_CAL_TOMORROW = /\bwhat(?:'?s| is| do i have)\s+(?:on\s+)?tomorrow\b|\b(?:my\s+)?(?:calendar|agenda)\s+tomorrow\b|\btomorrow(?:'?s)?\s+(?:calendar|agenda|appointments?|schedule)\b/i
const ENGLISH_CAL_UPCOMING = /\bwhat(?:'?s)?\s+(?:this\s+week|coming\s+up|next)\b|\bappointments?\s+this\s+week\b|\bupcoming\s+(?:appointments?|events?)\b/i

const ENGLISH_FAMILY_Q = /\btell\s+me\s+about\s+([^?!.]+)/i
const ENGLISH_WHO_IS = /\bwho(?:'?s| is)\s+([^?!.]+)/i

// ─── Contact-action precedence (B2.3 joint-opt patch) ──────────────────────
//
// "תתקשרי ללאו" / "llamá a Leo" / "call Leo" / "מתי תתקשרי" must route to a
// contact_action BEFORE the loose `matchKnownFamilyName` family fallback,
// so AbuAI redirects the user to AbuWhatsApp instead of describing the
// relative as if Martita had asked "who is Leo?".
//
// Hebrew patterns intentionally omit `\b` (Hebrew letters are not "word"
// characters in JS regex). Spanish/English use the standard `\b`.
const CONTACT_ACTION_CALL_HE = /תתקשרי?\s+ל|להתקשר\s+ל/
const CONTACT_ACTION_WHATSAPP_HE = /שלחי?\s+(?:הודעה|וואטסאפ|whatsapp)|וואטסאפ\s+ל|לשלוח\s+וואטסאפ\s+ל/i
const CONTACT_ACTION_MESSAGE_HE = /שלחי?\s+הודעה\s+ל/

const CONTACT_ACTION_CALL_ES = /\bllam[aá](?:la|le|lo)?\s+a\b|\bllamar\s+a\b|\bllam[aá]\s+a\b/i
const CONTACT_ACTION_WHATSAPP_ES = /\bmand[aá](?:le|la|lo)?\s+(?:un\s+)?whatsapp\b|\bman[dd]a\s+whatsapp\s+a\b|\benv[ií]a(?:le)?\s+whatsapp\b/i
const CONTACT_ACTION_MESSAGE_ES = /\bmand[aá](?:le|la|lo)?\s+(?:un\s+)?mensaje\b|\benv[ií]a(?:le)?\s+un\s+mensaje\b/i

const CONTACT_ACTION_CALL_EN = /\bcall\s+(?:my\s+)?\w+/i
const CONTACT_ACTION_WHATSAPP_EN = /\bwhatsapp\s+\w+|\bsend\s+(?:a\s+)?whatsapp\s+to\b/i
const CONTACT_ACTION_MESSAGE_EN = /\btext\s+\w+|\bsend\s+(?:a\s+)?message\s+to\b/i

function detectContactAction(t: string): 'call' | 'whatsapp' | 'message' | null {
  if (CONTACT_ACTION_WHATSAPP_HE.test(t) || CONTACT_ACTION_WHATSAPP_ES.test(t) || CONTACT_ACTION_WHATSAPP_EN.test(t)) return 'whatsapp'
  if (CONTACT_ACTION_CALL_HE.test(t) || CONTACT_ACTION_CALL_ES.test(t) || CONTACT_ACTION_CALL_EN.test(t)) return 'call'
  if (CONTACT_ACTION_MESSAGE_HE.test(t) || CONTACT_ACTION_MESSAGE_ES.test(t) || CONTACT_ACTION_MESSAGE_EN.test(t)) return 'message'
  return null
}

// ─── Relationship-between (B2.4 patch) ─────────────────────────────────────
//
// Two-name relationship questions: "מה הקשר בין X ל-Y" / "איך X קשור ל-Y" /
// "qué relación tienen X y Y" / "qué tiene que ver X con Y" / "how is X
// related to Y" / "what is the connection between X and Y".
//
// Capture group order is "first name" then "second name". Hebrew patterns
// deliberately do not use `\b` (Hebrew letters aren't word-class). Spanish
// and English do use `\b` for the surrounding cue words.
//
// Names captured here are passed to findNode() in familyGraph.ts which is
// alias-aware, so "Rafi" → "Raphi", "לאו" → "Leo", etc.
const REL_BETWEEN_HE_QESHER = /מה\s+ה?קשר\s+בין\s+(\S+?)\s+ל[־-]?(\S+?)[\s?!.,]*$/
const REL_BETWEEN_HE_HOW = /איך\s+(\S+?)\s+קשור[הת]?\s+ל[־-]?(\S+?)[\s?!.,]*$/
const REL_BETWEEN_HE_VER = /מה\s+(\S+?)\s+קשור[הת]?\s+ל[־-]?(\S+?)[\s?!.,]*$/

const REL_BETWEEN_ES_QUE_REL = /\bqu[eé]\s+relaci[oó]n\s+tienen\s+([^\s?¿!.]+)\s+y\s+([^\s?¿!.]+)/i
const REL_BETWEEN_ES_QUE_VER = /\bqu[eé]\s+tiene\s+que\s+ver\s+([^\s?¿!.]+)\s+con\s+([^\s?¿!.]+)/i
const REL_BETWEEN_ES_COMO_REL = /\bc[oó]mo\s+se\s+relaciona\s+([^\s?¿!.]+)\s+con\s+([^\s?¿!.]+)/i

const REL_BETWEEN_EN_HOW_REL = /\bhow\s+is\s+([^\s?!.]+)\s+related\s+to\s+([^\s?!.]+)/i
const REL_BETWEEN_EN_CONNECTION = /\bwhat(?:'?s| is)\s+the\s+connection\s+between\s+([^\s?!.]+)\s+and\s+([^\s?!.]+)/i

function detectRelationBetween(t: string): { a: string; b: string } | null {
  const tries: Array<RegExp> = [
    REL_BETWEEN_HE_QESHER, REL_BETWEEN_HE_HOW, REL_BETWEEN_HE_VER,
    REL_BETWEEN_ES_QUE_REL, REL_BETWEEN_ES_QUE_VER, REL_BETWEEN_ES_COMO_REL,
    REL_BETWEEN_EN_HOW_REL, REL_BETWEEN_EN_CONNECTION,
  ]
  for (const re of tries) {
    const m = t.match(re)
    if (m && m[1] && m[2]) {
      // The HE regexes already match the preposition slot `ל[־-]?` BEFORE
      // the second-name capture group, so the captured name already
      // excludes the preposition. We only strip trailing punctuation
      // here — never a leading ל, because real names like "לאו"
      // legitimately start with ל.
      const cleanA = m[1].replace(/[?¿!.,]+$/u, '')
      const cleanB = m[2].replace(/[?¿!.,]+$/u, '')
      if (cleanA && cleanB) return { a: cleanA, b: cleanB }
    }
  }
  return null
}

// ─── Open-topic guard (B1 patch) ────────────────────────────────────────────
// Matches phrases that reliably mean "general culture/recommendation/story",
// NOT a personal/family/calendar question. Used as a final guard before the
// loose `matchKnownFamilyName` fallback so that "Recomendame un podcast"
// stays open even though "podcast" is short.
const OPEN_TOPIC = /\b(recomendame|recom[ie]ndame|recommend|recomienda|recomi[eé]ndale|recomi[eé]ndaselo|story|historia|cuento|pel[ií]cula|movie|film|podcast|libro|book|m[uú]sica|music|cultura|cultur(?:al|a)|pol[ií]tica|politics|ciencia|science|hist[oó]ricamente|history|argentina|italia|italy|spain|estados unidos|jap[oó]n|jap[oó]nes[ae]|jap[oó]n)\b/i

// ─── Centralized AbuBank intent classifier ─────────────────────────────────
//
// Priority order (action beats information):
//   1. calendar_create  2. calendar_read  3. whatsapp_action
//   4. navigation       5. family_query   6. online_query   7. general
//
// This is a thin, pure projection over routePersonalQuery (which already
// enforces create-before-read-before-family). It exists so callers/tests can
// reason about the coarse intent without depending on the fine RouteType set.
export type AbuBankIntent =
  | 'calendar_create' | 'calendar_read' | 'whatsapp_action'
  | 'navigation' | 'family_query' | 'online_query' | 'general'

export function classifyAbuBankIntent(text: string): AbuBankIntent {
  const r = routePersonalQuery(text)
  switch (r.type) {
    case 'calendar_create':
      return 'calendar_create'
    case 'calendar_today':
    case 'calendar_tomorrow':
    case 'calendar_upcoming':
    case 'calendar_exact_date':
    case 'calendar_month':
      return 'calendar_read'
    case 'contact_action':
      return 'whatsapp_action'
    case 'family_lookup':
    case 'family_location':
    case 'family_relationship_between':
    case 'birthday_lookup':
    case 'memorial_lookup':
      return 'family_query'
    case 'non_personal':
    default:
      return 'general'
  }
}

export function routePersonalQuery(text: string): RouteResult {
  const t = text.trim()

  // Calendar create — must come BEFORE read queries
  // "תקבעי לי / יש לי תור / תזכירי לי" = create, not read
  if (isCreateIntent(t)) return { type: 'calendar_create', query: t }

  // Fixed-scope calendar (order matters: today/tomorrow before general date)
  if (CALENDAR_TODAY.test(t)) return { type: 'calendar_today', query: t }
  if (CALENDAR_TOMORROW.test(t)) return { type: 'calendar_tomorrow', query: t }
  if (CALENDAR_UPCOMING.test(t)) return { type: 'calendar_upcoming', query: t }
  if (CALENDAR_UPCOMING_EXT.test(t)) return { type: 'calendar_upcoming', query: t }

  // Specific-weekday read → resolve weekday to a concrete date locally.
  if (CALENDAR_WEEKDAY_READ.test(t)) {
    const dateStr = parseCreateDate(t)
    if (dateStr) return { type: 'calendar_exact_date', query: t, dateStr }
  }

  // Spanish calendar
  if (SPANISH_CAL_TODAY.test(t)) return { type: 'calendar_today', query: t }
  if (SPANISH_CAL_TOMORROW.test(t)) return { type: 'calendar_tomorrow', query: t }
  if (SPANISH_CAL_UPCOMING.test(t)) return { type: 'calendar_upcoming', query: t }
  // Spanish "cuándo tengo médico" → upcoming (closest unknown-date scope).
  if (SPANISH_CAL_MEDICAL.test(t)) return { type: 'calendar_upcoming', query: t }

  // English calendar
  if (ENGLISH_CAL_TODAY.test(t)) return { type: 'calendar_today', query: t }
  if (ENGLISH_CAL_TOMORROW.test(t)) return { type: 'calendar_tomorrow', query: t }
  if (ENGLISH_CAL_UPCOMING.test(t)) return { type: 'calendar_upcoming', query: t }

  // Hebrew loose calendar — catches medical / appointment / "what's happening
  // this week" phrasings the legacy classifier covered. Routed to upcoming
  // since the date is unspecified.
  if (CALENDAR_HEBREW_LOOSE.test(t)) return { type: 'calendar_upcoming', query: t }

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

  // Relationship-between (B2.4): "מה הקשר בין רפי ללאו" /
  // "qué relación tienen Rafi y Leo" / "how is Rafi related to Leo".
  // Must run BEFORE FAMILY_PATTERNS (which catches single-subject
  // "איך X קשור" and would drop the second name) and BEFORE the loose
  // matchKnownFamilyName fallback (which would dump just one profile).
  const relBetween = detectRelationBetween(t)
  if (relBetween) {
    return {
      type: 'family_relationship_between',
      query: t,
      familyQuery: relBetween.a,
      familyQueryB: relBetween.b,
    }
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

  // Spanish/English explicit family questions: "Háblame de Leo",
  // "Cuéntame de Mor", "¿Quién es Adar?", "Tell me about Leo",
  // "Who is Mor". These extract a candidate name; if the name resolves
  // to a known family alias we route to family_lookup, otherwise we
  // FALL THROUGH so "Tell me about Italy" / "Contame sobre Argentina"
  // remain non_personal even though they share the same opener.
  const spanishFamilyMatch = t.match(SPANISH_FAMILY_Q) ?? t.match(SPANISH_WHO_IS)
  if (spanishFamilyMatch?.[1]) {
    const candidate = spanishFamilyMatch[1].trim().replace(/[?¿!.]+$/, '')
    const resolved = resolveKnownFamilyName(candidate)
    if (resolved) return { type: 'family_lookup', query: t, familyQuery: resolved }
  }
  const englishFamilyMatch = t.match(ENGLISH_FAMILY_Q) ?? t.match(ENGLISH_WHO_IS)
  if (englishFamilyMatch?.[1]) {
    const candidate = englishFamilyMatch[1].trim().replace(/[?!.]+$/, '')
    const resolved = resolveKnownFamilyName(candidate)
    if (resolved) return { type: 'family_lookup', query: t, familyQuery: resolved }
  }

  // Open-topic guard. Catches "Recomendame un podcast", "Tell me about
  // Italy", "Contame sobre Argentina" — these are general culture and
  // must NOT be routed through the loose known-family-name fallback,
  // which previously caught any sentence containing a token similar
  // to a known alias.
  if (OPEN_TOPIC.test(t)) return { type: 'non_personal', query: t }

  // Contact-action precedence (B2.3): "תתקשרי ללאו" / "llamá a Leo" /
  // "call Leo" / "mandale WhatsApp a Mor" beat the family-lookup
  // fallback. The runtime answers with an AbuWhatsApp redirect instead
  // of describing the relative.
  const contactAction = detectContactAction(t)
  if (contactAction) {
    const known = matchKnownFamilyName(t)
    const result: RouteResult = { type: 'contact_action', query: t, contactAction }
    if (known) result.familyQuery = known
    return result
  }

  // Known family name mentioned (final loose match — word boundaries only).
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

// Letter detector for word-boundary checks. Matches Hebrew + Latin letters
// (any Unicode letter) so "leo" inside "Leon" / "Tolstoy" / Hebrew text is
// rejected, but "leo" surrounded by spaces / punctuation / start / end
// matches.
const LETTER_RE = /\p{L}/u
function isWordBoundaryHit(haystack: string, needle: string): boolean {
  if (!needle) return false
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  let idx = 0
  while ((idx = h.indexOf(n, idx)) !== -1) {
    const before = idx === 0 ? '' : h[idx - 1] ?? ''
    const after = idx + n.length >= h.length ? '' : h[idx + n.length] ?? ''
    if (!LETTER_RE.test(before) && !LETTER_RE.test(after)) return true
    idx += n.length
  }
  return false
}

function matchKnownFamilyName(text: string): string | null {
  const members = loadFamilyData()
  for (const m of members) {
    if (m.hebrew && isWordBoundaryHit(text, m.hebrew)) return m.hebrew
    if (m.canonicalName && isWordBoundaryHit(text, m.canonicalName)) return m.canonicalName
    for (const alias of m.aliases) {
      if (isWordBoundaryHit(text, alias)) return alias
    }
  }
  return null
}

/**
 * Looks up an extracted name candidate (e.g. "Leo" from "Háblame de Leo")
 * against the family data. Returns the canonical alias on hit, or null.
 * Used by the Spanish/English family-question patterns so "Tell me about
 * Italy" falls through (Italy is not in family data) while "Tell me about
 * Leo" routes to family_lookup.
 */
export function resolveKnownFamilyName(candidate: string): string | null {
  const c = candidate.trim().toLowerCase()
  if (!c) return null
  const members = loadFamilyData()
  for (const m of members) {
    if (m.hebrew && c === m.hebrew.toLowerCase()) return m.hebrew
    if (m.canonicalName && c === m.canonicalName.toLowerCase()) return m.canonicalName
    for (const alias of m.aliases) {
      if (c === alias.toLowerCase()) return alias
    }
    // Tolerant: candidate may include a stray article ("el Leo") or trailing
    // copy ("Leo, mi hijo"). Try first-token equality.
    const firstToken = c.split(/[\s,]+/)[0] ?? ''
    if (firstToken && m.hebrew && firstToken === m.hebrew.toLowerCase()) return m.hebrew
    if (firstToken && m.canonicalName && firstToken === m.canonicalName.toLowerCase()) return m.canonicalName
    for (const alias of m.aliases) {
      if (firstToken && firstToken === alias.toLowerCase()) return alias
    }
  }
  return null
}
