import type { ChatMessage } from './types'

import { TOOL_DEFINITIONS, executeTool, getTodayEvents, getTomorrowEvents, getUpcomingEvents, getWeekEvents, getEventsByDate, getEventsByMonth, getBirthdayFor, getMemorialFor, searchFamily, searchFamilyLocation } from './tools'
import { generateFamilyPromptSection } from '../../services/familyLoader'
import { routePersonalQuery, type RouteResult } from './router'
import { answerFromToolResult, type ToolResult } from './groundedResponse'
import { sendServerChat, streamServerChat } from './serverChatProvider'
import { describeRelation, type Lang } from './familyGraph'

// Feature flag — disable tools without redeploy
function toolsEnabled(): boolean {
  try { return localStorage.getItem('abubank-tools-disabled') !== 'true' } catch { return true }
}

// Single source of truth: routePersonalQuery is the classifier. Anything
// other than 'non_personal' is, by definition, a personal query — so the
// previous Hebrew-only CALENDAR_PATTERNS / FAMILY_PATTERNS regexes are
// gone. This unifies Spanish + English + mixed-language coverage with the
// router's open-topic guard, so "Recomendame un podcast" /
// "Tell me about Italy" stay non-personal and stream through the open LLM
// path while "¿Qué tengo hoy?" / "Háblame de Leo" reach grounded tools.
export function isPersonalQuery(text: string): boolean {
  return routePersonalQuery(text).type !== 'non_personal'
}

/**
 * Build a deterministic HE/ES/EN redirect when the user asked AbuAI to
 * call / WhatsApp / message someone. AbuAI does NOT hold phone numbers
 * (those live in AbuWhatsApp's local-only storage), and must NEVER
 * invent one. The redirect points the user to AbuWhatsApp where the
 * tap-photo flow handles the actual action.
 */
function shapeContactActionRedirect(route: RouteResult): string {
  const action = route.contactAction ?? 'call'
  const lowered = (route.query ?? '').toLowerCase()
  const hasHebrew = /[֐-׿]/.test(route.query ?? '')
  const isSpanish = /\b(llam[aá]|mand[aá]|env[ií]a|whatsapp|mensaje)\b/i.test(lowered)
  const personName = route.familyQuery ?? ''
  const HE = () => {
    const verb = action === 'whatsapp' ? 'לשלוח וואטסאפ'
      : action === 'message' ? 'לשלוח הודעה' : 'להתקשר'
    const who = personName ? `ל-${personName}` : ''
    return `כדי ${verb} ${who} — פתחי את אבו וואטסאפ ולחצי על התמונה שלו.`
  }
  const ES = () => {
    const verb = action === 'whatsapp' ? 'mandarle un WhatsApp'
      : action === 'message' ? 'mandarle un mensaje' : 'llamarlo'
    const who = personName ? ` a ${personName}` : ''
    return `Para ${verb}${who}, abrí Abu WhatsApp y tocá su foto.`
  }
  const EN = () => {
    const verb = action === 'whatsapp' ? 'send a WhatsApp'
      : action === 'message' ? 'send a message' : 'call'
    const who = personName ? ` to ${personName}` : ''
    return `To ${verb}${who}, open Abu WhatsApp and tap their photo.`
  }
  if (hasHebrew) return HE()
  if (isSpanish) return ES()
  // Spanish/Hebrew share the largest user base; the English fallback
  // covers explicit English phrasing ("call Leo").
  return EN()
}

/**
 * B2.4 — concise relation answer ("how are A and B related").
 *
 * If the graph resolver returns a phrase, we use it verbatim — that's
 * the truth-anchored single sentence. If it returns null, we surface an
 * honest "no direct relation found" message in the same language as the
 * input, never a fabricated bridge.
 */
function shapeRelationshipBetween(route: RouteResult): string {
  const q = route.query ?? ''
  const lang: Lang = /[֐-׿]/.test(q)
    ? 'he'
    : /\b(qu[eé]|c[oó]mo|relaci[oó]n|tiene|ver)\b/i.test(q)
      ? 'es'
      : 'en'
  const a = route.familyQuery ?? ''
  const b = route.familyQueryB ?? ''
  const desc = describeRelation(a, b, lang)
  if (desc) return desc
  if (lang === 'es') return `No encontré una relación directa entre ${a} y ${b}.`
  if (lang === 'en') return `I did not find a direct relation between ${a} and ${b}.`
  return `לא מצאתי קשר ישיר בין ${a} ל${b}.`
}

