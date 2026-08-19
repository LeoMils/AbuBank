/*
 * AbuCalendar P0.7 — quality-first Hebrew transcription.
 *
 * Phone QA after PR #34: voice recording reaches transcription, but
 * names and places come back wrong ("אופיר" → "אפיר", "פתח תקווה" →
 * "פתח תיקווה / קלילה"). Root cause: AbuAI's shared `transcribeAudio`
 * uses Groq's `whisper-large-v3-turbo` (speed-tier) with a short
 * generic prompt and the default `json` response format — no
 * confidence metadata, no domain vocabulary, no fallback.
 *
 * This module is a CALENDAR-LOCAL transcribe — it does not touch the
 * shared AbuAI service so general AbuAI voice mode is unaffected.
 *
 *   Quality-first config:
 *     • model: whisper-large-v3 (accuracy-first)
 *     • temperature: 0
 *     • response_format: verbose_json (avg_logprob, no_speech_prob,
 *       compression_ratio, segments)
 *     • prompt: Hebrew calendar domain vocabulary with family names
 *       and Israeli places relevant to Martita.
 *     • fallback: whisper-large-v3-turbo if v3 fails (rate-limit /
 *       model-down) — the fallback flag is captured in the trace.
 *
 * No secrets read or logged. NO client-side provider key: the key resolver defaults to
 * undefined (this Groq client-STT path is not user-wired). Tests inject a key/fetch. A real
 * calendar-voice wiring must route through the server STT proxy (/api/abuai-stt).
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const QUALITY_MODEL = 'whisper-large-v3'
const FALLBACK_MODEL = 'whisper-large-v3-turbo'
const REQUEST_TIMEOUT_MS = 18_000

export type CalendarLanguageHint = 'he' | 'es' | 'en'

/** Concise Hebrew calendar-domain prompt. Keep well below Groq's
 *  ~224 token limit. Family names + Israeli places + common calendar
 *  vocabulary nudge the model toward correct spellings.
 *
 *  Verb hint + an explicit "do not substitute" instruction counter-balance
 *  the place-context bias that caused "תקבעי" (the command verb) to be
 *  mis-heard as "תקווה" (the city). Without the verb prior, Whisper had
 *  no strong reason to prefer the verb over the place. */
const HEBREW_DOMAIN_PROMPT = [
  'זו הקלטה קצרה בעברית לקביעת פגישה ביומן.',
  'נא לתמלל בדיוק את מה שנאמר. אל תמירי מילים דומות בשמיעה.',
  'פעלים נפוצים בתחילת המשפט: תקבעי, תקבע, קבעי, תזכירי, תזכיר, שימי, תוסיפי, תכניסי, תרשמי.',
  'שמות אפשריים: לאו, אופיר, גלעד, אילון, מור, מרטיטה, רפי, יעל, נועם, עדי, אדר, עילי, ירדן, אנאבל, ארי, פפי.',
  'מקומות אפשריים: פתח תקווה, כפר סבא, תל אביב, הרצליה, רעננה, הוד השרון, ירושלים.',
  'מילים נפוצות: מחר, היום, פגישה, תור, רופא, רופאה, ארוחת ערב, יום הולדת, בעשר בבוקר, בארבע אחר הצהריים, בערב.',
].join(' ')

const SPANISH_DOMAIN_PROMPT = [
  'Grabación corta en español rioplatense para una cita de calendario.',
  'Nombres posibles: Leo, Mor, Rafi, Gilad, Ofir, Ayalon, Mor, Martita, Pepi.',
  'Lugares: Petah Tikva, Kfar Saba, Tel Aviv, Herzliya, Hod HaSharon.',
  'Palabras frecuentes: mañana, hoy, reunión, médico, médica, a las diez de la mañana, a las cuatro de la tarde.',
].join(' ')

const ENGLISH_DOMAIN_PROMPT = [
  'Short English recording for a calendar appointment.',
  'Possible names: Leo, Mor, Rafi, Gilad, Ofir, Ayalon, Martita, Pepi.',
  'Possible places: Petah Tikva, Kfar Saba, Tel Aviv, Herzliya.',
  'Common words: tomorrow, today, meeting, doctor, at ten in the morning, at four in the afternoon.',
].join(' ')

function promptFor(lang: CalendarLanguageHint): string {
  if (lang === 'es') return SPANISH_DOMAIN_PROMPT
  if (lang === 'en') return ENGLISH_DOMAIN_PROMPT
  return HEBREW_DOMAIN_PROMPT
}

export interface CalendarTranscribeOptions {
  /** Default 'he' (Martita/Leo flow). */
  languageHint?: CalendarLanguageHint
  /** Override the timeout for tests. */
  timeoutMs?: number
  /** Inject a fetch impl for tests. */
  fetchImpl?: typeof fetch
  /** Inject a key resolver for tests (avoids reading import.meta.env at unit-test time). */
  resolveKey?: () => string | undefined
}

export interface CalendarTranscribeResult {
  /** Final transcript (raw — domain correction happens in a separate module). */
  text: string
  /** Same as text. Renamed for clarity in the trace card. */
  rawText: string
  /** Which Groq model produced this transcript. */
  model: string
  /** Effective language sent to the model. */
  languageHint: CalendarLanguageHint
  /** Whether the fallback path was used. */
  asrFallbackUsed: boolean
  /** verbose_json metadata when available. */
  avgLogprob?: number
  noSpeechProb?: number
  compressionRatio?: number
}

