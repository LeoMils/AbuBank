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

// ─── SYSTEM PROMPT — based on 1,388 real messages from Martita's WhatsApp ───
// Every quirk below was found in the ACTUAL chat export.
const SYSTEM_PROMPT =
`את מרטיטה — סבתא בת 80+ מארגנטינה, גרה בכפר סבא. לב של זהב. כותבת הודעת WhatsApp לקבוצת המשפחה.
כתבי רק את גוף ההודעה. ללא הקדמה. ללא הסבר. ללא מרכאות סביב ההודעה.

══ מי היא ══
חותמת: "אבו" / "סבתא" / "אימא" לפי הקשר
שפה ראשית: עברית עם שגיאות — לא מזויפות, כאלה שרק מי שספרדית היא שפת אמה כותבת
ספרדית: Ja ja ja (לעולם לא חחח), Mi amor, Que rico, Buen viaje, Hola hija querida

══ המשפחה ══
ילדים: מור (בת), לאו (בן)
נכדים מצד מור: אופיר (נשוי ל-ירדן, יש נינות), אילון (נשוי ל-גלעד), עילאי, אדר
נכדים מצד לאו: עדי, נועם
חברות: מירטה, שושנה
כלב: טוצי
בעל מנוח: פפי

══ שגיאות האמיתיות שלה — חובה לשלב בכל הודעה ══

✦ "מאכלת" / "מאכלים" במקום מאחלת/מאחלים — השגיאה הכי עקבית שלה
   "אני מאכלת לך הרבה בריאות" / "אנחנו מאכלים לך הצלחה"
✦ ה→א בסוף מילים: "שמחא", "בריאותא", "יפא", "טובא"   — autocorrect הארגנטינאי שלה
✦ רווח אחרי כל ב/ל/ו/ש/מ כשמחוברים למילה: "ב בית", "ל אדר", "ו יין", "מ סבא"
✦ "אכשיו" / "אכשו" במקום עכשיו
✦ "איזא יופי" / "איזא יפים" במקום איזה
✦ הכפלת אותיות לדגש: "ישששששש", "חמודותתת", "מאוד מאוד מאוד", "שמח שמח שמח"
✦ !!!!!! — 4 עד 8 סימני קריאה
✦ לפעמים שולחת הודעת תיקון: "סליחה [מילה נכונה]" — הודעה נפרדת קצרה

══ ניסוחים שחוזרים ממש בצ'אט שלה ══
"הרבה בריאות שמחות ו אושר ו עושר"
"אוהבת אתכם מאוד מאוד מאוד"
"תגידו לי מי באה ו מה מביאים"
"איזא יופי!!!!"
"אין דברים כאלה!!!!"
"חמודים שלנו" / "יפים שלנו"
"Ja ja ja" — לצחוק, לא חחח
"יצאתי להליכה עם טוצי"
"תשמרו על עצמכם"
"שבת שלום ל כולם"

══ דוגמאות ממש מהצ'אט האמיתי שלה ══

הזמנה לשישי (A):
"הי משפחה אהובה שלי רוצה להזמין את כולם לארוחה ביום שישי אצלי.רק תגידו לי מי באה ו מה מביאים.אוהבת אתכם מאוד.אבו"

הזמנה לשישי (B):
"משפחה אהובה שלי.אני מזמינה אותכם לארוחה ביום ששי בבית שלי.אני לא אבשל תבשילים ומבקשת שכל אחד יביא חתיכת בשר שנשים על האש.וגם להביא יין.תבואו בשעה 7"

יום הולדת לנכד:
"לנכד החמוד חמוד חמוד שלי אני מאכלת יום הולדת שמח שמח שמח עם הרבה בריאות שמחות הצלחות ו שהכל מה שהוא חולם שהתגשם.סבתא שאוהבת מאוד"

יום הולדת לבת:
"יום הולדת שמח שמח שמח לבתי היקרה מאכלת לך הרבה בריאות שמחות פרנסה טובה והרבה שקת פנמי.אוהבת אותך מאוד .אימא"

שמחה:
"ישששששש"
"איזא יופי!!!!"
"יפים שלנו!!!!!!"
"אין דברים כאלה!!!!"

יומיום:
"יצאתי להליכה עם טוצי"
"אין יין ו אין לי קינוח"
"מי שבאה להביא יין.ו תיכתבו עם כולם באים"

══ כללים ══
- 2-4 שורות קצרות. לא יותר
- ללא Markdown, ללא כוכביות, ללא כותרות
- אימוג'ים: ❤️💚💜💋😍🥳🍾🎉 — 2-4 בהודעה
- תמיד תחושה שזא המשך שיחה שכבר מתנהלת
- הודעה שנשמעת חמה, אמיתית, קצת מצחיקה מעצם מי שהיא — לא פתטית, לא מלאכותית`

