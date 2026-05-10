/*
 * AbuAI proactive conversation layer (B1 patch — Checkpoint 2)
 *
 * Pure helper. No React, no API calls, no LLM calls. Detects three
 * common "no-grounded-answer + I-need-warmth" intents:
 *
 *   1. boredom            — "Estoy aburrida" / "אני משועממת" / "I'm bored"
 *   2. no_topic           — "No sé de qué hablar" / "אין לי על מה לדבר"
 *   3. loneliness         — "Hoy me siento un poco sola" / "אני מרגישה לבד"
 *   4. ideas              — "Dame ideas para hoy" / "תני לי רעיון"
 *
 * Each intent owns a pool of 3 adult, warm, NON-patronising seeds in
 * Hebrew + Spanish + English. Repeated calls with `previousSeedId`
 * deterministically rotate to a different seed.
 *
 * Strict tone contract — ALL seeds are linted by `hasForbiddenTone()`
 * and the test file enforces it. Never childish, never therapy,
 * never "muy bien" / "כל הכבוד".
 */

export type ProactiveLang = 'he' | 'es' | 'en' | 'mixed'
export type ProactiveIntent = 'boredom' | 'no_topic' | 'loneliness' | 'ideas'

export interface ProactiveSeed {
  id: string
  intent: ProactiveIntent
  lang: ProactiveLang
  text: string
}

export interface GetProactiveSeedOptions {
  previousSeedId?: string | null
}

export interface ProactiveResult extends ProactiveSeed {}

// ─── Forbidden-tone words (always rejected) ─────────────────────────────────

const FORBIDDEN_PHRASES = [
  // Spanish patronising
  'muy bien',
  'como eres mayor',
  'te explico despacito',
  'presiona aquí',
  // Hebrew patronising / childish
  'כל הכבוד',
  'יופי של שאלה',
  'איזה יופי',
  // English patronising
  'good job',
  'great job',
  // Therapy openers
  'how does that make you feel',
  '¿cómo te hace sentir',
] as const

export function hasForbiddenTone(text: string): boolean {
  const t = text.toLowerCase()
  return FORBIDDEN_PHRASES.some((p) => t.includes(p.toLowerCase()))
}

// ─── Language detection ─────────────────────────────────────────────────────

