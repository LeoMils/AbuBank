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
export type ProactiveIntent = 'boredom' | 'no_topic' | 'loneliness' | 'ideas' | 'sadness' | 'talk_to_me' | 'missing_pepe' | 'thanks'

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

// Sadness / low energy — distinct from loneliness (lonely = alone, sad = feeling bad)
const SADNESS_HE = /עצובה|עצוב|אין לי כוח|לא בכיף|לא טוב לי|קשה לי היום|יום קשה/
const SADNESS_ES = /estoy\s+triste|me\s+siento\s+mal|no\s+tengo\s+ganas|d[ií]a\s+dif[ií]cil/i
const SADNESS_EN = /\b(i'?m\s+sad|feeling\s+(down|bad)|tough\s+day|no\s+energy)\b/i

// "Talk to me" — needs company, not a specific intent
const TALK_HE = /תדברי איתי|דברי איתי|תספרי לי משהו|ספרי לי משהו/
const TALK_ES = /habl[aá]me|cont[aá]me\s+algo|charlemos/i
const TALK_EN = /\btalk\s+to\s+me\b|\btell\s+me\s+something\b/i

// Thanks — simple acknowledgment, no LLM needed
const THANKS_HE = /^תודה[!.\s]*$|^תודה רבה[!.\s]*$/
const THANKS_ES = /^gracias[!.\s]*$/i
const THANKS_EN = /^thanks?(?:\s+you)?[!.\s]*$|^thank\s+you[!.\s]*$/i

// Missing Pepe — deeply emotional, requires gentle specific response
const MISSING_PEPE = /מתגעגע[ת]?\s+(ל|אל\s+)?פפ[יה]|געגועים\s+(ל|אל\s+)?פפ[יה]|חסר\s+לי\s+פפ[יה]|extra[nñ]o\s+(a\s+)?pep[eé]/i

export function detectIntent(input: string): ProactiveIntent | null {
  // Missing Pepe — most specific, check first
  if (MISSING_PEPE.test(input)) return 'missing_pepe'
  if (BOREDOM_HE.test(input) || BOREDOM_ES.test(input) || BOREDOM_EN.test(input)) return 'boredom'
  if (NO_TOPIC_HE.test(input) || NO_TOPIC_ES.test(input) || NO_TOPIC_EN.test(input)) return 'no_topic'
  if (LONELINESS_HE.test(input) || LONELINESS_ES.test(input) || LONELINESS_EN.test(input)) return 'loneliness'
  if (SADNESS_HE.test(input) || SADNESS_ES.test(input) || SADNESS_EN.test(input)) return 'sadness'
  if (TALK_HE.test(input) || TALK_ES.test(input) || TALK_EN.test(input)) return 'talk_to_me'
  if (THANKS_HE.test(input) || THANKS_ES.test(input) || THANKS_EN.test(input)) return 'thanks'
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
    text: 'בואי נעשה משהו. רוצה לשמוע סיפור קצר, לדבר על משהו שמעניין אותך, או לחשוב על תוכנית למחר?',
  },
  {
    id: 'boredom-he-2', intent: 'boredom', lang: 'he',
    text: 'אני כאן. אפשר לדבר על משהו שעובר עליך, לחשוב על מתכון לסוף השבוע, או שאני אספר לך משהו מעניין.',
  },
  {
    id: 'boredom-he-3', intent: 'boredom', lang: 'he',
    text: 'יש כמה דברים נחמדים — סיפור קצר, טיול קטן בכפר סבא, או לצלצל למישהו מהמשפחה. מה מתחשק לך?',
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
    text: 'זה בסדר להרגיש ככה. אני איתך. רוצה לדבר על מה שעובר עליך, או שנדבר על משהו אחר?',
  },
  {
    id: 'sadness-he-2', intent: 'sadness', lang: 'he',
    text: 'אני שומעת אותך. לפעמים הימים כבדים. אם בא לך אני כאן — לדבר, לשתוק, מה שנוח.',
  },
  // ── Sadness — Spanish ──
  {
    id: 'sadness-es-1', intent: 'sadness', lang: 'es',
    text: 'Está bien sentirse así, Martita. Estoy acá. Si querés hablamos de lo que sea, o simplemente te hago compañía un rato.',
  },
  {
    id: 'sadness-es-2', intent: 'sadness', lang: 'es',
    text: 'Te escucho. A veces los días pesan. Si te sirve, charlamos de algo — lo que venga.',
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
    text: 'בכיף. אני כאן אם תצטרכי עוד משהו.',
  },
  {
    id: 'thanks-he-2', intent: 'thanks', lang: 'he',
    text: 'בשמחה. תגידי אם צריך עוד משהו.',
  },
  // ── Thanks — Spanish ──
  {
    id: 'thanks-es-1', intent: 'thanks', lang: 'es',
    text: 'De nada, Martita. Acá estoy si necesitás algo más.',
  },

  // ── Missing Pepe — Hebrew (deeply personal, gentle) ──
  {
    id: 'pepe-he-1', intent: 'missing_pepe', lang: 'he',
    text: 'פפי היה מיוחד. הגעגוע הזה לא עובר — אבל הוא נמצא בכל הילדים והנכדים שלך.',
  },
  {
    id: 'pepe-he-2', intent: 'missing_pepe', lang: 'he',
    text: 'פפי היה אחד במינו. מותר להתגעגע. רוצה לספר לי עליו משהו?',
  },
  // ── Missing Pepe — Spanish ──
  {
    id: 'pepe-es-1', intent: 'missing_pepe', lang: 'es',
    text: 'Pepe era único. Eso no se olvida — ni tiene por qué. Está en cada uno de tus nietos.',
  },
  {
    id: 'pepe-es-2', intent: 'missing_pepe', lang: 'es',
    text: 'Extrañarlo es natural. ¿Querés contarme algo de él? Me gusta escucharte hablar de Pepe.',
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