function extToken(blobType: string): string {
  const t = (blobType || '').toLowerCase()
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'm4a'
  if (t.includes('webm')) return 'webm'
  if (t.includes('ogg')) return 'ogg'
  if (t.includes('wav')) return 'wav'
  return 'webm'
}

function buildFormData(audioBlob: Blob, model: string, lang: CalendarLanguageHint): FormData {
  const fd = new FormData()
  fd.append('file', audioBlob, `recording.${extToken(audioBlob.type)}`)
  fd.append('model', model)
  fd.append('language', lang)
  fd.append('prompt', promptFor(lang))
  fd.append('temperature', '0')
  fd.append('response_format', 'verbose_json')
  return fd
}

interface VerboseJsonShape {
  text?: string
  language?: string
  /** Whisper's per-segment confidence metadata. */
  segments?: Array<{
    text?: string
    avg_logprob?: number
    no_speech_prob?: number
    compression_ratio?: number
  }>
}

function avgFromSegments(segments: VerboseJsonShape['segments'], key: 'avg_logprob' | 'no_speech_prob' | 'compression_ratio'): number | undefined {
  if (!segments || segments.length === 0) return undefined
  const vals = segments
    .map((s) => s[key])
    .filter((v): v is number => typeof v === 'number' && isFinite(v))
  if (vals.length === 0) return undefined
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

class TranscribeError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); this.name = 'TranscribeError' }
}

async function callGroq(
  audioBlob: Blob,
  model: string,
  lang: CalendarLanguageHint,
  apiKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<{ text: string; metadata: { avgLogprob?: number; noSpeechProb?: number; compressionRatio?: number } }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: buildFormData(audioBlob, model, lang),
      signal: controller.signal,
    })
    if (!res.ok) {
      if (res.status === 401) throw new TranscribeError('מפתח API לא תקין.', 401)
      if (res.status === 429) throw new TranscribeError('יותר מדי בקשות. נסי שוב בעוד דקה.', 429)
      throw new TranscribeError(`שגיאה בתמלול (${res.status}).`, res.status)
    }
    const data = (await res.json()) as VerboseJsonShape
    const text = (data?.text ?? '').toString().trim()
    if (!text) throw new TranscribeError('לא הצלחתי להבין. נסי שוב.')
    const metadata: { avgLogprob?: number; noSpeechProb?: number; compressionRatio?: number } = {}
    const avg = avgFromSegments(data.segments, 'avg_logprob')
    const nsp = avgFromSegments(data.segments, 'no_speech_prob')
    const cmp = avgFromSegments(data.segments, 'compression_ratio')
    if (typeof avg === 'number') metadata.avgLogprob = avg
    if (typeof nsp === 'number') metadata.noSpeechProb = nsp
    if (typeof cmp === 'number') metadata.compressionRatio = cmp
    return { text, metadata }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TranscribeError('התמלול נמשך יותר מדי זמן. נסי שוב.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** Quality-first Hebrew Whisper transcription with one retry on a
 *  faster fallback model. Throws the same Hebrew error strings as the
 *  shared service so the existing catch-block translation in
 *  AbuCalendar/index.tsx (P0.5) keeps working unchanged. */
export async function transcribeCalendarAudio(
  audioBlob: Blob,
  options: CalendarTranscribeOptions = {},
): Promise<CalendarTranscribeResult> {
  // NO client-side provider secret. The default resolver returns undefined — the Groq
  // client-STT path here is NOT user-wired (only tests inject a key). Any production wiring
  // of calendar voice STT must route through the server proxy (/api/abuai-stt, OPENAI_API_KEY
  // server-only), never a client-exposed VITE_ key. (P0 remediation: zero client secrets.)
  const resolveKey = options.resolveKey ?? (() => undefined)
  const apiKey = resolveKey()
  if (!apiKey) throw new Error('מפתח API לתמלול לא הוגדר.')

  const lang: CalendarLanguageHint = options.languageHint ?? 'he'
  const fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null)
  if (!fetchImpl) throw new Error('fetch is not available in this runtime.')
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS

  function build(text: string, model: string, fallback: boolean, meta: { avgLogprob?: number; noSpeechProb?: number; compressionRatio?: number }): CalendarTranscribeResult {
    const out: CalendarTranscribeResult = {
      text, rawText: text, model, languageHint: lang, asrFallbackUsed: fallback,
    }
    if (typeof meta.avgLogprob === 'number') out.avgLogprob = meta.avgLogprob
    if (typeof meta.noSpeechProb === 'number') out.noSpeechProb = meta.noSpeechProb
    if (typeof meta.compressionRatio === 'number') out.compressionRatio = meta.compressionRatio
    return out
  }

  // Quality-first attempt.
  try {
    const r = await callGroq(audioBlob, QUALITY_MODEL, lang, apiKey, fetchImpl, timeoutMs)
    return build(r.text, QUALITY_MODEL, false, r.metadata)
  } catch (err) {
    // Only fall back when the upstream signalled a transient issue
    // (rate limit / model unavailable / 5xx). 401 / abort / parse
    // errors should still surface to the user.
    const transient = err instanceof TranscribeError
      && err.status !== undefined
      && (err.status === 429 || err.status === 503 || err.status === 502 || err.status === 500)
    if (!transient) throw err
    const r2 = await callGroq(audioBlob, FALLBACK_MODEL, lang, apiKey, fetchImpl, timeoutMs)
    return build(r2.text, FALLBACK_MODEL, true, r2.metadata)
  }
}
