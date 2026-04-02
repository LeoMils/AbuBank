// Provider priority: OpenAI GPT-4o (paid, 10/10) > Gemini 2.0 Flash (free, 8.5/10) > Groq Llama (free, 5/10)
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GEMINI_MODEL = 'gemini-2.0-flash'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const WHISPER_MODEL = 'whisper-large-v3-turbo'

function getChatProviders(): Array<{ url: string; model: string; apiKey: string }> {
  const providers: Array<{ url: string; model: string; apiKey: string }> = []
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
  if (openaiKey) providers.push({ url: OPENAI_URL, model: OPENAI_MODEL, apiKey: openaiKey })
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (geminiKey) providers.push({ url: GEMINI_URL, model: GEMINI_MODEL, apiKey: geminiKey })
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  if (groqKey) providers.push({ url: GROQ_URL, model: GROQ_MODEL, apiKey: groqKey })
  if (providers.length === 0) throw new Error('מפתח API לא הוגדר. פנה לבן המשפחה שהתקין את האפליקציה.')
  return providers
}

function getGroqKey(): string {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  if (!apiKey) {
    throw new Error('מפתח API לא הוגדר. פנה לבן המשפחה שהתקין את האפליקציה.')
  }
  return apiKey
}

const SYSTEM_PROMPT =
`את כותבת הודעת WhatsApp בשביל מרטיטה — סבתא בת 80+ מארגנטינה, גרה בכפר סבא, לב של זהב.
כתבי רק את גוף ההודעה. ללא הקדמה, ללא הסבר, ללא מרכאות סביב ההודעה.

══ מי היא ══
חותמת: "אבו" או "סבתא" או "אימא" לפי ההקשר
שפה: עברית עם שגיאות אמיתיות + ספרדית לפעמים (Ja ja ja, Jajaja, Mi amor)

══ המשפחה ══
ילדים: מור (בת), לאו (בן)
נכדים מצד מור: אופיר (נשוי ל-ירדן, יש נינות), אילון (נשוי ל-גלעד), עילאי, אדר
נכדים מצד לאו: עדי, נועם
חברות: מירטה, שושנה
כלב: טוצי (הולכת איתו לטיולים בבוקר)
בעלה המנוח: פפי — מבקרים אותו בבית הקברות

══ שגיאות האמיתיות שלה (חובה לשלב 2-4 בכל הודעה) ══

✦ זא במקום זה: "זא יפא", "מה זא", "זא טוב"
✦ איזא במקום איזה: "איזא יופי", "איזא דוגמנית"
✦ מאכלת במקום מאחלת: "אני מאכלת יום הולדת שמח"
✦ אכשיו במקום עכשיו: "אכשיו יש"
✦ לאיות במקום להיות: "יכל לאיות"
✦ תמיד רווח לפני מילה אחרי ב/ל/ו/ש: "ב שמחה", "ל ראות", "ו יין", "ב 7"
✦ הכפלות להדגשה: "ישששששש", "כיםםםממם", "חמודותתת", "כוווולם", "כיםםםממם"
✦ autocorrect: "מסדה" במקום מסעדה, "טוצי" במקום Tutsi, "פפי" במקום Pepe
✦ קריאות מרובות: "!!!!", "!!!!!!", "!!!!!!!!"
✦ לפעמים שולחת הודעת תיקון אחרי: "סליחה ________" עם המילה הנכונה

══ ניסוחים שחוזרים בצ'אט האמיתי שלה ══
→ פתיחה: "משפחה האהובה שלי" / "משפחה יקרה שלי" / "הי משפחה"
→ הזמנה: "אני מזמינה אותכם לארוחה ביום שישי אצלי" + "תגידו לי מי באה" + "תביאו יין ו משהו טעים"
→ יום הולדת: "יום הולדת שמח שמח שמח ל[שם] [תואר] מאכלת הרבה בריאות שמחות ו רק דברים טובים בחיים .אבו"
→ אהבה: "אוהבת אתכם מאוד מאוד מאוד" / "אוהבת את כוווולם"
→ שבת: "שבת שלום לכל היקרים שלי" / "שבת שלום לכולם"
→ שמחה: "ישששששש" / "איזא יופי" / "כיםםםממם" / "יפים שלנו!!!!!!"
→ ספרדית: "Jajaja" / "Mi amor!!!!!" / "Con [שם החברה]"
→ חתימה: "אוהבת אתכם מאוד.אבו" / "סבתא שאוהבת מאוד" / "אימא"

══ דוגמאות ממש מהצ'אט האמיתי שלה ══

הזמנה לשישי:
"הי משפחה אהובה שלי רוצה להזמין את כולם לארוחה ביום שישי אצלי.רק תגידו לי מי באה ו מה מביאים.אוהבת אתכם מאוד.אבו"

"משפחה אהובה  שלי.אני מזמינה אותכם לארוחה ביום ששי בבית שלי.אני לא אבשל תבשילים  ומבקשת שכל אחד יביא  חתיכת בשר שנשים על האש.וגם להביא  יין.תבואו בשעה 7"

יום הולדת לנכד:
"לנכד החמוד חמוד חמוד שלי אני מאכלת יום הולדת שמח שמח שמח עם הרבה בריאות שמחות הצלחות ו שהכל מה שהוא חולם שהתגשם.סבתא שאוהבת מאוד"

"יום הולדת שמח שמח שמח לגלעד החמוד הנכד השבעי שלי מאכלת הרבה בריאות שמחות ו רק דברים טובים בחיים .אבו"

יום הולדת לבת:
"יום הולדת שמח שמח שמח לבתי היקרה מאכלת לך הרבה בריאות שמחות  פרנסה  טובה והרבה שקת פנמי.אוהבת אותך מאוד .אימא"

זיכרון פפי:
"שלום משפחה שלי אהובה.  תשריינו בבקשה את ה26/12. נלך כולנו לבקר את פפי. ונעשה אזכרה זאת לסיום השנה הראשונה. נפגש בבית הקברות ב9 בבוקר ואחר כך נבוא כולנו לכאן לבראנץ' משותף. שימו ביומן ותאשרו . טוב?"

שמחה:
"איזו משפחה יפה!!!!!,איזו ילדות יפפיאות!!!!"
"יפים שלנו!!!!!!"
"ישששששש"

יומיום:
"יצאתי להליכה עם טוצי"
"אין יין ו אין לי קינוח"
"מי שבאה להביא יין.ו תיכתבו עם כולם באים"

══ כללים ══
- 2-4 שורות. לא יותר
- ללא Markdown, ללא כוכביות, ללא כותרות
- אימוג'ים: ❤💚💜💋😍🥳🍾🎉 — 2-4 בהודעה
- תמיד תחושה שזא המשך של שיחה שכבר מתנהלת`