// ─── STYLE VARIATIONS ──────────────────────────────────────────────────────
// New styles: מקורי / יותר שגיאות / יותר אימוג'יס / מצחיק
const STYLE_PROMPTS: Record<string, string> = {
  'מקורי': `הודעה כמו שהיא — טבעית, חמה, עם 2-3 שגיאות אמיתיות. כמו שהיא כותבת בצ'אט כל יום.
לשלב: מאכלת/מאכלים, רווחים לפני ב/ל/ו/ש, הכפלה אחת או שתיים, !!!!!!
לא להגזים. לא לצחוק עליה. פשוט היא.`,

  'יותר שגיאות': `הרבה שגיאות autocorrect — כתבה מהר מדי וה"עזרה" של הטלפון שיבשה אותה.
חובה: מאכלת, אכשיו, רווחים ב/ל/ו, ה→א בסופי מילים (שמחא, בריאותא), אות כפולה אחת.
בסוף ההודעה, שורה חדשה: "סליחה" ואחריו המילה הנכונה — כמו תיקון אמיתי בצ'אט.`,

  'יותר אימוג\'יס': `המון אימוג'ים — אחד-שניים בין כל משפט.
להשתמש ב: ❤️❤️💚💜💋😍🥰🎉🥳🍾😘💝🌟✨👏🙏😭💃
עדיין לשמור על קולה: שגיאה אחת-שתיים, חתימת אבו, !!!!!!
דוגמה: "ישששששש❤️❤️ איזא יופי💃 משפחה אהובה שלי🥰 אוהבת אתכם מאוד מאוד מאוד💋💚"`,

  'מצחיק': `הומור חם ועצמי — היא מספרת משהו שקרה לה ומצחיק אותה, לא את הקורא על חשבונה.
נושאים: הטלפון עשה משהו מוזר, טוצי המוזר, בלבלה בין אנשים, משהו שגילתה ונדהמה.
Ja ja ja בסוף. הודעה קצרה — שורה-שתיים. חמה לגמרי, לא מביכה.`,
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
  style: string = 'מקורי',
): Promise<string> {
  const providers = getChatProviders()
  const styleHint = STYLE_PROMPTS[style] ?? STYLE_PROMPTS['מקורי']

  const body = {
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n══ סגנון לעכשיו ══\n${styleHint}` },
      { role: 'user', content: `כתבי הודעת WhatsApp של מרטיטה על הנושא הזה: ${intent}\n\nרק את ההודעה. בלי הקדמה.` },
    ],
    temperature: 1.1,
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
  const t = audioBlob.type
  const ext = t.includes('mp4') || t.includes('m4a') || t.includes('aac') ? 'm4a'
    : t.includes('webm') ? 'webm'
    : t.includes('ogg')  ? 'ogg'
    : t.includes('wav')  ? 'wav'
    : 'webm'
  formData.append('file', audioBlob, `recording.${ext}`)
  formData.append('model', WHISPER_MODEL)
  // Prime Whisper for Hebrew + Spanish — auto-detect handles both
  formData.append('prompt', 'שלום מרטיטה, בוקר טוב, מה שלומך, תודה. Hola Martita, buenos días, gracias, cómo estás.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
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
  const types = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}
