/*
 * AbuAI Content World Engine (B2.2)
 *
 * Pure function. No React, no fetch, no LLM, no API.
 *
 * Given a user prompt, decides what KIND of conversation Martita is
 * inviting and returns a small set of gentle, adult, content-rich
 * directions. Used by the runtime to lead the conversation without
 * overwhelming her.
 *
 * Truth Contract is preserved:
 *   • realtime-required content (films now, news, local activity,
 *     weather) is flagged via `needsRealtime`; the runtime is
 *     responsible for the actual lookup.
 *   • this module NEVER invents events, films, news, local activities,
 *     calendar, family or personal facts. It only chooses a mode + a
 *     couple of friendly seeds.
 */

import { detectLanguage as detectProactiveLanguage } from './proactive'

export type ContentMode =
  | 'film_series'
  | 'music'
  | 'cooking'
  | 'theatre_poetry'
  | 'news_world'
  | 'curious_facts'
  | 'riddles_games'
  | 'light_culture_gossip'
  | 'memories'
  | 'local_activity'
  | 'podcast'
  | 'open_chat'

export type ContentLanguage = 'he' | 'es' | 'en' | 'mixed'

export interface ContentWorldChoice {
  contentMode: ContentMode
  needsRealtime: boolean
  needsSources: boolean
  suggestedOpening: string
  gentleOptions: string[]
  language: ContentLanguage
  reason: string
}

export interface ContentWorldContext {
  /** Optional last content mode shown — used to rotate openings. */
  lastContentMode?: ContentMode
  /** Optional last opening text — never repeated verbatim. */
  lastOpening?: string
}

// ─── Hebrew / Spanish / English cue catalogues ─────────────────────────────
//
// Hebrew patterns deliberately omit `\b` because Hebrew letters are not
// "word characters" in the JS regex engine.