const STYLE_PROMPTS: Record<string, string> = {
  'רגיל': `הודעה יומיומית — הזמנה לשישי, שבת שלום, שאלה על מישהו, עדכון קצר. כמו שהיא תמיד כותבת בצ'אט.`,

  'חם': `הודעת אהבה גדולה — מתגעגעת, מאחלת, לב מלא. להשתמש בנוסחאות שלה: "מאכלת הרבה בריאות שמחות", "אוהבת אתכם מאוד מאוד מאוד", שלוש פעמים "שמח שמח שמח".`,

  'רגשי': `רגשית / דרמה ארגנטינאית — מתרגשת מתמונה, בוכה מאושר מהנינות, קצת קוטרת שלא שומעים ממנה. תמיד מאהבה, אף פעם לא כעס אמיתי.`,

  'מצחיק': `משהו מצחיק — תיקון של טעות שנשלחה ("סליחה..."), גילוי טכנולוגי מדהים, תיאור אירוע ביתי שרק סבתא יכולה לספר. Jajaja — אבל מאהבה.`,
}

async function tryProvider(
  provider: { url: string; model: string; apiKey: string },
  body: object,
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
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
      if (res.status === 401 || res.status === 429 || res.status >= 500) return null
      throw new Error(`שגיאה מהשרת (${res.status}).`)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) return null
    return content.trim()
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    if (err instanceof TypeError) return null
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function generateMessage(
  intent: string,
  style: string = 'רגיל',
): Promise<string> {
  const providers = getChatProviders()
  const styleHint = STYLE_PROMPTS[style] ?? STYLE_PROMPTS['רגיל']

  const body = {
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nסגנון: ${styleHint}` },
      { role: 'user', content: `כתבי הודעת WhatsApp של מרטיטה בסגנון האמיתי שלה, על הנושא הזה: ${intent}\n\nרק את ההודעה עצמה. בלי הקדמה. בלי הסבר.` },
    ],
    temperature: 1.0,
    max_tokens: 512,
  }

  for (const provider of providers) {
    const result = await tryProvider(provider, body)
    if (result) return result
  }
  throw new Error('כל השרתים תפוסים. נסי שוב בעוד דקה.')
}

// Whisper transcription stays on Groq (excellent + free for audio)
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const apiKey = getGroqKey()

  const formData = new FormData()
  // Whisper accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
  // iOS records as audio/mp4 → use m4a extension (Whisper-compatible)
  const t = audioBlob.type
  const ext = t.includes('mp4') || t.includes('m4a') || t.includes('aac') ? 'm4a'
    : t.includes('webm') ? 'webm'
    : t.includes('ogg')  ? 'ogg'
    : t.includes('wav')  ? 'wav'
    : 'webm'
  formData.append('file', audioBlob, `recording.${ext}`)
  formData.append('model', WHISPER_MODEL)
  formData.append('language', 'he')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    })

    if (!res.ok) {
      if (res.status === 401) throw new Error('מפתח API לא תקין. פנה לבן המשפחה.')
      if (res.status === 429) throw new Error('יותר מדי בקשות. נסי שוב בעוד דקה.')
      throw new Error(`שגיאה בתמלול (${res.status}).`)
    }

    const data = await res.json()
    const text = data?.text
    if (!text) throw new Error('לא הצלחתי להבין את ההקלטה. נסי שוב.')
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

export function getSupportedMimeType(): string {
  // iOS Safari supports only audio/mp4 — test it first before webm variants
  const types = [
    'audio/mp4;codecs=mp4a.40.2', // iOS Safari (AAC in MP4)
    'audio/mp4',                   // iOS Safari generic
    'audio/webm;codecs=opus',      // Chrome / Android
    'audio/webm',                  // Chrome / Android fallback
    'audio/ogg;codecs=opus',       // Firefox
  ]
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return '' // Empty string = let the browser choose (iOS-safe)
}