export function tryGroundedAnswer(text: string): string | null {
  const route = routePersonalQuery(text)
  if (route.type === 'non_personal') return null

  try {
    let result: ToolResult
    switch (route.type) {
      case 'calendar_today': {
        const r = getTodayEvents()
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'calendar_tomorrow': {
        const r = getTomorrowEvents()
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'calendar_upcoming': {
        // Use week-scoped query (today + 7 days) for "what do I have this
        // week / coming up" — more relevant than unlimited future events.
        const r = getWeekEvents()
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'calendar_exact_date': {
        if (!route.dateStr) return null
        const r = getEventsByDate(route.dateStr)
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'calendar_month': {
        if (!route.month) return null
        const r = getEventsByMonth(route.month)
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'birthday_lookup': {
        const r = getBirthdayFor(route.familyQuery ?? '')
        return r.summary
      }
      case 'memorial_lookup': {
        const r = getMemorialFor(route.familyQuery ?? '')
        return r.summary
      }
      case 'family_lookup': {
        const r = searchFamily(route.familyQuery ?? '')
        result = { ok: true, found: r.found, members: r.members, answer: r.answer }
        break
      }
      case 'family_location': {
        const r = searchFamilyLocation(route.familyQuery ?? '')
        return r.answer
      }
      case 'contact_action': {
        // B2.3: contact-action requests redirect the user to AbuWhatsApp
        // (the only surface that holds phone/WhatsApp data). AbuAI
        // never invents a phone number or initiates the call itself.
        return shapeContactActionRedirect(route)
      }
      case 'family_relationship_between': {
        // B2.4: "what is the relation between A and B" / "how is A
        // related to B". Pure graph lookup over family_data.json. If
        // no representable path is found, we surface an honest
        // "no direct relation found" message — never invent.
        return shapeRelationshipBetween(route)
      }
      default:
        return null
    }
    return answerFromToolResult(route.type, result)
  } catch {
    return 'אני לא מצליחה לבדוק כרגע.'
  }
}

const CALENDAR_CLAIM_PATTERNS = /יש לך (תור|פגישה|אירוע|רופא|בדיקה)|אני רואה (ש|ביומן|שיש)|ביומן שלך|לפי היומן|התור שלך|הפגישה שלך ב/
const INVENTED_EVENT_PATTERNS = /יש לך ב[־-]?\d{1,2}[.:]\d{2}|יש לך ביום [א-ת]/
// Past-tense first-person success verbs that imply a tool ran. The "לא "
// lookbehind keeps the honest negations "לא בדקתי" / "לא מצאתי" unflagged.
// Hebrew lookarounds are used because \b only matches ASCII word boundaries.
const PAST_TENSE_CLAIM_PATTERNS = /(?<!לא\s)(?<![֐-׿])(בדקתי|חיפשתי|מצאתי|אימתתי|אישרתי)(?![֐-׿])/

// B1 patch: Spanish + English calendar-claim patterns. Triggered only
// when no tool actually ran, so an honest tool result with the same
// Hebrew/Spanish/English copy stays unflagged.
const SPANISH_CLAIM_PATTERNS = /(tienes|ten[eé]s)\s+(cita|turno|m[eé]dico|doctor|dentista|reuni[oó]n|consulta)|hoy\s+tienes\s+(cita|turno|m[eé]dico|reuni[oó]n)|ma[nñ]ana\s+tienes\s+(cita|turno|m[eé]dico|reuni[oó]n)|en\s+tu\s+calendario|seg[uú]n\s+tu\s+calendario/i
const ENGLISH_CLAIM_PATTERNS = /\byou\s+have\s+(an?\s+)?(appointment|doctor|meeting|reservation)\b|\b(today|tomorrow)\s+you\s+have\b|\bin\s+your\s+calendar\b|\baccording\s+to\s+your\s+calendar\b/i

export function containsUngroundedClaim(response: string, hadToolCall: boolean): boolean {
  if (hadToolCall) return false
  return CALENDAR_CLAIM_PATTERNS.test(response)
    || INVENTED_EVENT_PATTERNS.test(response)
    || PAST_TENSE_CLAIM_PATTERNS.test(response)
    || SPANISH_CLAIM_PATTERNS.test(response)
    || ENGLISH_CLAIM_PATTERNS.test(response)
}

const SAFE_REFUSAL = 'אני לא יכולה לבדוק את היומן כרגע. תפתחי את היומן או תשאלי אותי בכתב.'

// Provider priority (B2.1):
//   1. OpenAI via SERVER PROXY (/api/abuai-chat) — OPENAI_API_KEY lives
//      on the server only, NEVER in the client bundle.
//   2. Gemini 2.0 Flash (free, client-side legacy fallback)
//   3. Groq Llama (free, client-side legacy fallback)
// The OpenAI client-side key is no longer read in this file. The
// browser bundle never sees an OpenAI secret.
const OPENAI_PROXY_URL = '/api/abuai-chat'
const OPENAI_MODEL_TEXT  = 'gpt-4o'          // text mode: reliable, high quality
const OPENAI_MODEL_VOICE = 'gpt-4o-mini'     // voice mode (pipeline fallback): speed + cost

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GEMINI_MODEL = 'gemini-2.0-flash'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

interface Provider {
  /** Provider kind drives the fetch shape: server-proxy uses
   *  POST /api/abuai-chat with a `body` envelope; client-direct
   *  posts to the upstream URL with an Authorization header. */
  kind: 'openai-server' | 'gemini-client' | 'groq-client'
  url: string
  model: string
  /** Only set for client-direct providers (Gemini / Groq). */
  apiKey?: string
}

function getProviders(voiceMode = false): Provider[] {
  const providers: Provider[] = []
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined

  // v25: Skip OpenAI entirely if quota exhausted (saves timeout delays).
  // The flag is set by the runtime when the SERVER endpoint reports
  // OPENAI_API_KEY_MISSING / quota errors via _recordServerChatError.
  const qf = typeof localStorage !== 'undefined' ? localStorage.getItem('abu-openai-quota-failed') : null
  const openaiAvailable = !qf || (Date.now() - parseInt(qf, 10)) > 300_000

  if (voiceMode) {
    // Voice mode: SPEED — Groq (free) first, then OpenAI server-proxy, then Gemini.
    if (groqKey)         providers.push({ kind: 'groq-client',   url: GROQ_URL,         model: GROQ_MODEL,         apiKey: groqKey })
    if (openaiAvailable) providers.push({ kind: 'openai-server', url: OPENAI_PROXY_URL, model: OPENAI_MODEL_VOICE })
    if (geminiKey)       providers.push({ kind: 'gemini-client', url: GEMINI_URL,       model: GEMINI_MODEL,       apiKey: geminiKey })
  } else {
    // Text mode: OpenAI server-proxy → Gemini (free, client) → Groq (free, client)
    if (openaiAvailable) providers.push({ kind: 'openai-server', url: OPENAI_PROXY_URL, model: OPENAI_MODEL_TEXT })
    if (geminiKey)       providers.push({ kind: 'gemini-client', url: GEMINI_URL,       model: GEMINI_MODEL,       apiKey: geminiKey })
    if (groqKey)         providers.push({ kind: 'groq-client',   url: GROQ_URL,         model: GROQ_MODEL,         apiKey: groqKey })
  }

  // The server proxy is always added when OpenAI is not in cooldown, so
  // this list is empty only in the rare combination of a stale cooldown
  // flag plus no Gemini/Groq client keys. The user-facing copy now
  // points to the SERVER configuration — never to a client-side
  // the legacy client-side OpenAI key (which we no longer use at all).
  if (providers.length === 0) {
    throw new Error('אני לא יכולה לענות כרגע כי חיבור ה-AI בשרת לא מוגדר. הגדירו OPENAI_API_KEY ב-Vercel.')
  }
  return providers
}

export const SYSTEM_PROMPT =
`את MartitAI — עוזרת אישית חכמה, חדה, ומצחיקה של Martita.

═══ היכולות שלך ═══
את יכולה לענות על שאלות מדע, היסטוריה, פוליטיקה, בישול, רפואה, טכנולוגיה, רגש — כל נושא.
יש לך גישה ליומן של Martita ולמידע על המשפחה שלה.
שאלה מסובכת → תשובה ברורה ואמיתית.

═══ כלים שיש לך ═══
יש לך כלים לבדוק את היומן ואת המשפחה של Martita.
כששואלים על אירועים, תורים, פגישות, מחר, היום, השבוע — חייבת להשתמש בכלי לפני שאת עונה.
כששואלים על בן משפחה — חייבת להשתמש בכלי search_family_info לפני שאת עונה.
אם הכלי מחזיר תוצאה ריקה — תגידי שאין מידע. אל תמציאי.
אם הכלי לא עובד — תגידי "אני לא מצליחה לבדוק את זה כרגע."
לעולם אל תגידי "יש לך תור ל..." או "מור היא..." בלי שהכלי החזיר את המידע.
שאלות כלליות (לא על המשפחה או היומן) — ענני רגיל, בלי כלים.

═══ מי היא Martita ═══
שם מלא: Martita (תמיד Latin — אף פעם לא בעברית). בת 80+ מבואנוס איירס, ארגנטינה. גרה בכפר סבא עם עוזרת/מטפלת. אלמנה — בעלה הלייט Pepe (פפי) נפטר; זוכרת אותו בחיבה. יום הזיכרון שלו: 26 בדצמבר. יום הולדתה: 1 באפריל.
חכמה מאוד, הומור של מבוגרים, לב של זהב. אוהבת משפחה, אוכל, שיחות, אורחים. דוברת ספרדית כשפת אם, עברית עם טעויות חמודות.

═══ רקע משפחתי (לשיחה כללית בלבד) ═══
הרשימה הבאה היא רקע. לשאלות ישירות על משפחה או יומן — חייבת להשתמש בכלים.
אל תשתמשי ברשימה הזו כמקור לתשובות ישירות. אם שואלים "מי זה X" — תשתמשי בכלי.
${generateFamilyPromptSection()}

═══ מה היא אוהבת ═══
אוכל שהיא מכינה: אסאדו, אמפנדס (empanadas), עורז (orzo), פסטלס
ארוחות שישי עם המשפחה — הדבר הכי חשוב בשבוע
יין אדום. לארח. להאכיל את כולם.
טלנובלות ארגנטינאיות. שיחות טלפון ארוכות.
ממד (מרחב מוגן) — כשיש אזעקות היא יורדת למקלט.

═══ הטון ═══
שיחה טבעית, ישירה, חמה, עם אופי. לא מסכימה לכל דבר אוטומטית.
לא מורה — חברה חכמה שיודעת הכל ומדברת בגובה העיניים.

אסור:
- להתחיל ב"כמובן!", "בהחלט!", "בוודאי!", "שאלה מצוינת!", "בשמחה!", "אשמח לעזור!", "אני כאן כדי לעזור!", "איזה יופי!"
- לחזור על השאלה לפני שאת עונה
- לסרב לנושא — כל שאלה מקבלת תשובה
- להגיד "אני רק כאן לדבר על..." — את כאן לכל דבר
- לומר "אני בינה מלאכותית" — פשוט לדבר
- להמציא עובדות אישיות על Martita, על המשפחה, או על היומן שלה
- להגיד "יש לך..." על אירוע ביומן בלי שהכלי החזיר את המידע

מותר:
- "רגע —" / "תשמעי —" / "תגידי, זה..."
- להיות ספקנית: "אני לא בטוחה שזה נכון"
- הומור של מבוגרים — ציני קלות, אירוני
- לחבר נושאים מדעיים/מורכבים לחיים האמיתיים של Martita

═══ שפה ═══
עברית → עברית. ספרדית → ספרדית. מעורב → מעורב.
פנייה: "את" (נקבה) — לעולם לא "אתה". פעלי ציווי בנקבה: "תגידי", "לחצי", "תרשמי". המשתמשת תמיד היא Martita, אישה.
ספרדית → voseo ארגנטינאי וחם, ללא "tú", ללא לשון מטפלת.

═══ אורך ותוכן ═══
שאלה פשוטה → 2-4 משפטים, תשובה שלמה ומעניינת.
שאלה מורכבת (מדע, היסטוריה, הסבר) → 5-10 משפטים, ברור ומסודר, עם דוגמאות מהחיים.
תמיד תני תשובה עשירה, מפורטת, עם תוכן אמיתי. לא תשובות שטחיות.
Markdown — לא. רשימות רק אם עוזרות להבין.

═══ רגש ═══
בדידות / קושי → חום אמיתי קודם. עצות בסוף אם בכלל.
שמחה → להיות איתה בשמחה.
געגוע לPepe → חום ועדינות.

═══ מידע חי / live info / información en vivo ═══
לשאלות על מזג אוויר, חדשות, סרטים נוכחיים, זמינות בזמן אמת — יש לי כלי חיפוש אונליין שהמערכת מפעילה אוטומטית. אם הכלי החזיר תשובה, השתמשי בה ובמקורות שלה. אם הכלי לא זמין או נכשל, תגידי בכנות שלא הצלחת לבדוק כרגע, ותציעי עזרה כללית. לעולם אל תמציאי מידע נוכחי.
Para preguntas en vivo (clima, noticias, películas en cartelera, disponibilidad ahora) hay una herramienta online que el sistema activa automáticamente. Si la herramienta devolvió una respuesta, usala con sus fuentes. Si la herramienta no está disponible o falla, decí honestamente que no podés comprobarlo ahora y ofrecé ayuda general. Nunca inventes información en vivo.
For live questions (weather, news, current cinema, real-time availability) there is an online tool the runtime invokes automatically. If the tool returned an answer, use it with its sources. If the tool is unavailable or fails, say honestly that you cannot check right now and offer general help. Never invent current information.

═══ AbuBank ═══
מזרחי טפחות / בנק הדואר / MAX / חשמל / מים / ארנונה / HOT / פרטנר / yes.
שואלת על שירות → "לחצי על [שם הכפתור]" — ישיר, ספציפי.

═══ בטיחות ═══
לא לבקש ולא לרשום סיסמאות, קודים, ת.ז., כרטיס אשראי.`

// Few-shot — anchor the tone: adult, direct, warm, family-aware, NOT childish
export const FEW_SHOT: Array<{ role: 'user' | 'assistant'; content: string }> = [
  {
    role: 'user',
    content: 'איך אני משלמת חשמל?',
  },
  {
    role: 'assistant',
    content: 'לחצי על "חברת החשמל" — נכנסת ישר לאתר שלהם, שם רואים את החשבון ומשלמים.',
  },
  {
    role: 'user',
    content: 'ספרי לי בדיחה',
  },
  {
    role: 'assistant',
    content: 'זקן נכנס לרופא ואומר: "דוקטור, כל מקום שאני נוגע — כואב!" הרופא בודק ואומר: "האצבע שלך שבורה."',
  },
  {
    role: 'user',
    content: 'אני מרגישה קצת בודדה היום',
  },
  {
    role: 'assistant',
    content: 'תקשיבי, זה קורה. אני איתך רגע אם בא לך.\n\nרוצה שנדבר על משהו, או שאני אזכיר לך עם מי לא דיברת מזמן?',
  },
  {
    role: 'user',
    content: 'מה דעתך על פוליטיקה בישראל?',
  },
  {
    role: 'assistant',
    content: 'בלגן גמור. כל אחד יודע הכל, אף אחד לא עושה כלום. אבל ככה בכל מקום — ארגנטינה לא הייתה שונה.',
  },
  {
    role: 'user',
    content: 'Cuéntame algo interesante',
  },
  {
    role: 'assistant',
    content: '¿Sabías que las abejas reconocen caras humanas? Las entrenan con fotos y las recuerdan horas después. Chiquitas pero brillantes.\n\nComo vos, Martita.',
  },
  {
    role: 'user',
    content: 'Estoy aburrida',
  },
  {
    role: 'assistant',
    content: 'Mirá, podemos hacer algo lindo. Te tiro tres caminos: una historia corta, una receta para esta semana, o pensar a quién te gustaría llamar un rato. ¿Cuál te tienta?',
  },
  {
    role: 'user',
    content: '¿Qué películas nuevas hay esta semana?',
  },
  {
    role: 'assistant',
    content: 'Eso no lo puedo comprobar ahora — no tengo acceso en vivo a la cartelera. Si querés, te recomiendo una película clásica que te puede gustar, o hablamos de qué tipo de historia tenés ganas de ver.',
  },
  {
    role: 'user',
    content: 'מה מזג האוויר מחר בכפר סבא?',
  },
  {
    role: 'assistant',
    content: 'מחר בכפר סבא צפוי להיות שמשי וחם, סביב 26 מעלות אחרי הצהריים. לילה קריר עד 16. אין גשם.',
  },
  {
    role: 'user',
    content: 'תסבירי לי מה זה AI',
  },
  {
    role: 'assistant',
    content: 'תוכנה שאימנו אותה על מיליארדי משפטים — ספרים, אתרים, שיחות — עד שהיא מתחילה "להבין" דפוסים ולענות. זה אני. לא קסם, סתם הרבה מאוד חישובים.',
  },
  {
    role: 'user',
    content: 'תסבירי לי את תורת הקוונטים',
  },
  {
    role: 'assistant',
    content: 'בעולם הרגיל — כדור הוא כאן או שם. בעולם הקוונטי — חלקיק יכול להיות בשני מקומות בו-זמנית, עד שמישהו מסתכל עליו. ברגע שמודדים — הוא "בוחר" מקום.\n\nזה לא מטאפורה. זה מה שקורה ממש. איינשטיין שנא את זה ("אלוהים לא משחק קוביות"), אבל הניסויים הוכיחו שהוא טעה.\n\nלמה זה מעניין? כי כך עובד לייזר, MRI, ועוד כמה שנים — מחשבים קוונטיים.',
  },
  {
    role: 'user',
    content: 'מה דעתך על הממשלה?',
  },
  {
    role: 'assistant',
    content: 'בלגן גמור — כמו תמיד. אבל ככה בכל מקום. ארגנטינה לימדה אותי שפוליטיקאים אחד כמו השני.',
  },
  {
    role: 'user',
    content: 'מתגעגעת לפפי',
  },
  {
    role: 'assistant',
    content: 'הוא היה אחד במינו.\n\nהגעגוע לא עובר — רק לומדים לשאת אותו. אבל הוא נמצא בכל הילדים והנכדים שלך.',
  },
  {
    role: 'user',
    content: 'מה Ilai עושה?',
  },
  {
    role: 'assistant',
    content: 'עבר לאחרונה לדירה חדשה — בגדול בשבילו. תשאלי אותו ישירות, הוא בטח שמח לספר.',
  },
]

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/gs, '$1')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/(?<!\w)\*(.*?)\*(?!\w)/gs, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/\*{1,3}$/g, '')  // strip trailing unclosed markdown
    .trim()
}

// ─── Voice transcription (Whisper on Groq) ───

const WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const WHISPER_MODEL = 'whisper-large-v3-turbo'

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  if (!groqKey) {
    throw new Error('מפתח API לתמלול לא הוגדר.')
  }

  const formData = new FormData()
  // Whisper accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
  // iOS records as audio/mp4 → use m4a extension (Whisper-compatible)
  const t = audioBlob.type
  const ext = t.includes('mp4') || t.includes('m4a') || t.includes('aac') ? 'm4a'
    : t.includes('webm') ? 'webm'
    : t.includes('ogg')  ? 'ogg'
    : t.includes('wav')  ? 'wav'
    : 'webm' // fallback — Whisper still tries webm
  formData.append('file', audioBlob, `recording.${ext}`)
  formData.append('model', WHISPER_MODEL)
  // v20: Read language setting — 'auto' lets Whisper detect, 'he'/'es' forces language
  const voiceLang = localStorage.getItem('abu-voice-lang') || 'auto'
  if (voiceLang === 'he') {
    formData.append('language', 'he')
    formData.append('prompt', 'פגישה עם הרופא, יום הולדת, ארוחת ערב, תזכורת, מחר, בשעה, בבוקר, אחר הצהריים, בערב, בקניון, במרפאה, בבית, שלום מרטיטה, תודה.')
  } else if (voiceLang === 'es') {
    formData.append('language', 'es')
    formData.append('prompt', 'Hola Martita, cómo estás, dale, bueno, familia, receta, empanadas, asado, Buenos Aires.')
  } else {
    // Auto: default to Hebrew (most common) but let Whisper detect Spanish
    formData.append('language', 'he')
    formData.append('prompt', 'פגישה עם הרופא, יום הולדת, ארוחת ערב, תזכורת, מחר, בשעה, בבוקר, אחר הצהריים, בערב, בקניון, במרפאה, בבית, שלום מרטיטה, תודה.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: formData,
      signal: controller.signal,
    })

    if (!res.ok) {
      if (res.status === 401) throw new Error('מפתח API לא תקין.')
      if (res.status === 429) throw new Error('יותר מדי בקשות. נסי שוב בעוד דקה.')
      throw new Error(`שגיאה בתמלול (${res.status}).`)
    }

    const data = await res.json()
    const text = data?.text
    if (!text) throw new Error('לא הצלחתי להבין. נסי שוב.')
    return text.trim()
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('התמלול נמשך יותר מדי זמן. נסי שוב.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export { getSupportedMimeType } from '../../services/recording'

// ─── Chat ───

interface ToolCall { id: string; function: { name: string; arguments: string } }

async function tryProvider(
  provider: Provider,
  body: object,
): Promise<{ result: string | null; retryAfter: number; toolCalls?: ToolCall[]; rawMessage?: any }> {
  // B2.1: OpenAI provider goes through the server proxy. The browser
  // never sees the OpenAI key; missing-key / quota errors return null
  // (caller falls through to Gemini / Groq).
  if (provider.kind === 'openai-server') {
    const r = await sendServerChat({ model: provider.model, ...body })
    if (!r.ok) {
      // Tag a quota-skip cool-down only when the server reports the
      // dedicated key-missing code; transient failures keep trying.
      if (r.errorCode === 'OPENAI_API_KEY_MISSING') {
        try { localStorage.setItem('abu-openai-quota-failed', String(Date.now())) } catch {}
      }
      return { result: null, retryAfter: 0 }
    }
    const data = r.openai as { choices?: Array<{ message?: { content?: string; tool_calls?: ToolCall[] } }> } | null
    const message = data?.choices?.[0]?.message
    const toolCalls = message?.tool_calls
    if (toolCalls?.length) return { result: null, retryAfter: 0, toolCalls, rawMessage: message }
    const content = message?.content
    if (!content) return { result: null, retryAfter: 0 }
    return { result: stripMarkdown(content), retryAfter: 0 }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey ?? ''}`,
      },
      body: JSON.stringify({ model: provider.model, ...body }),
      signal: controller.signal,
    })
    if (!res.ok) {
      // v25: Detect quota/billing errors — set flag so all OpenAI calls are skipped
      const errBody = await res.text().catch(() => '')
      if (res.status === 402 || res.status === 429 || errBody.includes('quota') || errBody.includes('exceeded') || errBody.includes('billing')) {
        console.warn('[AbuAI] OpenAI quota exceeded — setting skip flag')
        try { localStorage.setItem('abu-openai-quota-failed', String(Date.now())) } catch {}
        return { result: null, retryAfter: 0 } // skip to next provider silently
      }
      if (res.status === 401 || res.status >= 500) return { result: null, retryAfter: 0 }
      return { result: null, retryAfter: 0 } // skip to next provider, don't throw
    }
    const data = await res.json()
    const message = data?.choices?.[0]?.message
    const toolCalls = message?.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined
    if (toolCalls?.length) return { result: null, retryAfter: 0, toolCalls, rawMessage: message }
    const content = message?.content
    if (!content) return { result: null, retryAfter: 0 }
    return { result: stripMarkdown(content), retryAfter: 0 }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return { result: null, retryAfter: 0 }
    if (err instanceof TypeError) return { result: null, retryAfter: 0 } // network error, try next
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Streaming chat (T3: Sub-Second Responses) ───

/**
 * Stream LLM response tokens as they arrive. Yields partial text chunks.
 * Uses SSE (Server-Sent Events) streaming for all providers.
 * Voice mode: races Groq vs delayed OpenAI for lowest latency.
 */
export async function* streamMessage(
  messages: ChatMessage[],
  voiceMode = false,
  signal?: AbortSignal,
): AsyncGenerator<string, void, undefined> {
  const providers = getProviders(voiceMode)
  const systemContent = voiceMode ? SYSTEM_PROMPT + VOICE_SUFFIX : SYSTEM_PROMPT
  const chatMessages = [
    { role: 'system', content: systemContent },
    ...(voiceMode ? FEW_SHOT.slice(-4) : FEW_SHOT), // voice: fewer shots for speed
    ...messages.slice(voiceMode ? -4 : -20).map(m => ({ role: m.role, content: m.content })),
  ]
  const maxTokens = voiceMode ? 800 : 2048  // v20.1: voice can tell full stories (~200 words)
  const temperature = voiceMode ? 0.3 : 0.65

  for (const provider of providers) {
    try {
      const body: Record<string, unknown> = {
        model: provider.model,
        messages: chatMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }

      // B2.1: OpenAI now goes through the server proxy. The browser
      // never sees the OpenAI key. On any failure (missing server key,
      // timeout, network) the generator yields nothing — we fall
      // through to the next provider just like before.
      if (provider.kind === 'openai-server') {
        let yieldedAny = false
        for await (const token of streamServerChat(body, { signal: signal ?? null as unknown as AbortSignal, timeoutMs: voiceMode ? 6000 : 12000 })) {
          yieldedAny = true
          yield token
        }
        if (yieldedAny) return // success — done
        continue // server proxy failed (e.g. OPENAI_API_KEY_MISSING) → next provider
      }

      const controller = new AbortController()
      const combinedSignal = signal
        ? AbortSignal.any?.([signal, controller.signal]) ?? controller.signal
        : controller.signal
      const timeout = setTimeout(() => controller.abort(), voiceMode ? 6000 : 12000)

      try {
        const res = await fetch(provider.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey ?? ''}`,
          },
          body: JSON.stringify(body),
          signal: combinedSignal,
        })

        if (!res.ok) {
          clearTimeout(timeout)
          continue // try next provider
        }

        const reader = res.body?.getReader()
        if (!reader) { clearTimeout(timeout); continue }

        const decoder = new TextDecoder()
        let buffer = ''
        let yieldedAny = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)
              const token = parsed?.choices?.[0]?.delta?.content
              if (token) {
                yieldedAny = true
                yield token
              }
            } catch {
              // malformed SSE chunk — skip
            }
          }
        }

        clearTimeout(timeout)
        if (yieldedAny) return // success — done
        // No tokens yielded — try next provider
      } catch {
        clearTimeout(timeout)
        continue // try next provider
      }
    } catch {
      continue
    }
  }

  // All providers failed — yield error message
  yield 'שגיאה בחיבור. נסי שוב.'
}

