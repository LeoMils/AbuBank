/*
 * AbuAI online-intent detector (B2 — pure helper)
 *
 * Decides whether a user query needs LIVE / CURRENT information that
 * the offline LLM cannot produce honestly: cinema listings, weather,
 * news, "this week", "open now", "latest". When this returns true and
 * the query is NOT personal (calendar / family / contacts), AbuAI's
 * runtime calls the online provider.
 *
 * Hard rule: this module NEVER routes calendar / family / personal
 * queries to the web — those go through `tryGroundedAnswer` (local
 * tools). `shouldBlockOnlineForPersonal()` is the second guard.
 *
 * Pure module: no React, no fetch, no LLM, no API.
 */

export type OnlineQueryKind =
  | 'movies'
  | 'weather'
  | 'news'
  | 'open_now'
  | 'latest'
  | 'sports'
  | 'general_current'
  | 'holidays'

// ─── Hebrew patterns ────────────────────────────────────────────────────────
//
// Hebrew cannot use `\b` (Hebrew letters are not "word characters" in JS
// regex) — these patterns rely on substring matching with explicit
// disambiguating phrasing.
const ONLINE_HE_MOVIES = /איזה סרטים יש (עכשיו|היום|השבוע)|סרטים חדשים|סרטים בקולנוע|בקולנוע (עכשיו|היום)|מה מקרינים/
const ONLINE_HE_WEATHER = /מזג ה?אוויר(?:\s+(?:עכשיו|היום|מחר|השבוע))?|מה מזג האוויר|איך מזג האוויר|חם בחוץ|קר בחוץ|טמפרטורה|תחזית|גשם\s+(?:היום|מחר)|שקיעה|זריחה|כמה מעלות/
const ONLINE_HE_NEWS = /חדשות (היום|עכשיו|אחרונות)|מה ב?חדשות|מה קורה בעולם/
const ONLINE_HE_OPEN_NOW = /מה פתוח עכשיו|פתוח עכשיו|מה פתוח (היום|בשעה)/
const ONLINE_HE_LATEST = /מה ה?חדש|מה האחרון|מה התחזית/
const ONLINE_HE_SPORTS = /כדורגל|כדורסל|מכבי|הפועל|תוצאות|מי ניצח|משחק(?:ים)?\s+(?:אתמול|היום|מחר|הערב|של)|איזה משחקים|מונדיאל|אליפות|ליגה|גביע|נבחרת/
const ONLINE_HE_CURRENT = /שער ה?דולר|שער ה?יורו|מטבע|בורסה|מניות|bitcoin|ביטקוין|מחיר ה?(זהב|נפט|גז)|מה (ה?מחיר|העלות) של/
const ONLINE_HE_HOLIDAYS = /מתי\s+(חג\s+)?(פסח|סוכות|ראש השנה|יום כיפור|חנוכה|פורים|שבועות|ט[וּ]?\s*בשבט|ל[״"]ג\s*בעומר|יום העצמאות|יום הזיכרון|יום השואה)/i

// ─── Spanish patterns ──────────────────────────────────────────────────────
const ONLINE_ES_MOVIES = /(?:^|[^a-záéíóúñ])(?:qu[eé]\s+)?pel[ií]culas?\s+(?:hay|nuevas|de\s+ahora|de\s+esta\s+semana|en\s+(?:el\s+)?cine|nuevas)|cartelera|cine\s+(?:cerca|hoy|ahora)|qu[eé]\s+(?:hay\s+)?en\s+(?:el\s+)?cine/i
const ONLINE_ES_WEATHER = /(?:^|[^a-záéíóúñ])(?:c[oó]mo\s+est[aá]\s+el\s+)?(?:clima|tiempo)\s+(?:hoy|ahora|de\s+hoy|esta\s+semana|ma[nñ]ana)|qu[eé]\s+tiempo\s+hace/i
const ONLINE_ES_NEWS = /noticias\s+(?:de\s+)?(?:hoy|ahora|[uú]ltimas|recientes)|[uú]ltimas\s+noticias|qu[eé]\s+est[aá]\s+pasando(?:\s+(?:hoy|ahora|en\s+el\s+mundo))?/i
const ONLINE_ES_OPEN_NOW = /qu[eé]\s+est[aá]\s+abierto\s+(?:ahora|hoy)|abierto\s+ahora/i
const ONLINE_ES_LATEST = /(?:^|[^a-záéíóúñ])(?:[uú]ltima|reciente)s?\s+(?:novedades?|tendencias?)|(?:^|[^a-záéíóúñ])esta\s+semana(?:\s+(?:hay|sale|estrena))/i
const ONLINE_ES_SPORTS = /f[uú]tbol|partido|qui[eé]n gan[oó]|resultado/i

// ─── English patterns ──────────────────────────────────────────────────────
const ONLINE_EN_MOVIES = /\b(?:what\s+)?movies?\s+(?:are\s+)?(?:playing|now|new|this\s+week|in\s+(?:the\s+)?cinema)\b|\bcinema\s+(?:near|now|today)\b|\bnow\s+playing\b/i
const ONLINE_EN_WEATHER = /\b(?:what'?s|how'?s)\s+the\s+weather\b|\bweather\s+(?:now|today|this\s+week|tomorrow)\b/i
const ONLINE_EN_NEWS = /\b(?:latest\s+news|news\s+(?:today|now))\b|\bwhat'?s\s+happening\s+(?:now|today|in\s+the\s+world)\b/i
const ONLINE_EN_OPEN_NOW = /\bwhat'?s\s+open\s+(?:now|today)\b|\bopen\s+(?:right\s+)?now\b/i
const ONLINE_EN_LATEST = /\blatest\s+(?:trends?|updates?)\b|\bthis\s+week\s+(?:has|is|sees)\b/i
const ONLINE_EN_SPORTS = /\b(?:soccer|football|basketball|who\s+won|game\s+(?:yesterday|today|tomorrow)|league|cup|score)\b/i

// ─── Personal-block patterns ───────────────────────────────────────────────
//
// If the query smells personal/calendar/family, online lookup MUST NOT
// fire — the grounded path or the family scaffold is the right answer.
// This is the second guard (the runtime should also call
// `tryGroundedAnswer` first; if that returned a string the online path
// is already short-circuited).
const PERSONAL_HE = /מה יש לי|תור שלי|שלי ביומן|בן\s*משפחה|הנכד שלי|הנכדה שלי|הבן שלי|הבת שלי|מתי הרופא הבא שלי|פפי|לאו|מור|אופיר|איילון|עילי|אדר|עדי|נועם|רפי|ירדן|גלעד|יעל/
const PERSONAL_ES = /qu[eé]\s+tengo\s+hoy|qu[eé]\s+tengo\s+ma[nñ]ana|h[aá]blame\s+de|cu[eé]ntame\s+de|qui[eé]n\s+es|mi\s+(?:nieto|nieta|hijo|hija)|mi\s+familia|mi\s+m[eé]dico/i
const PERSONAL_EN = /\bwhat\s+do\s+i\s+have\b|\btell\s+me\s+about\s+(?!italy|argentina|spain|france|germany|japan)|\bwho\s+is\s+(?!the\s+president|the\s+prime\s+minister)|\bmy\s+(?:grandson|granddaughter|son|daughter|family|doctor|appointment)\b/i

/** Returns true if the query asks for current/live information. */
export function isOnlineCurrentInfoQuery(input: string): boolean {
  return getOnlineQueryKind(input) !== null
}

/** Returns the online-query kind, or null when not a current-info query. */
export function getOnlineQueryKind(input: string): OnlineQueryKind | null {
  const t = input.trim()
  if (!t) return null

  if (ONLINE_HE_MOVIES.test(t) || ONLINE_ES_MOVIES.test(t) || ONLINE_EN_MOVIES.test(t)) return 'movies'
  if (ONLINE_HE_WEATHER.test(t) || ONLINE_ES_WEATHER.test(t) || ONLINE_EN_WEATHER.test(t)) return 'weather'
  if (ONLINE_HE_NEWS.test(t) || ONLINE_ES_NEWS.test(t) || ONLINE_EN_NEWS.test(t)) return 'news'
  if (ONLINE_HE_OPEN_NOW.test(t) || ONLINE_ES_OPEN_NOW.test(t) || ONLINE_EN_OPEN_NOW.test(t)) return 'open_now'
  if (ONLINE_HE_LATEST.test(t) || ONLINE_ES_LATEST.test(t) || ONLINE_EN_LATEST.test(t)) return 'latest'
  if (ONLINE_HE_SPORTS.test(t) || ONLINE_ES_SPORTS.test(t) || ONLINE_EN_SPORTS.test(t)) return 'sports'
  if (ONLINE_HE_CURRENT.test(t)) return 'general_current'
  if (ONLINE_HE_HOLIDAYS.test(t)) return 'holidays'
  return null
}

/**
 * Second guard: even if the online-intent regex matched, refuse to send
 * the query to web search if it ALSO smells personal/calendar/family.
 * The runtime tries `tryGroundedAnswer` first, but this is belt-and-suspenders.
 */
export function shouldBlockOnlineForPersonal(input: string): boolean {
  const t = input.trim()
  if (!t) return false
  return PERSONAL_HE.test(t) || PERSONAL_ES.test(t) || PERSONAL_EN.test(t)
}
