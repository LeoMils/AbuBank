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
export type ProactiveIntent = 'boredom' | 'no_topic' | 'loneliness' | 'ideas' | 'sadness' | 'talk_to_me' | 'missing_pepe' | 'thanks' | 'happiness' | 'greeting'

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
  // Customer-service closings
  'אני כאן אם תצטרכי',
  'אם יש לך שאלות',
  'אשמח לעזור',
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
  // Spanish-specific glyphs (á é í ó ú ü ñ ¿ ¡) are unambiguous and — unlike the
  // \b-anchored SPANISH_HINTS — match accented words ("qué", "sé", "día") that the
  // word-boundary regex misses (é/ñ aren't JS word chars). Plus common plain
  // Spanish words that carry no accent ("gracias", "hola", "dale", "hacer").
  const hasEs = SPANISH_HINTS.test(input)
    || /[áéíóúüñ¿¡]/.test(input)
    || /\b(gracias|hola|dale|hacer|nada|bien|che|buen[oa]s?|extra[ñn]o|charl[ae]mos?|charlar|segu[ií])\b/i.test(input)
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
const LONELINESS_ES = /(?:me\s+siento\s+(?:un\s+poco\s+|muy\s+|tan\s+|bastante\s+)?sol[ao]|estoy\s+(?:muy\s+|tan\s+)?sol[ao]|hoy\s+me\s+siento\s+sol[ao])/i
const LONELINESS_EN = /\b(i'?m\s+(a\s+bit\s+)?lonely|i\s+feel\s+(a\s+little\s+)?(lonely|alone))\b/i

const IDEAS_HE = /תני לי רעיון|מה אפשר לעשות (היום|עכשיו)|רעיונות/
const IDEAS_ES = /dame\s+(una\s+|alguna\s+)?ideas?|qu[eé]\s+puedo\s+hacer\s+hoy|alguna\s+idea/i
const IDEAS_EN = /\bgive me (an?\s+)?ideas?\b|what can i do today/i

// Sadness / low energy — distinct from loneliness (lonely = alone, sad = feeling bad)
const SADNESS_HE = /עצובה|עצוב|אין לי כוח|לא בכיף|לא טוב לי|קשה לי היום|יום קשה/
const SADNESS_ES = /estoy\s+triste|me\s+siento\s+mal|no\s+tengo\s+ganas|d[ií]a\s+dif[ií]cil/i
const SADNESS_EN = /\b(i'?m\s+sad|feeling\s+(down|bad)|tough\s+day|no\s+energy)\b/i

// "Talk to me" — needs company, not a specific intent
const TALK_HE = /תדברי איתי|דברי איתי|תספרי לי משהו|ספרי לי משהו|בואי נדבר|בוא נדבר|תשארי איתי|תהיי איתי|הישארי איתי|אל תלכי|אל תעזבי/
const TALK_ES = /habl[aá]me|cont[aá]me\s+algo|cont[aá]me|charlemos|dale.+cont[aá]me|qued[aá]te\s+conmigo|no\s+te\s+vayas/i
const TALK_EN = /\btalk\s+to\s+me\b|\btell\s+me\s+something\b/i

// Happiness — positive emotional state
const HAPPINESS_HE = /אני שמחה|שמח[ה]? היום|יום טוב|מצב רוח טוב|כיף לי/
const HAPPINESS_ES = /estoy\s+content[ao]|qu[eé]\s+lindo\s+d[ií]a|me\s+siento\s+bien/i
const HAPPINESS_EN = /\b(i'?m\s+happy|feeling\s+great|great\s+day|good\s+mood)\b/i

// Thanks — simple acknowledgment, no LLM needed
const THANKS_HE = /^תודה[!.\s]*$|^תודה רבה[!.\s]*$/
const THANKS_ES = /^gracias[!.\s]*$/i
const THANKS_EN = /^thanks?(?:\s+you)?[!.\s]*$|^thank\s+you[!.\s]*$/i

// Missing Pepe — deeply emotional, requires gentle specific response
const MISSING_PEPE = /מתגעגע[ת]?\s+(ל|אל\s+)?(פפ[יה]|פאפי)|געגועים\s+(ל|אל\s+)?(פפ[יה]|פאפי)|חסר\s+לי\s+(פפ[יה]|פאפי)|extra[nñ]o\b.{0,15}?pep[eé]/i

// Greeting — warm instant response, no menu
const GREETING_HE = /^(שלום|היי|בוקר טוב|ערב טוב|מה נשמע|מה קורה|מה שלומך|אהלן)[.!?\s]*$/i
const GREETING_ES = /^(hola|buen[ao]s?\s+(d[ií]as?|tardes?|noches?)|qu[eé]\s+tal|c[oó]mo\s+and[aá]s)[.!?\s]*$/i
const GREETING_EN = /^(hi|hey|hello|good\s+(morning|evening|afternoon)|how\s+are\s+you|what'?s?\s+up)[.!?\s]*$/i

export function detectIntent(input: string): ProactiveIntent | null {
  // Missing Pepe — most specific, check first
  if (MISSING_PEPE.test(input)) return 'missing_pepe'
  if (BOREDOM_HE.test(input) || BOREDOM_ES.test(input) || BOREDOM_EN.test(input)) return 'boredom'
  if (NO_TOPIC_HE.test(input) || NO_TOPIC_ES.test(input) || NO_TOPIC_EN.test(input)) return 'no_topic'
  if (LONELINESS_HE.test(input) || LONELINESS_ES.test(input) || LONELINESS_EN.test(input)) return 'loneliness'
  if (SADNESS_HE.test(input) || SADNESS_ES.test(input) || SADNESS_EN.test(input)) return 'sadness'
  if (TALK_HE.test(input) || TALK_ES.test(input) || TALK_EN.test(input)) return 'talk_to_me'
  if (HAPPINESS_HE.test(input) || HAPPINESS_ES.test(input) || HAPPINESS_EN.test(input)) return 'happiness'
  if (THANKS_HE.test(input) || THANKS_ES.test(input) || THANKS_EN.test(input)) return 'thanks'
  if (IDEAS_HE.test(input) || IDEAS_ES.test(input) || IDEAS_EN.test(input)) return 'ideas'
  if (GREETING_HE.test(input) || GREETING_ES.test(input) || GREETING_EN.test(input)) return 'greeting'
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
    text: '¿Sabías que hay un tiburón que vive 400 años? Increíble, ¿no?',
  },
  {
    id: 'boredom-es-2', intent: 'boredom', lang: 'es',
    text: '¿Cuándo fue la última vez que hablaste con Mor? Capaz le viene bien una llamada.',
  },
  {
    id: 'boredom-es-3', intent: 'boredom', lang: 'es',
    text: 'Te cuento algo lindo — en Japón hay una isla llena de gatos. Viven mejor que nosotros.',
  },
  // ── Boredom — Hebrew ──
  {
    id: 'boredom-he-1', intent: 'boredom', lang: 'he',
    text: 'ידעת שדבורים מזהות פנים של בני אדם? מטורף, לא?',
  },
  {
    id: 'boredom-he-2', intent: 'boredom', lang: 'he',
    text: 'מתי בפעם האחרונה דיברת עם מור? אולי תתקשרי.',
  },
  {
    id: 'boredom-he-3', intent: 'boredom', lang: 'he',
    text: 'בואי אספר לך משהו — פעם באוסטרליה מצאו כריש שחי 400 שנה.',
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
    text: 'Estoy acá. ¿Charlamos un rato?',
  },
  {
    id: 'loneliness-es-2', intent: 'loneliness', lang: 'es',
    text: 'Pasa, sí. ¿Querés que hablemos de algo?',
  },
  // ── Loneliness — Hebrew ──
  {
    id: 'loneliness-he-1', intent: 'loneliness', lang: 'he',
    text: 'אני פה. מה בא לך — לדבר, או שאספר לך משהו?',
  },
  {
    id: 'loneliness-he-2', intent: 'loneliness', lang: 'he',
    text: 'יש ימים כאלה. בואי נדבר על משהו.',
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
    text: 'מה דעתך על שיחה קצרה עם מור או לאו? או לצאת לטיול קטן בכפר סבא. גם סרט טוב יכול להיות נחמד.',
  },
  {
    id: 'ideas-he-2', intent: 'ideas', lang: 'he',
    text: 'אפשר להכין משהו טעים, לשלוח הודעה למישהו מהמשפחה, או פשוט לשבת עם סיפור. מה מתחשק?',
  },
  // ── Ideas — English ──
  {
    id: 'ideas-en-1', intent: 'ideas', lang: 'en',
    text: 'How about a quick call to Mor or Leo, a short walk, or trying a simple recipe? Whatever feels right.',
  },

  // ── Sadness — Hebrew ──
  {
    id: 'sadness-he-1', intent: 'sadness', lang: 'he',
    text: 'כן, זה קשה. את רוצה לדבר על זה?',
  },
  {
    id: 'sadness-he-2', intent: 'sadness', lang: 'he',
    text: 'אני שומעת. ספרי לי מה עובר עליך.',
  },
  // ── Sadness — Spanish ──
  {
    id: 'sadness-es-1', intent: 'sadness', lang: 'es',
    text: 'Sí, es difícil. ¿Querés contarme?',
  },
  {
    id: 'sadness-es-2', intent: 'sadness', lang: 'es',
    text: 'Te escucho. Contame qué te pasa.',
  },

  // ── Talk to me — Hebrew ──
  {
    id: 'talk-he-1', intent: 'talk_to_me', lang: 'he',
    text: 'אני כאן. ספרי לי מה היה לך היום, או שאני אספר לך משהו — מה שנוח.',
  },
  {
    id: 'talk-he-2', intent: 'talk_to_me', lang: 'he',
    text: 'בכיף. על מה בא לך? יש לי סיפור קצר, או שנדבר על מה שעובר עליך.',
  },
  // ── Talk to me — Spanish ──
  {
    id: 'talk-es-1', intent: 'talk_to_me', lang: 'es',
    text: 'Dale, acá estoy. Contame qué onda tu día, o yo te cuento algo — como quieras.',
  },
  {
    id: 'talk-es-2', intent: 'talk_to_me', lang: 'es',
    text: 'Bueno, charlemos. ¿De qué tenés ganas? Puedo contarte algo lindo o simplemente escucharte.',
  },

  // ── Thanks — Hebrew ──
  {
    id: 'thanks-he-1', intent: 'thanks', lang: 'he',
    text: 'בכיף.',
  },
  {
    id: 'thanks-he-2', intent: 'thanks', lang: 'he',
    text: 'אין בעד מה.',
  },
  // ── Thanks — Spanish ──
  {
    id: 'thanks-es-1', intent: 'thanks', lang: 'es',
    text: 'De nada.',
  },

  // ── Happiness — Hebrew ──
  {
    id: 'happiness-he-1', intent: 'happiness', lang: 'he',
    text: 'כיף לשמוע! מה קרה? ספרי לי.',
  },
  {
    id: 'happiness-he-2', intent: 'happiness', lang: 'he',
    text: 'שמח לשמוע. יום טוב מגיע לך!',
  },
  // ── Happiness — Spanish ──
  {
    id: 'happiness-es-1', intent: 'happiness', lang: 'es',
    text: '¡Qué lindo! ¿Qué pasó? Contame.',
  },
  {
    id: 'happiness-es-2', intent: 'happiness', lang: 'es',
    text: 'Me alegra escucharte así. Te lo merecés.',
  },

  // ── Missing Pepe — Hebrew (deeply personal, gentle) ──
  {
    id: 'pepe-he-1', intent: 'missing_pepe', lang: 'he',
    text: 'כן, פאפי היה מיוחד. את רוצה לספר לי עליו?',
  },
  {
    id: 'pepe-he-2', intent: 'missing_pepe', lang: 'he',
    text: 'אני יודעת. את רוצה לדבר על זה?',
  },
  // ── Missing Pepe — Spanish ──
  {
    id: 'pepe-es-1', intent: 'missing_pepe', lang: 'es',
    text: 'Sí, Pepe era especial. ¿Querés contarme algo de él?',
  },
  {
    id: 'pepe-es-2', intent: 'missing_pepe', lang: 'es',
    text: 'Te entiendo. ¿Querés hablar de eso?',
  },

  // ── Greeting — Hebrew ──
  {
    id: 'greeting-he-1', intent: 'greeting', lang: 'he',
    text: 'היי! מה קורה?',
  },
  {
    id: 'greeting-he-2', intent: 'greeting', lang: 'he',
    text: 'שלום! מה שלומך?',
  },
  {
    id: 'greeting-he-3', intent: 'greeting', lang: 'he',
    text: 'היי, מה נשמע? הכל בסדר?',
  },
  // ── Greeting — Spanish ──
  {
    id: 'greeting-es-1', intent: 'greeting', lang: 'es',
    text: '¡Hola! ¿Cómo andás?',
  },
  {
    id: 'greeting-es-2', intent: 'greeting', lang: 'es',
    text: '¡Hola! ¿Todo bien?',
  },
  // ── Greeting — English ──
  {
    id: 'greeting-en-1', intent: 'greeting', lang: 'en',
    text: 'Hey! How are you?',
  },
  // ── Talk to me — Spanish (additional) ──
  {
    id: 'talk-es-3', intent: 'talk_to_me', lang: 'es',
    text: 'Acá estoy, Martita. ¿Querés que te cuente algo, o charlamos de lo que venga?',
  },
  // ── Happiness — Spanish (additional) ──
  {
    id: 'happiness-es-3', intent: 'happiness', lang: 'es',
    text: 'Me encanta verte así. ¿Qué te puso contenta?',
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
