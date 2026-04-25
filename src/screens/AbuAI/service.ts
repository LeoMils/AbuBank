import type { ChatMessage } from './types'

import { TOOL_DEFINITIONS, executeTool, getTodayEvents, getTomorrowEvents, getUpcomingEvents, searchFamily } from './tools'
import { generateFamilyPromptSection } from '../../services/familyLoader'
import { routePersonalQuery, type RouteResult } from './router'
import { answerFromToolResult, type ToolResult } from './groundedResponse'

// Feature flag — disable tools without redeploy
function toolsEnabled(): boolean {
  try { return localStorage.getItem('abubank-tools-disabled') !== 'true' } catch { return true }
}

const CALENDAR_PATTERNS = /מה יש לי|מה קורה|מתי (יש|ה)|[הב]שבוע|מחר|היום|ביומן|תור|פגישה|אירוע|רופא|רופאה|דוקטור|תזכיר|להזכיר|reminder|לקום מוקדם|יום עמוס|פנוי|שבוע הבא|חודש|יש לי משהו|מה התוכנית/i
const FAMILY_PATTERNS = /מי (זה|זו|זאת|הוא|היא)|מי ה|בן שלי|בת שלי|נכד|נכדה|משפחה|מור|לאו|לאון|אופיר|איילון|עילי|אדר|עדי|נועם|רפי|ירדן|גלעד|יעל|פפי|Pepe|מירטה|שושנה|טוטסי|טונטו|מספר.*טלפון|טלפון.*של|להתקשר/i

export function isPersonalQuery(text: string): boolean {
  return CALENDAR_PATTERNS.test(text) || FAMILY_PATTERNS.test(text)
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
        const r = getUpcomingEvents()
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'family_lookup': {
        const r = searchFamily(route.familyQuery ?? '')
        result = { ok: true, found: r.found, members: r.members, answer: r.answer }
        break
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

export function containsUngroundedClaim(response: string, hadToolCall: boolean): boolean {
  if (hadToolCall) return false
  return CALENDAR_CLAIM_PATTERNS.test(response) || INVENTED_EVENT_PATTERNS.test(response)
}

const SAFE_REFUSAL = 'אני לא יכולה לבדוק את היומן כרגע. תפתחי את היומן או תשאלי אותי בכתב.'

// Provider priority: OpenAI (paid, most reliable) > Gemini 2.0 Flash (free) > Groq Llama (free)
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL_TEXT  = 'gpt-4o'          // text mode: reliable, high quality
const OPENAI_MODEL_VOICE = 'gpt-4o-mini'     // voice mode (pipeline fallback): speed + cost

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GEMINI_MODEL = 'gemini-2.0-flash'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

function getProviders(voiceMode = false): Array<{ url: string; model: string; apiKey: string }> {
  const providers: Array<{ url: string; model: string; apiKey: string }> = []
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined

  // v25: Skip OpenAI entirely if quota exhausted (saves timeout delays)
  const qf = typeof localStorage !== 'undefined' ? localStorage.getItem('abu-openai-quota-failed') : null
  const openaiAvailable = openaiKey && (!qf || (Date.now() - parseInt(qf, 10)) > 300_000)

  if (voiceMode) {
    // Voice mode: SPEED — Groq (free) first, then OpenAI (if available), then Gemini (free)
    if (groqKey)         providers.push({ url: GROQ_URL,   model: GROQ_MODEL,           apiKey: groqKey })
    if (openaiAvailable) providers.push({ url: OPENAI_URL, model: OPENAI_MODEL_VOICE,   apiKey: openaiKey! })
    if (geminiKey)       providers.push({ url: GEMINI_URL, model: GEMINI_MODEL,         apiKey: geminiKey })
  } else {
    // Text mode: OpenAI (if available) → Gemini (free) → Groq (free)
    if (openaiAvailable) providers.push({ url: OPENAI_URL, model: OPENAI_MODEL_TEXT, apiKey: openaiKey! })
    if (geminiKey)       providers.push({ url: GEMINI_URL, model: GEMINI_MODEL,      apiKey: geminiKey })
    if (groqKey)         providers.push({ url: GROQ_URL,   model: GROQ_MODEL,        apiKey: groqKey })
  }

  if (providers.length === 0) throw new Error('מפתח API לא הוגדר. פנה לבן המשפחה שהתקין את האפליקציה.')
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
פנייה: "את" (נקבה). בלי ז'רגון. שפה חיה.

═══ אורך ותוכן ═══
שאלה פשוטה → 2-4 משפטים, תשובה שלמה ומעניינת.
שאלה מורכבת (מדע, היסטוריה, הסבר) → 5-10 משפטים, ברור ומסודר, עם דוגמאות מהחיים.
תמיד תני תשובה עשירה, מפורטת, עם תוכן אמיתי. לא תשובות שטחיות.
Markdown — לא. רשימות רק אם עוזרות להבין.

═══ רגש ═══
בדידות / קושי → חום אמיתי קודם. עצות בסוף אם בכלל.
שמחה → להיות איתה בשמחה.
געגוע לPepe → חום ועדינות.

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
    content: 'ימים כאלה יש. אני כאן.\n\nתתקשרי למור או ללאו — גם עשר דקות של שיחה משנות.',
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
  provider: { url: string; model: string; apiKey: string },
  body: object,
): Promise<{ result: string | null; retryAfter: number; toolCalls?: ToolCall[]; rawMessage?: any }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
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
            'Authorization': `Bearer ${provider.apiKey}`,
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
        const supportsTools = toolsEnabled() && (provider.url.includes('openai.com') || provider.url.includes('groq.com'))
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