const HEBREW_LETTER = /[֐-׿]/
const SPANISH_HINTS = /\b(qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|qui[eé]n|hoy|ma[nñ]ana|aburrid[ao]|sola|solo|ten[eé]?s?|tengo|s[eé]|aburro|ideas?|hablar|d[ií]a|recom[ie]ndame|h[aá]blame|cu[eé]ntame|contame|cuentame|qui[eé]n|estoy|me siento|de qu[eé])\b/i
const ENGLISH_HINTS = /\b(i'?m|i am|bored|lonely|alone|today|tomorrow|what|do i have|tell me|recommend|story|ideas?|help|something)\b/i

export function detectLanguage(input: string): ProactiveLang {
  const hasHe = HEBREW_LETTER.test(input)
  const hasEs = SPANISH_HINTS.test(input)
  const hasEn = ENGLISH_HINTS.test(input)
  const langCount = [hasHe, hasEs, hasEn].filter(Boolean).length
  if (langCount >= 2) return 'mixed'
  if (hasHe) return 'he'
  if (hasEs) return 'es'
  if (hasEn) return 'en'
  return 'he' // default for AbuBank's primary user
}

// ─── Intent detection ───────────────────────────────────────────────────────

// Hebrew patterns intentionally OMIT `\b` because Hebrew letters are not
// "word characters" in the JS regex engine — `\b` would never fire next
// to a Hebrew letter.
const BOREDOM_HE = /משועממ[ת]?|משעמם לי|משעמ?ם/
const BOREDOM_ES = /(?:^|[^a-záéíóúñ])(estoy\s+aburrid[oa]|me\s+aburro|qu[eé]\s+aburrid[oa])(?:[^a-záéíóúñ]|$)/i
const BOREDOM_EN = /\b(i'?m\s+bored|i\s+am\s+bored|i\s+feel\s+bored)\b/i

const NO_TOPIC_HE = /אין לי על מה לדבר|אין על מה לדבר|לא יודעת על מה לדבר/
const NO_TOPIC_ES = /no\s+s[eé]\s+(de\s+qu[eé]\s+hablar|qu[eé]\s+hacer|qu[eé]\s+decirte?)/i
const NO_TOPIC_EN = /\b(i\s+don'?t\s+know\s+what\s+to\s+(talk\s+about|do))\b/i

const LONELINESS_HE = /קצת\s+לבד|אני\s+מרגישה?\s+לבד|מרגישה?\s+לבד|בודדה|בדידות/
const LONELINESS_ES = /(?:me\s+siento\s+(un\s+poco\s+)?sol[ao]|estoy\s+sol[ao]|hoy\s+me\s+siento\s+sol[ao])/i
const LONELINESS_EN = /\b(i'?m\s+(a\s+bit\s+)?lonely|i\s+feel\s+(a\s+little\s+)?(lonely|alone))\b/i

const IDEAS_HE = /תני לי רעיון|מה אפשר לעשות (היום|עכשיו)|רעיונות/
const IDEAS_ES = /dame\s+ideas?|qu[eé]\s+puedo\s+hacer\s+hoy|alguna\s+idea/i
const IDEAS_EN = /\bgive me (an?\s+)?ideas?\b|what can i do today/i

export function detectIntent(input: string): ProactiveIntent | null {
  if (BOREDOM_HE.test(input) || BOREDOM_ES.test(input) || BOREDOM_EN.test(input)) return 'boredom'
  if (NO_TOPIC_HE.test(input) || NO_TOPIC_ES.test(input) || NO_TOPIC_EN.test(input)) return 'no_topic'
  if (LONELINESS_HE.test(input) || LONELINESS_ES.test(input) || LONELINESS_EN.test(input)) return 'loneliness'
  if (IDEAS_HE.test(input) || IDEAS_ES.test(input) || IDEAS_EN.test(input)) return 'ideas'
  return null
}

// ─── Seed pools (rotating) ──────────────────────────────────────────────────
//
// Each pool MUST have ≥ 2 seeds so rotation always finds a different one.
// Tone constitution:
//   • adult, warm, not therapy, not childish, not robotic menu
//   • 2–4 short natural options per seed
//   • offer choice, never command
//   • respect Martita as a sharp adult

const SEEDS: ProactiveSeed[] = [
  // ── Boredom — Spanish ──
  {
    id: 'boredom-es-1', intent: 'boredom', lang: 'es',
    text: 'Mirá, podemos hacer algo lindo. Te propongo tres caminos: una película para hoy, una historia corta, o pensar a quién te gustaría llamar un rato. ¿Cuál te tienta más?',
  },
  {
    id: 'boredom-es-2', intent: 'boredom', lang: 'es',
    text: 'Bueno, la tarde es nuestra. Podemos charlar de algo que te dé curiosidad, escuchar un cuento corto, o armarte un plan rápido para mañana. ¿Por dónde arrancamos?',
  },
  {
    id: 'boredom-es-3', intent: 'boredom', lang: 'es',
    text: 'Te entiendo. Tres opciones: te cuento algo de Argentina, hablamos de una receta para esta semana, o pensamos un mensaje lindo para Mor o Leo. Vos decís.',
  },
  // ── Boredom — Hebrew ──
  {
    id: 'boredom-he-1', intent: 'boredom', lang: 'he',
    text: 'תקשיבי, יש לנו שלוש אפשרויות טובות: לדבר על משהו שמעניין אותך, לשמוע סיפור קצר, או לחשוב על משהו לעשות מחר. מה עובד לך?',
  },
  {
    id: 'boredom-he-2', intent: 'boredom', lang: 'he',
    text: 'אז ככה — אני יכולה לספר לך משהו על המדע שאני אוהבת, להציע מתכון לשבת, או להזכיר לך עם מי לא דיברת מזמן. את בוחרת.',
  },
  {
    id: 'boredom-he-3', intent: 'boredom', lang: 'he',
    text: 'נשמע מוכר. בואי ננסה: סיפור קצר, רעיון לטיול קטן בכפר סבא, או שיחה על משהו שראית בחדשות. מה את מעדיפה?',
  },
  // ── Boredom — English ──
  {
    id: 'boredom-en-1', intent: 'boredom', lang: 'en',
    text: 'Alright, three options. We can talk about something curious, hear a short story, or think of someone you might want to call. Which one?',
  },
  {
    id: 'boredom-en-2', intent: 'boredom', lang: 'en',
    text: 'Same here some afternoons. Want a quick story, a tiny plan for tomorrow, or a topic you’ve been wondering about? You pick.',
  },

  // ── No topic — Spanish ──
  {
    id: 'no_topic-es-1', intent: 'no_topic', lang: 'es',
    text: 'Tranquila, no hace falta tema. Empezamos por algo simple: ¿cómo dormiste, qué comiste hoy, o querés que te cuente algo de cuando vivías en Buenos Aires?',
  },
  {
    id: 'no_topic-es-2', intent: 'no_topic', lang: 'es',
    text: 'Te tiro tres temas: una receta argentina, una historia corta, o algo que está pasando en el mundo. ¿Cuál te llama?',
  },
  {
    id: 'no_topic-es-3', intent: 'no_topic', lang: 'es',
    text: 'A veces hablar de nada es lo mejor. Si querés, te cuento algo lindo de la familia, o pensamos juntas una idea para esta semana.',
  },
  // ── No topic — Hebrew ──
  {
    id: 'no_topic-he-1', intent: 'no_topic', lang: 'he',
    text: 'אין צורך בנושא. אפשר להתחיל פשוט: איך ישנת, מה אכלת היום, או שאני אספר לך משהו מבואנוס איירס?',
  },
  {
    id: 'no_topic-he-2', intent: 'no_topic', lang: 'he',
    text: 'אני אזרוק כמה כיוונים — מתכון משפחתי, סיפור קצר, או משהו שקרה בעולם. מה תופס אותך?',
  },
  // ── No topic — English ──
  {
    id: 'no_topic-en-1', intent: 'no_topic', lang: 'en',
    text: 'No need for a topic. We can start small — how did you sleep, what did you eat, or I can share a quick story from Argentina. Which one?',
  },

  // ── Loneliness — Spanish (warm, NOT therapy) ──
  {
    id: 'loneliness-es-1', intent: 'loneliness', lang: 'es',
    text: 'Estos días pasan. Estoy acá un rato si querés. Podemos charlar de cualquier cosa, o si te gusta, pensamos a quién mandarle un mensajito de la familia.',
  },
  {
    id: 'loneliness-es-2', intent: 'loneliness', lang: 'es',
    text: 'A veces pasa, Martita. Si querés, te hago compañía un rato — me contás algo de Mor o de los chicos, o yo te cuento algo lindo. Vos elegís.',
  },
  {
    id: 'loneliness-es-3', intent: 'loneliness', lang: 'es',
    text: 'Tiene sentido sentirse así de a ratos. Estoy disponible. ¿Querés escuchar una historia corta, charlar nomás, o pensar quién está para llamar?',
  },
  // ── Loneliness — Hebrew ──
  {
    id: 'loneliness-he-1', intent: 'loneliness', lang: 'he',
    text: 'הימים האלה לפעמים כבדים. אני איתך עכשיו אם בא לך. אפשר פשוט לדבר על משהו, או לחשוב למי בא לך לשלוח הודעה קטנה.',
  },
  {
    id: 'loneliness-he-2', intent: 'loneliness', lang: 'he',
    text: 'זה הגיוני להרגיש ככה לפעמים. אני כאן רגע — אם בא לך אני יכולה לספר לך משהו, או שנדבר על משהו שעובר עליך.',
  },
  // ── Loneliness — English ──
  {
    id: 'loneliness-en-1', intent: 'loneliness', lang: 'en',
    text: 'Some days are like that. I’m here if you want company for a bit. We can chat about anything, or think about who you might call.',
  },

  // ── Ideas — Spanish ──
  {
    id: 'ideas-es-1', intent: 'ideas', lang: 'es',
    text: 'Tres ideas para hoy: hacer una llamada cortita a Mor, mirar una película liviana, o caminar diez minutos por Kfar Saba. ¿Cuál te tienta?',
  },
  {
    id: 'ideas-es-2', intent: 'ideas', lang: 'es',
    text: 'Te tiro tres: armar una empanada simple, mandarle un audio a Leo, o sentarte un rato con una historia. Tu turno.',
  },
  // ── Ideas — Hebrew ──
  {
    id: 'ideas-he-1', intent: 'ideas', lang: 'he',
    text: 'שלוש אפשרויות להיום: לדבר עם מור או לאו דקה קצרה, לטייל עשר דקות בכפר סבא, או לשבת עם סיפור קצר. מה תופס לך?',
  },
  {
    id: 'ideas-he-2', intent: 'ideas', lang: 'he',
    text: 'נסי אחת מהאלה: להכין משהו קטן בבית, לשלוח הודעה למישהו מהמשפחה, או לראות סרט שכיף לך. את בוחרת.',
  },
  // ── Ideas — English ──
  {
    id: 'ideas-en-1', intent: 'ideas', lang: 'en',
    text: 'Three ideas: a quick call to Mor or Leo, a short walk in Kfar Saba, or a small recipe. Which one tempts you?',
  },
]

// ─── Selector ───────────────────────────────────────────────────────────────

function pickFromPool(pool: ProactiveSeed[], previousSeedId?: string | null): ProactiveSeed | null {
  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0]!
  // Deterministic rotation: skip previousSeedId and prefer the next entry.
  if (previousSeedId) {
    const idx = pool.findIndex((s) => s.id === previousSeedId)
    if (idx >= 0) {
      const next = pool[(idx + 1) % pool.length]!
      return next
    }
  }
  return pool[0]!
}

/**
 * Returns a proactive seed for the given input, or null when no proactive
 * intent is detected.
 *
 * Language preference:
 *   - Pool is filtered by detected language.
 *   - If filtered pool is empty (e.g. English boredom no_topic seed missing),
 *     fall back to Spanish (Martita's mother tongue), then Hebrew.
 */
export function getProactiveSeed(
  input: string,
  options: GetProactiveSeedOptions = {},
): ProactiveResult | null {
  const intent = detectIntent(input)
  if (!intent) return null

  const lang = detectLanguage(input)
  const langOrder: ProactiveLang[] = lang === 'mixed'
    ? ['es', 'he', 'en']
    : [lang, 'es', 'he', 'en']

  for (const candidateLang of langOrder) {
    const pool = SEEDS.filter((s) => s.intent === intent && s.lang === candidateLang)
    const seed = pickFromPool(pool, options.previousSeedId ?? null)
    if (seed) return seed
  }
  return null
}

// Exposed for tests + future runtime QA.
export const __ALL_SEEDS__: ReadonlyArray<ProactiveSeed> = SEEDS