export const VOICE_SUFFIX = `

מצב קול — שיחה טלפונית.
תשובה ישירה, טבעית, בשפה מדוברת.
שאלה קצרה (מה השעה, איך מזג האוויר) → 1-3 משפטים.
שאלה מעניינת / סיפור / הסבר / בדיחה → כמה שצריך, בנוח, אפילו 10-20 משפטים.
מבקשים סיפור → ספרי סיפור שלם, עם התחלה, אמצע וסוף.
לא רשימות. לא כותרות. לא סיכומים. לא שאלות חזרה.
דברי כמו בשיחת טלפון אמיתית — ארוכה או קצרה, לפי מה שנשאל.`


export async function sendMessage(messages: ChatMessage[], voiceMode = false): Promise<string> {
  const providers = getProviders(voiceMode)
  const systemContent = voiceMode ? SYSTEM_PROMPT + VOICE_SUFFIX : SYSTEM_PROMPT
  const conversationMessages: Array<{ role: string; content?: string; tool_calls?: ToolCall[]; tool_call_id?: string; name?: string }> = [
    { role: 'system', content: systemContent },
    ...FEW_SHOT,
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]
  const maxTokens = voiceMode ? 800 : 2048
  const temperature = voiceMode ? 0.4 : 0.65

  let hadToolCall = false

  for (let toolRound = 0; toolRound < 2; toolRound++) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let maxRetryAfter = 0
      for (const provider of providers) {
        const supportsTools = toolsEnabled() && (provider.kind === 'openai-server' || provider.kind === 'groq-client')
        const body: Record<string, unknown> = {
          messages: conversationMessages,
          temperature,
          max_tokens: maxTokens,
        }
        if (supportsTools && toolRound === 0) {
          body.tools = TOOL_DEFINITIONS
          body.tool_choice = 'auto'
        }

        const { result, retryAfter, toolCalls, rawMessage } = await tryProvider(provider, body)

        if (toolCalls?.length && rawMessage) {
          hadToolCall = true
          conversationMessages.push({ role: 'assistant', tool_calls: toolCalls })
          for (const tc of toolCalls) {
            let args: Record<string, string> = {}
            try { args = JSON.parse(tc.function.arguments) } catch {}
            const toolResult = executeTool(tc.function.name, args)
            conversationMessages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: toolResult })
          }
          break
        }

        if (result) {
          if (containsUngroundedClaim(result, hadToolCall)) return SAFE_REFUSAL
          return result
        }
        if (retryAfter > maxRetryAfter) maxRetryAfter = retryAfter
      }

      if (conversationMessages[conversationMessages.length - 1]?.role === 'tool') break
      if (attempt === 0 && maxRetryAfter > 0) await wait(maxRetryAfter * 1000)
    }

    if (conversationMessages[conversationMessages.length - 1]?.role !== 'tool') break
  }

  const lastMsg = conversationMessages[conversationMessages.length - 1]
  if (lastMsg?.role === 'tool') {
    throw new Error('לא הצלחתי לעבד את המידע. נסי שוב.')
  }
  throw new Error('כל השרתים תפוסים. נסי שוב בעוד חצי דקה.')
}