const CUES: ReadonlyArray<{
  re: RegExp
  mode: ContentMode
  needsRealtime: boolean
  needsSources: boolean
  reason: string
}> = [
  // Film / series / cinema (current → realtime, historical → open)
  { re: /(?:^|[^a-záéíóúñ])pel[ií]culas?\s+(?:hay|ahora|nuevas|esta\s+semana|de\s+ahora|en\s+(?:el\s+)?cine)|cartelera|cine\s+(?:cerca|hoy|ahora)|now\s+playing|movies?\s+(?:now|tonight|this\s+week|today)/i,
    mode: 'film_series', needsRealtime: true, needsSources: true, reason: 'current film listings → realtime' },
  { re: /סרטים\s+(?:עכשיו|היום|השבוע|חדשים)|בקולנוע\s+(?:עכשיו|היום)/,
    mode: 'film_series', needsRealtime: true, needsSources: true, reason: 'current Hebrew film listing → realtime' },
  { re: /\b(?:pel[ií]cula|cuento\s+de\s+pel[ií]cula|recomendame\s+(?:una\s+)?pel[ií]cula|movie\s+recommendation|favorite\s+film)\b|סרט\s+(?:טוב|להמלצה)|המלצה\s+על\s+סרט/i,
    mode: 'film_series', needsRealtime: false, needsSources: false, reason: 'film recommendation → open' },

  // Music
  { re: /\b(?:m[uú]sica|canci[oó]n|cantar|escuchar\s+(?:algo|m[uú]sica))\b|מוזיקה|לשמוע\s+שיר/i,
    mode: 'music', needsRealtime: false, needsSources: false, reason: 'music' },

  // Podcast
  { re: /\bpodcasts?\b|פודקאסט/i,
    mode: 'podcast', needsRealtime: false, needsSources: false, reason: 'podcast' },

  // Cooking
  { re: /\b(?:receta|cocinar|cocina|empanadas|asado|orzo)\b|מתכון|לבשל/i,
    mode: 'cooking', needsRealtime: false, needsSources: false, reason: 'cooking' },

  // Theatre / poetry
  { re: /\b(?:teatro|obra\s+de\s+teatro|poema|poes[ií]a|poet[ai])\b|תיאטרון|הצגה|שיר\s+ש?כתב|פואמה/i,
    mode: 'theatre_poetry', needsRealtime: false, needsSources: false, reason: 'theatre / poetry' },

  // News / world. NB: `\b` does not work next to accented Spanish letters
  // (the JS regex engine treats accented letters as non-word), so the
  // Spanish alternatives use lookarounds / non-letter anchors.
  { re: /(?:^|[^a-záéíóúñ])noticias?\s+(?:hoy|ahora|de\s+hoy|[uú]ltimas|recientes)|(?:^|[^a-záéíóúñ])[uú]ltimas\s+noticias|\blatest\s+news\b|\bnews\s+(?:today|now)\b|\b(?:what'?s|que)\s+happening\s+(?:now|today|in\s+the\s+world)\b|חדשות\s+(?:היום|אחרונות)|מה\s+קורה\s+(?:היום|עכשיו|בעולם)/i,
    mode: 'news_world', needsRealtime: true, needsSources: true, reason: 'live news' },

  // Curious facts
  { re: /\b(?:contame|cu[eé]ntame)\s+algo\s+interesante\b|\bdime\s+algo\s+curioso\b|\btell\s+me\s+something\s+(?:fun|interesting)\b|תספרי\s+לי\s+משהו\s+(?:מעניין|חמוד)|דברים\s+מעניינים|עובדה\s+מעניינת/i,
    mode: 'curious_facts', needsRealtime: false, needsSources: false, reason: 'curious facts' },

  // Riddles / games
  { re: /\b(?:adivinanza|trivia|jugar)\b|חידה|טריוויה|לשחק/i,
    mode: 'riddles_games', needsRealtime: false, needsSources: false, reason: 'riddles / games' },

  // Light culture / gossip
  { re: /\b(?:chimentos|farándula|chisme|gossip|celebrities)\b|רכילות|כוכבים|טלנובלה/i,
    mode: 'light_culture_gossip', needsRealtime: false, needsSources: false, reason: 'light cultural gossip' },

  // Local activity
  { re: /\b(?:qu[eé]\s+hay\s+cerca|qu[eé]\s+hacer\s+hoy|actividad(?:es)?\s+(?:cerca|hoy|esta\s+semana)|near\s+me|what'?s\s+open|local\s+(?:event|activity))\b|מה\s+יש\s+(?:בכפר\s+סבא|בעיר|קרוב)|פעילות\s+(?:היום|השבוע|קרובה)/i,
    mode: 'local_activity', needsRealtime: true, needsSources: true, reason: 'local activity → realtime' },

  // Memories
  { re: /\b(?:me\s+acuerdo|cu[eé]ntame\s+de\s+cuando|memoria(?:s)?|me\s+recuerdas|me\s+acord[eé]\s+de)\b|זוכרת|זכרון|לפני\s+שנים|ימים\s+ההם/i,
    mode: 'memories', needsRealtime: false, needsSources: false, reason: 'memories' },
]

// Vague openers route to open_chat with gentle content options.
const VAGUE_HE = /^הי[!?\s]*$|^שלום[!?\s]*$|לא יודעת/
const VAGUE_ES = /^hola[!?\s.]*$|^buen[oa]s?(?:\s+(?:d[ií]as|tardes|noches))?[!?\s.]*$|\bno\s+s[eé]\b/i
const VAGUE_EN = /^(?:hi|hello|hey)[!?\s.]*$|\bi\s+don'?t\s+know\b/i

// "Quiero escuchar / I want to listen" → music + podcast options.
const WANT_LISTEN_HE = /רוצה\s+לשמוע/
const WANT_LISTEN_ES = /quiero\s+(?:escuchar|o[ií]r)/i
const WANT_LISTEN_EN = /\bi\s+(?:want|wanna)\s+to\s+listen\b/i

// "Estoy aburrida" / boredom → companionship content.
const BORED_HE = /משועממ[ת]?|משעמם לי/
const BORED_ES = /(?:^|[^a-záéíóúñ])(estoy\s+aburrid[oa]|me\s+aburro)/i
const BORED_EN = /\b(i'?m\s+bored|i\s+am\s+bored)\b/i

// "What shall we do" → local_activity for local context.
const WHAT_DO_HE = /מה\s+(?:אפשר|נעשה)/
const WHAT_DO_ES = /qu[eé]\s+hacemos|qu[eé]\s+podemos\s+hacer/i
const WHAT_DO_EN = /\bwhat\s+(?:can\s+we|should\s+we|shall\s+we)\s+do\b/i

// Broader language detector for content prompts. The proactive helper
// detects only proactive-related cues; greetings ("hola", "buenos
// días", "hi") and short phrases need wider coverage.
const HEBREW_LETTER = /[֐-׿]/
const SPANISH_WORDS = /\b(hola|buen[oa]s?|adi[oó]s|gracias|por\s+favor|qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|qui[eé]n|hoy|ma[nñ]ana|s[ií]|no\s+s[eé]|ten[eé]?s?|tengo|aburro|aburrid[oa]|sola|solo|ideas?|hablar|d[ií]a|recom[ie]ndame|h[aá]blame|cu[eé]ntame|contame|cuentame|estoy|me\s+siento|de\s+qu[eé]|pel[ií]cula|cine|noticias?|escuchar|m[uú]sica|podcast|adivinanza|empanadas|poema|teatro|cuento|historia|memoria|chimentos|aceptar|acá|argentina|italia|espa[ñn]a|abierto)\b/i
const ENGLISH_WORDS = /\b(hi|hello|hey|bye|please|thanks|good\s+(morning|afternoon|evening|night)|i'?m|i\s+am|bored|lonely|alone|today|tomorrow|what'?s?|do\s+i\s+have|tell\s+me|recommend|story|ideas?|help|something|movie|movies|cinema|news|weather|music|podcast|tonight|near\s+me|open\s+now|latest)\b/i

function detectLanguage(input: string): ContentLanguage {
  const hasHe = HEBREW_LETTER.test(input)
  const hasEs = SPANISH_WORDS.test(input)
  const hasEn = ENGLISH_WORDS.test(input)
  const langCount = [hasHe, hasEs, hasEn].filter(Boolean).length
  if (langCount >= 2) return 'mixed'
  if (hasHe) return 'he'
  if (hasEs) return 'es'
  if (hasEn) return 'en'
  // Fall back to the proactive helper for inputs not covered above.
  return detectProactiveLanguage(input)
}

const SEEDS: Record<ContentMode, Record<ContentLanguage | 'default', { opening: string; options: string[] }>> = {
  film_series: {
    default: { opening: '', options: [] },
    he: {
      opening: 'תרצי שאחפש מה מקרינים עכשיו, או שנדבר על סרט קלאסי שכדאי לראות?',
      options: ['סרטים עכשיו בקולנוע', 'סרט קלאסי מהזיכרון', 'סדרה לפני השינה'],
    },
    es: {
      opening: '¿Querés que mire qué hay en cartelera ahora, o charlamos de una película clásica?',
      options: ['Películas en cartelera ahora', 'Una clásica de las que vos amás', 'Una serie tranquila para la noche'],
    },
    en: {
      opening: 'Want me to check what is playing now, or chat about a classic?',
      options: ['Movies playing now', 'A classic favorite', 'A calm series for tonight'],
    },
    mixed: {
      opening: 'תרצי שאחפש מה מקרינים עכשיו, או charlamos de una película clásica?',
      options: ['סרטים בקולנוע עכשיו', 'Una clásica argentina', 'סדרה רגועה לערב'],
    },
  },
  music: {
    default: { opening: '', options: [] },
    he: {
      opening: 'תרצי שיר מאיזה סגנון? טנגו, פולקלור, או משהו רגוע מהבית?',
      options: ['טנגו ארגנטינאי', 'מוזיקה רגועה', 'שיר ילדים שאת אוהבת'],
    },
    es: {
      opening: '¿Buscamos un tango, algo folklórico, o algo tranquilito?',
      options: ['Un tango', 'Folklore argentino', 'Algo suavito para la tarde'],
    },
    en: {
      opening: 'A tango, something folkloric, or something gentle?',
      options: ['A tango', 'Argentine folk', 'Something gentle'],
    },
    mixed: { opening: 'תרצי טנגו, folklore, או משהו רגוע?', options: ['Tango', 'פולקלור', 'Suave'] },
  },
  cooking: {
    default: { opening: '', options: [] },
    he: { opening: 'מתכון של חמין, אמפנדס, או משהו קצר לערב?', options: ['אמפנדס', 'אורז עוף', 'משהו קל לערב'] },
    es: { opening: '¿Empanadas, orzo, o algo cortito para la noche?', options: ['Empanadas', 'Orzo', 'Algo livianito'] },
    en: { opening: 'Empanadas, orzo, or something light for tonight?', options: ['Empanadas', 'Orzo', 'Light dinner'] },
    mixed: { opening: 'אמפנדס, orzo, או משהו קל לערב?', options: ['Empanadas', 'אורז', 'קל לערב'] },
  },
  theatre_poetry: {
    default: { opening: '', options: [] },
    he: { opening: 'שיר ש?אמא שלך אהבה, או משהו של אלתרמן? אני יכולה לקרוא לך אחד.', options: ['שיר קצר', 'קטע מהצגה', 'משורר אהוב'] },
    es: { opening: '¿Te leo un poema corto, o charlamos de teatro argentino?', options: ['Un poema corto', 'Una obra que recuerde', 'Un autor que te guste'] },
    en: { opening: 'A short poem, or a chat about classic theatre?', options: ['A short poem', 'A play you remember', 'A poet you like'] },
    mixed: { opening: 'שיר קצר, או charlamos de teatro?', options: ['שיר קצר', 'Una obra', 'משורר אהוב'] },
  },
  news_world: {
    default: { opening: '', options: [] },
    he: { opening: 'אבדוק חדשות עכשיו, ואחזור עם משהו אחד מעניין בלי להציף.', options: ['חדשות כלליות', 'חדשות מארגנטינה', 'משהו תרבותי'] },
    es: { opening: 'Miro las noticias y te traigo una sola cosa interesante, sin abrumar.', options: ['Noticia general', 'Algo de Argentina', 'Algo cultural'] },
    en: { opening: 'I will check the news and bring one calm headline.', options: ['One headline', 'Argentina', 'Something cultural'] },
    mixed: { opening: 'אבדוק חדשות, sin abrumar.', options: ['חדשה אחת', 'Argentina', 'תרבות'] },
  },
  curious_facts: {
    default: { opening: '', options: [] },
    he: { opening: 'יש לי אחת חמודה — תרצי על דבורים, על הים, או על הטלסקופ?', options: ['דבורים', 'ים', 'טלסקופ'] },
    es: { opening: 'Tengo una linda — ¿te tiro algo de abejas, del mar, o del telescopio?', options: ['Abejas', 'El mar', 'Telescopio'] },
    en: { opening: 'I have a sweet one — bees, the ocean, or the telescope?', options: ['Bees', 'The ocean', 'Telescope'] },
    mixed: { opening: 'מעניין? abejas, ים, או telescopio?', options: ['Abejas', 'הים', 'Telescopio'] },
  },
  riddles_games: {
    default: { opening: '', options: [] },
    he: { opening: 'חידה קלה לפני קפה?', options: ['חידה הגיונית', 'חידה משעשעת', 'משחק מילים'] },
    es: { opening: '¿Una adivinanza tranquila antes del café?', options: ['Una adivinanza', 'Un juego de palabras', 'Una de trivia'] },
    en: { opening: 'A calm riddle before coffee?', options: ['A riddle', 'A word game', 'A trivia question'] },
    mixed: { opening: 'חידה קצרה, ¿una adivinanza?', options: ['Adivinanza', 'משחק מילים', 'Trivia'] },
  },
  light_culture_gossip: {
    default: { opening: '', options: [] },
    he: { opening: 'תרצי לדבר על טלנובלה, על אופנה, או על מישהו מהמוזיקה?', options: ['טלנובלה', 'אופנה', 'אישיות מוזיקלית'] },
    es: { opening: '¿Hablamos de una telenovela, de moda, o de algún cantante?', options: ['Una telenovela', 'Moda', 'Algún cantante'] },
    en: { opening: 'A soap opera, fashion, or a singer?', options: ['A telenovela', 'Fashion', 'A singer'] },
    mixed: { opening: 'טלנובלה, moda, או cantante?', options: ['Telenovela', 'אופנה', 'Cantante'] },
  },
  memories: {
    default: { opening: '', options: [] },
    // B2.3 audit: the memories options are invitations FOR Martita to
    // share — AbuAI never claims to hold a private memory of Pepi or her
    // childhood. The opener leads with "tell me", the options are framed
    // as topics SHE can pick to talk about.
    he: { opening: 'תספרי לי משהו, אם בא לך — או שאני אקרא לך משהו קצר ויפה?', options: ['לספר על בואנוס איירס', 'לדבר על הילדות שלך', 'לדבר על פפי, אם בא לך'] },
    es: { opening: 'Si querés, contame algo vos — o te leo algo cortito y lindo.', options: ['Contarme de Buenos Aires', 'Hablar de tu infancia', 'Hablar de Pepi, si querés'] },
    en: { opening: 'If you like, tell me something — or I can read you something short and gentle.', options: ['Tell me about Buenos Aires', 'Talk about your childhood', 'Talk about Pepi, if you like'] },
    mixed: { opening: 'אם בא לך, contame algo vos — או שאני אקרא לך משהו קצר.', options: ['Contarme de Buenos Aires', 'הילדות שלך', 'Pepi, אם בא לך'] },
  },
  local_activity: {
    default: { opening: '', options: [] },
    he: { opening: 'אבדוק מה פתוח עכשיו בכפר סבא וקרוב, ואחזור עם שתיים-שלוש אפשרויות שקטות.', options: ['בית קפה קרוב', 'הליכה בפארק', 'משהו תרבותי'] },
    es: { opening: 'Miro qué hay cerca de Kfar Saba ahora y te traigo dos o tres ideas tranquilas.', options: ['Un café cerca', 'Caminata en el parque', 'Algo cultural'] },
    en: { opening: 'I will check what is open near Kfar Saba now and bring two or three calm options.', options: ['A nearby café', 'A park walk', 'Something cultural'] },
    mixed: { opening: 'אבדוק en Kfar Saba, dos o tres ideas tranquilas.', options: ['Café קרוב', 'הליכה בפארק', 'Cultural'] },
  },
  podcast: {
    default: { opening: '', options: [] },
    he: { opening: 'תרצי פודקאסט קצר על היסטוריה, על טבע, או על אנשים מעניינים?', options: ['היסטוריה', 'טבע', 'פרופילים אנושיים'] },
    es: { opening: '¿Un podcast cortito de historia, de naturaleza, o de gente interesante?', options: ['Historia', 'Naturaleza', 'Perfiles humanos'] },
    en: { opening: 'A short history, nature, or people podcast?', options: ['History', 'Nature', 'People profiles'] },
    mixed: { opening: 'פודקאסט קצר — historia, naturaleza, או profiles?', options: ['Historia', 'טבע', 'Profiles'] },
  },
  open_chat: {
    default: { opening: '', options: [] },
    he: { opening: 'אני כאן בשקט. רוצה סיפור קצר, פודקאסט, או רעיון לערב?', options: ['סיפור קצר', 'פודקאסט נעים', 'רעיון לערב'] },
    es: { opening: 'Acá estoy tranquila. ¿Querés un cuento corto, un podcast, o una idea para la tarde?', options: ['Un cuento corto', 'Un podcast', 'Una idea para la tarde'] },
    en: { opening: 'I am here, no rush. A short story, a podcast, or an idea for tonight?', options: ['A short story', 'A podcast', 'An idea for tonight'] },
    mixed: { opening: 'אני כאן, sin apuro. cuento corto, podcast, או idea?', options: ['Cuento corto', 'פודקאסט', 'Idea לערב'] },
  },
}

function pickSeed(mode: ContentMode, lang: ContentLanguage): { opening: string; options: string[] } {
  const pool = SEEDS[mode]
  const byLang = pool[lang]
  if (byLang && byLang.opening) return byLang
  return pool.es.opening ? pool.es : (pool.he.opening ? pool.he : pool.default)
}

/**
 * Choose the content world for a given input. Pure — does NOT fetch, call
 * the LLM, or invent any current fact.
 */
export function chooseContentWorld(input: string, _context?: ContentWorldContext): ContentWorldChoice {
  const t = (input ?? '').trim()
  const language = detectLanguage(t)

  if (!t) {
    // Empty input → gentle open prompt.
    const seed = pickSeed('open_chat', language)
    return {
      contentMode: 'open_chat',
      needsRealtime: false,
      needsSources: false,
      suggestedOpening: seed.opening,
      gentleOptions: seed.options,
      language,
      reason: 'empty input — gentle open prompt',
    }
  }

  // Explicit "I want to listen" → music + podcast options.
  if (WANT_LISTEN_HE.test(t) || WANT_LISTEN_ES.test(t) || WANT_LISTEN_EN.test(t)) {
    const seed = pickSeed('music', language)
    return {
      contentMode: 'music',
      needsRealtime: false,
      needsSources: false,
      suggestedOpening: seed.opening,
      gentleOptions: seed.options,
      language,
      reason: 'want-to-listen cue → music',
    }
  }

  // "What can we do" → local_activity (realtime).
  if (WHAT_DO_HE.test(t) || WHAT_DO_ES.test(t) || WHAT_DO_EN.test(t)) {
    const seed = pickSeed('local_activity', language)
    return {
      contentMode: 'local_activity',
      needsRealtime: true,
      needsSources: true,
      suggestedOpening: seed.opening,
      gentleOptions: seed.options,
      language,
      reason: 'local activity cue',
    }
  }

  // Explicit cues from the catalogue.
  for (const cue of CUES) {
    if (cue.re.test(t)) {
      const seed = pickSeed(cue.mode, language)
      return {
        contentMode: cue.mode,
        needsRealtime: cue.needsRealtime,
        needsSources: cue.needsSources,
        suggestedOpening: seed.opening,
        gentleOptions: seed.options,
        language,
        reason: cue.reason,
      }
    }
  }

  // Boredom → companionship options.
  if (BORED_HE.test(t) || BORED_ES.test(t) || BORED_EN.test(t)) {
    const seed = pickSeed('open_chat', language)
    return {
      contentMode: 'open_chat',
      needsRealtime: false,
      needsSources: false,
      suggestedOpening: seed.opening,
      gentleOptions: seed.options,
      language,
      reason: 'boredom → open_chat with content options',
    }
  }

  // Vague greeting / "no sé" → open_chat with content options.
  if (VAGUE_HE.test(t) || VAGUE_ES.test(t) || VAGUE_EN.test(t)) {
    const seed = pickSeed('open_chat', language)
    return {
      contentMode: 'open_chat',
      needsRealtime: false,
      needsSources: false,
      suggestedOpening: seed.opening,
      gentleOptions: seed.options,
      language,
      reason: 'vague prompt → open_chat with content options',
    }
  }

  // Default: open conversation. Leave needsRealtime false (caller decides
  // if any subsequent cue requires it).
  const seed = pickSeed('open_chat', language)
  return {
    contentMode: 'open_chat',
    needsRealtime: false,
    needsSources: false,
    suggestedOpening: seed.opening,
    gentleOptions: seed.options,
    language,
    reason: 'default → open_chat',
  }
}
