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
const ONLINE_HE_WEATHER = /מזג ה?אוויר(?:\s+(?:עכשיו|היום|מחר|השבוע))?|מה מזג האוויר|איך מזג האוויר|חם בחוץ|קר בחוץ|טמפרטורה|תחזית|גשם\s+(?:היום|מחר)|שקיעה|זריחה|שוקעת\s+השמש|זורחת\s+השמש|מתי\s+השמש|כמה מעלות/
const ONLINE_HE_NEWS = /חדשות\s+(היום|עכשיו|אחרונות)|מה\s+ב?חדשות|מה\s+קורה\s+ב?חדשות|מה\s+קורה\s+בעולם|חדשות\s+אחרונות|איזה\s+חדשות|מה\s+ה?חדשות/
const ONLINE_HE_OPEN_NOW = /מה פתוח עכשיו|פתוח עכשיו|מה פתוח (היום|בשעה)/
const ONLINE_HE_LATEST = /מה ה?חדש|מה האחרון|מה התחזית/
const ONLINE_HE_SPORTS = /כדורגל|כדורסל|מכבי|הפועל|תוצא(?:ה|ות)|מי ניצח|מי ניצחה|מי שיחק|מי משחק|מי שיחקה|כמה\s+יצא|מה\s+התוצאה|משחק(?:ים|י)?\s+(?:אתמול|היום|מחר|הערב|של|ה?יום)|איזה משחקים|מונדיאל|אליפות|ליגה|גביע|נבחרת|של\s+המשחק|מה\s+היה\s+במשחק|תוצאת\s+המשחק|מלך\s+ה?שערים|מלכת\s+ה?שערים|מי\s+ה?בקיע|ה?כובש\s+ה?מוביל/
const ONLINE_HE_CURRENT = /שער ה?דולר|שער ה?יורו|מטבע|בורסה|מניות|bitcoin|ביטקוין|מחיר ה?(זהב|נפט|גז|בנזין|דלק)|מה (ה?מחיר|העלות) של|כמה\s+עולה|כמה\s+שווה/
// Live public-transport / flight times — live info the runtime already routes online
// via ONLINE_EXTRA_RE; keep the tool gate in sync so it isn't a permanent dead-end.
const ONLINE_HE_TRANSPORT = /מתי\s+ה?אוטובוס|ה?אוטובוס\s+ה?בא|מתי\s+ה?רכבת|ה?רכבת\s+ה?באה|מתי\s+ה?טיסה|תחבורה\s+ציבורית/
const ONLINE_HE_HOLIDAYS = /מתי\s+(חג\s+)?(פסח|סוכות|ראש השנה|יום כיפור|חנוכה|פורים|שבועות|ט[וּ]?\s*בשבט|ל[״"]ג\s*בעומר|יום העצמאות|יום הזיכרון|יום השואה)/i

// ─── Current-world-fact forms (volatile answers) ─────────────────────────────
//
// Questions whose CORRECT answer CHANGES over time — current office holders,
// election outcomes, championship winners. The offline model answers these from
// stale memory (the canonical "2022 World Cup for a 2026 question" incident).
// Detected SEMANTICALLY (question FORM), not by a per-entity list, so the whole
// CLASS routes to live retrieval — or, on provider failure, to an honest "I can't
// check that right now" — and is NEVER answered from memory. Present-tense forms
// only: historical "מי היה" / "who was" must stay evergreen (offline-answerable).
// NB: no `\b` after Hebrew/accented letters — JS `\b` is ASCII-only and never
// matches a boundary next to non-word chars (א-ת, é, ó), so it would silently
// defeat the match (the module rule at the top of this file).
const CURRENT_FACT_HE = /מי\s+ה?(?:נשיא|נשיאה|ראש\s+ה?ממשלה|רה"?מ|מנהיג|קנצלר|אלופ[הת]?|מנצח[ת]?)|מי\s+ניצח|מי\s+ניצחה|מי\s+זכת?[ה]?\s+ב|מי\s+נבחר|תוצאות\s+ה?בחירות|מי\s+ראש\s+ה?עיר/u
const CURRENT_FACT_ES = /qui[eé]n\s+es\s+(?:el|la)\s+(?:presidente|presidenta|primer\s+ministro|campe[oó]n|campeona)|qui[eé]n\s+gan[oó]/i
const CURRENT_FACT_EN = /\bwho\s+is\s+(?:the\s+)?(?:president|prime\s+minister|current\s+\w+|champion)\b|\bwho\s+won\b|\bwho'?s\s+the\s+(?:president|champion)\b/i

/**
 * True when the query asks for a WORLD FACT whose correct answer changes over
 * time (office holders / election results / winners). These must reach the online
 * provider (or an honest refusal), never the offline general/LLM path — that is
 * the root cause of the stale-answer failure. Pure; no fetch/LLM.
 */
export function requiresCurrentInfo(input: string): boolean {
  const t = input.trim()
  if (!t) return false
  return CURRENT_FACT_HE.test(t) || CURRENT_FACT_ES.test(t) || CURRENT_FACT_EN.test(t)
}

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
  if (ONLINE_HE_TRANSPORT.test(t)) return 'general_current' // transport = live info
  if (ONLINE_HE_HOLIDAYS.test(t)) return 'holidays'
  // Volatile world facts (office holders / elections / winners) the narrow
  // category regexes miss — route online instead of answering from stale memory.
  if (requiresCurrentInfo(t)) return 'general_current'
  return null
}

/**
 * Second guard: even if the online-intent regex matched, refuse to send
 * the query to web search if it ALSO smells personal/calendar/family.
 * The runtime tries `tryGroundedAnswer` first, but this is belt-and-suspenders.
 */
// Strong sports/match context: when present, a personal-name match is almost
// always a country/team that happens to share a name (ירדן = Jordan, not Yarden;
// "נגד"/"בין X ל" framing) — so the personal block must NOT fire.
const SPORTS_CONTEXT = /מי\s+ניצח|מי\s+ניצחה|כמה\s+יצא|תוצא(?:ה|ות)|מונדיאל|אליפות\s+העולם|כדורגל|כדורסל|ליגה|גביע|נבחרת|משחק(?:ים)?\b|נגד\b|בין\s+\S+\s+ל\S/u

export function shouldBlockOnlineForPersonal(input: string): boolean {
  const t = input.trim()
  if (!t) return false
  if (SPORTS_CONTEXT.test(t)) return false
  // A current-world-fact question (office holder / election / winner) is never
  // "personal" — don't let an over-broad personal pattern (e.g. ES "quién es")
  // block it from the live provider and push it back to stale memory.
  if (requiresCurrentInfo(t)) return false
  return PERSONAL_HE.test(t) || PERSONAL_ES.test(t) || PERSONAL_EN.test(t)
}
