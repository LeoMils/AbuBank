// ─── Text-to-Speech ─────────────────────────────────────────
// Priority: 1) Azure TTS REST API (HilaNeural/ElenaNeural — needs VITE_AZURE_TTS_KEY)
//           2) Edge TTS WebSocket (same voices, unofficial fallback)
//           3) Gemini TTS (Aoede — human but not Israeli/Argentine)
//           4) Google Translate TTS  5) Web Speech API

import { getVoiceProfile, getEffectiveRate, describeVoiceConfig, type VoiceLang } from './voiceConfig'

// v20: Read user voice settings from Settings screen.
// Rate is language-tuned in voiceConfig (warm but not "old"); a saved user
// override still wins, clamped to a non-robotic range.
function getVoiceSpeed(lang: VoiceLang = 'he'): number {
  let override: number | null = null
  try {
    const saved = localStorage.getItem('abu-voice-speed')
    if (saved) override = parseFloat(saved)
  } catch {}
  return getEffectiveRate(lang, override)
}

let currentAudio: HTMLAudioElement | null = null
let _currentAudioSource: AudioBufferSourceNode | null = null // v20.1: track for stopSpeaking

// ── Playback proof (P0-1) ────────────────────────────────────────────────────
// Incremented ONLY when real TTS audio actually started playing (an <audio>
// element or an AudioContext BufferSource fired). This is the automated
// "voice was audible" signal a Preview/browser test can assert — a visible-text
// answer with this counter unchanged is a SILENT FAILURE, never allowed.
let _ttsPlayedCount = 0
function notePlaybackStarted(): void {
  _ttsPlayedCount++
  try { (globalThis as unknown as { __abuTTSPlayed?: number }).__abuTTSPlayed = _ttsPlayedCount } catch { /* non-browser */ }
}
/** Number of times real TTS audio has started playing this session (playback proof). */
export function getTTSPlayedCount(): number { return _ttsPlayedCount }

// Shared AudioContext — created once, reused across all unlock calls.
// iOS Safari: once an AudioContext is resumed inside a user gesture, it stays
// "running" for the tab's lifetime, allowing async audio.play() to work even
// after mic sessions end.
let _sharedAudioCtx: AudioContext | null = null

// ─── iOS Audio Unlock ──────────────────────────────────────
// Call this SYNCHRONOUSLY inside any tap/click handler (user gesture context).
// Safe to call multiple times — important because WebSpeechRecognition can
// reset iOS's audio output session when the mic session ends.
export function unlockIOSAudio(): void {
  if (typeof window === 'undefined') return
  try {
    // 1) Web Audio API unlock — shared AudioContext, resumed every call
    if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
      _sharedAudioCtx = new AudioContext()
    }
    const buf = _sharedAudioCtx.createBuffer(1, 1, 22050)
    const src = _sharedAudioCtx.createBufferSource()
    src.buffer = buf
    src.connect(_sharedAudioCtx.destination)
    src.start(0)
    _sharedAudioCtx.resume().catch(() => {})

    // 2) HTMLAudioElement unlock — iOS treats this separately from AudioContext.
    //    A silent play() from a user-gesture context primes HTMLAudioElement.play()
    //    for the rest of the session, even from async callbacks.
    const silent = new Audio()
    silent.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    silent.volume = 0
    silent.play().catch(() => {})
  } catch {
    // Non-iOS or API not available — safe no-op
  }
}

// ─── Language detection ────────────────────────────────────

function detectLang(text: string): 'he' | 'es' {
  // Count Hebrew Unicode characters
  const heChars = (text.match(/[\u0590-\u05FF]/g) ?? []).length
  // Count Spanish-indicator characters (accented Latin)
  const esChars = (text.match(/[áéíóúüñ¿¡]/gi) ?? []).length
  // If Hebrew chars dominate → Hebrew
  if (heChars > 2) return 'he'
  // Explicit Spanish words (Rioplatense-aware vocabulary)
  const esWords = /\b(hola|gracias|buenos|buenas|cómo|qué|por|favor|sí|estoy|tengo|quiero|puedo|mamá|abuela|bien|mucho|todo|nada|casa|amor|vida|sabes|sabías|cuéntame|rico|claro|bueno|ja ja|querida|familia|che)\b/i
  if (esChars > 0 || esWords.test(text)) return 'es'
  // Mixed or unknown — default Hebrew (most messages will be Hebrew)
  return 'he'
}

// ─── Split text into speakable chunks ─────────────────────

function splitText(text: string, maxLen = 180): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break }
    let splitAt = -1
    for (const sep of ['. ', '? ', '! ', '، ', ', ', ' ']) {
      const idx = remaining.lastIndexOf(sep, maxLen)
      if (idx > 20) { splitAt = idx + sep.length; break }
    }
    if (splitAt === -1) splitAt = maxLen
    chunks.push(remaining.substring(0, splitAt).trim())
    remaining = remaining.substring(splitAt).trim()
  }
  return chunks.filter(c => c.length > 0)
}

// ─── PCM → WAV converter ───────────────────────────────────
// Gemini TTS returns raw PCM (L16, 24kHz mono).
// Browsers cannot play raw PCM — we wrap it in a standard WAV container.

function pcmToWav(pcmData: Uint8Array, sampleRate = 24000): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = pcmData.byteLength
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)       // chunk size
  view.setUint16(20, 1, true)        // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  new Uint8Array(buf, 44).set(pcmData)
  return new Blob([buf], { type: 'audio/wav' })
}

// ─── Play an audio blob / URL ──────────────────────────────

function playBlob(blob: Blob): Promise<boolean> {
  const url = URL.createObjectURL(blob)
  return new Promise<boolean>((resolve) => {
    const audio = new Audio(url)
    currentAudio = audio
    audio.onended = () => { currentAudio = null; URL.revokeObjectURL(url); resolve(true) }
    audio.onerror = () => { currentAudio = null; URL.revokeObjectURL(url); resolve(false) }
    audio.play().then(() => notePlaybackStarted()).catch(() => { currentAudio = null; URL.revokeObjectURL(url); resolve(false) })
  })
}

// ─── Play via pre-unlocked AudioContext ───────────────────
// iOS Safari: once an AudioContext is resumed inside a user gesture, its
// createBufferSource().start() works from ANY async context — even after
// the microphone session ends.  HTMLAudioElement.play() gets blocked after
// mic use; AudioContext.start() does not.
async function playBlobViaAudioCtx(blob: Blob): Promise<boolean> {
  try {
    if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
      _sharedAudioCtx = new AudioContext()
    }
    if (_sharedAudioCtx.state === 'suspended') {
      await _sharedAudioCtx.resume().catch(() => {})
    }
    const arrayBuf = await blob.arrayBuffer()
    const audioBuf = await _sharedAudioCtx.decodeAudioData(arrayBuf)
    return new Promise<boolean>((resolve) => {
      const src = _sharedAudioCtx!.createBufferSource()
      src.buffer = audioBuf
      src.connect(_sharedAudioCtx!.destination)
      _currentAudioSource = src // v20.1: store ref so stopSpeaking can kill it
      src.onended = () => { _currentAudioSource = null; resolve(true) }
      src.start(0)
      notePlaybackStarted()
    })
  } catch (e) {
    console.log('[TTS] AudioContext playback error:', e)
    return false
  }
}

// ─── 0. OpenAI TTS (primary — direct REST, works on iPhone) ──
// v22.4: gpt-4o-mini-tts with coral voice + steerable accent instructions
// Natural Israeli Hebrew and Argentine Spanish accents

function getTTSInstructions(text: string): string {
  const lang = detectLang(text)
  return lang === 'es'
    ? 'You are a warm Argentine woman. Speak naturally and gently in Rioplatense Spanish. Buenos Aires accent. Intimate, like a relaxed phone call with a close friend. Brief natural pauses between sentences. Never robotic, never reading aloud. Sound human, real, kind.'
    : 'You are a warm Israeli woman in her 40s. Speak naturally and gently in casual everyday Hebrew. Native Israeli accent — NOT American. Intimate, like a relaxed phone call with a close friend. Brief natural pauses between sentences. Never robotic, never reading aloud. Sound human, real, kind.'
}

/**
 * Server-proxied OpenAI TTS. The OpenAI key lives server-side only
 * (/api/abuai-tts) and never reaches the client bundle. Returns the audio Blob,
 * or null + an error code so the caller can fall back to a free TTS tier.
 */
async function openAITTSBlob(
  openaiBody: Record<string, unknown>,
  opts: { signal?: AbortSignal | null; timeoutMs?: number } = {},
): Promise<{ blob: Blob | null; error: string | null }> {
  const local = new AbortController()
  const t = opts.timeoutMs ? setTimeout(() => local.abort(), opts.timeoutMs) : null
  const signal = opts.signal ?? local.signal
  try {
    const res = await fetch('/api/abuai-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: openaiBody }),
      signal,
    })
    if (t) clearTimeout(t)
    const ct = res.headers.get('Content-Type') ?? ''
    if (!res.ok || ct.includes('application/json')) {
      let error = 'TTS_PROVIDER_FAILED'
      try { const j = await res.json() as { error?: string }; if (j?.error) error = j.error } catch { /* ignore */ }
      return { blob: null, error }
    }
    return { blob: await res.blob(), error: null }
  } catch (e) {
    if (t) clearTimeout(t)
    return { blob: null, error: (e as { name?: string } | null)?.name === 'AbortError' ? 'TTS_TIMEOUT' : 'TTS_PROVIDER_FAILED' }
  }
}

async function speakOpenAI(text: string): Promise<boolean> {
  // OpenAI TTS via the server proxy — the OpenAI key never reaches the client.
  // Skip if TTS-specific quota exhausted (separate from LLM chat quota).
  const qf = localStorage.getItem('abu-openai-tts-quota-failed')
  if (qf && (Date.now() - parseInt(qf, 10)) < 300_000) return false

  const chunks = splitText(text, 400)
  for (const chunk of chunks) {
    const lang = detectLang(chunk)
    const { blob, error } = await openAITTSBlob(
      { model: 'gpt-4o-mini-tts', input: chunk, voice: getVoiceProfile(lang).openaiVoice, instructions: getTTSInstructions(chunk), speed: getVoiceSpeed(lang) },
      { timeoutMs: 8000 },
    )
    if (error === 'TTS_QUOTA') { try { localStorage.setItem('abu-openai-tts-quota-failed', String(Date.now())) } catch {} }
    if (!blob || blob.size < 100) return false
    const ok = await playBlob(blob)
    if (!ok) return false
  }
  return true
}

// ─── 1. Azure Cognitive Services TTS (secondary) ──────────
// Official REST API — same HilaNeural / ElenaNeural voices as Edge TTS.
// Requires VITE_AZURE_TTS_KEY. Free tier: 500K chars/month.

async function speakAzureTTS(text: string): Promise<boolean> {
  const lang = detectLang(text)
  const chunks = splitText(text, 300)
  for (const chunk of chunks) {
    try {
      const url = `/api/aztts?text=${encodeURIComponent(chunk)}&lang=${lang}`
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 10000) // reasonable timeout for slow networks
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(t)
      if (res.status === 503) return false   // no key configured — skip silently
      if (!res.ok) { console.log('[TTS] Azure TTS status:', res.status); return false }
      const blob = await res.blob()
      if (blob.size < 100) { console.log('[TTS] Azure TTS: empty audio'); return false }
      const ok = await playBlob(blob)
      if (!ok) return false
    } catch (e) {
      console.log('[TTS] Azure TTS error:', e)
      return false
    }
  }
  return true
}

// ─── 2. Gemini TTS ─────────────────────────────────────────
// Uses existing VITE_GEMINI_API_KEY.
// Returns L16 raw PCM → we convert to WAV before playback.

const GEMINI_TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-2.0-flash',            // fallback: standard flash also supports TTS
]

async function speakGemini(text: string): Promise<boolean> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (!apiKey) return false

  // For voice, keep text short and natural. No instruction prefix — just the text.
  for (const model of GEMINI_TTS_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },  // T4.2: Kore better for Hebrew than Aoede
                },
              },
            },
          }),
        }
      )

      if (!res.ok) {
        console.log(`[TTS] Gemini (${model}) status:`, res.status)
        continue  // try next model
      }

      const data = await res.json()
      const audioPart = data?.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith('audio/')
      )

      if (!audioPart?.inlineData?.data) {
        console.log(`[TTS] Gemini (${model}): no audio in response`)
        continue
      }

      const { mimeType, data: b64 } = audioPart.inlineData
      const rawBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

      // Gemini returns raw PCM (audio/L16; codec=pcm; rate=24000) — must wrap in WAV
      const isRawPcm = mimeType.includes('L16') || mimeType.includes('pcm') || mimeType.includes('raw')
      const sampleRate = (() => {
        const m = mimeType.match(/rate=(\d+)/i)
        return m ? parseInt(m[1]!) : 24000
      })()
      const blob = isRawPcm ? pcmToWav(rawBytes, sampleRate) : new Blob([rawBytes], { type: mimeType })

      console.log(`[TTS] Gemini (${model}): ${rawBytes.length} bytes, mimeType=${mimeType}`)
      const ok = await playBlob(blob)
      if (ok) return true
    } catch (e) {
      console.log(`[TTS] Gemini (${model}) error:`, e)
    }
  }
  return false
}

// ─── 3. Google Translate TTS ───────────────────────────────
// Free, clear Hebrew female voice. Proxy via Vite dev middleware (/api/gtts).

async function speakGoogleTTS(text: string): Promise<boolean> {
  const lang = detectLang(text)
  const chunks = splitText(text, 200)
  for (const chunk of chunks) {
    try {
      const url = `/api/gtts?text=${encodeURIComponent(chunk)}&lang=${lang}`
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 10000) // reasonable timeout for slow networks
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(t)
      if (!res.ok) { console.log('[TTS] Google TTS status:', res.status); return false }
      const blob = await res.blob()
      if (blob.size < 100) { console.log('[TTS] Google TTS: empty audio'); return false }
      const ok = await playBlob(blob)
      if (!ok) return false
    } catch (e) {
      console.log('[TTS] Google TTS error:', e)
      return false
    }
  }
  return true
}

// ─── 2b. Edge TTS (Microsoft HilaNeural / ElenaNeural) ────
// Dev-only Vite proxy via WebSocket — fallback when no Azure key.

async function speakEdgeTTS(text: string): Promise<boolean> {
  const lang = detectLang(text)
  const chunks = splitText(text)
  for (const chunk of chunks) {
    try {
      const url = `/api/tts?text=${encodeURIComponent(chunk)}&lang=${lang}`
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 10000) // reasonable timeout for slow networks
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(t)
      if (!res.ok) { console.log('[TTS] Edge TTS status:', res.status); return false }
      const blob = await res.blob()
      if (blob.size < 100) { console.log('[TTS] Edge TTS: empty audio'); return false }
      const ok = await playBlob(blob)
      if (!ok) return false
    } catch (e) {
      console.log('[TTS] Edge TTS error:', e)
      return false
    }
  }
  return true
}

// ─── 4. Web Speech API (last resort) ──────────────────────

let cachedVoices: SpeechSynthesisVoice[] = []

function loadVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    cachedVoices = speechSynthesis.getVoices()
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  speechSynthesis.addEventListener('voiceschanged', loadVoices)
}

function speakWebAPI(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text.trim()) { resolve(); return }
    speechSynthesis.cancel()
    loadVoices()
    const lang = detectLang(text)
    const profile = getVoiceProfile(lang)
    const voices = speechSynthesis.getVoices()
    const prefix = lang === 'es' ? 'es' : 'he'
    const allForLang = voices.filter(v => v.lang.startsWith(prefix))

    // Warmest available system voice, ordered by voiceConfig preference
    // (Carmit/Paulina → Google → any female), then "anything not clearly male".
    let bestVoice: SpeechSynthesisVoice | undefined
    for (const matcher of profile.webSpeechPrefer) {
      bestVoice = allForLang.find(v => matcher.test(v.name))
      if (bestVoice) break
    }
    if (!bestVoice) bestVoice = allForLang.find(v => !profile.webSpeechAvoid.test(v.name)) ?? allForLang[0]

    const u = new SpeechSynthesisUtterance(text)
    u.lang = profile.webSpeechLang
    u.rate = getVoiceSpeed(lang)   // language-tuned, calm but not "old"
    u.pitch = profile.pitch        // neutral pitch — no robot adjustment
    u.volume = profile.volume
    if (bestVoice) u.voice = bestVoice
    console.log('[TTS] Web Speech voice:', bestVoice?.name ?? 'default', 'lang:', u.lang)
    u.onend = () => resolve()
    u.onerror = () => resolve()

    // iOS fix: after microphone session ends, speechSynthesis enters a "suspended"
    // state.  resume() + a 60 ms tick lets the audio system reset before speak().
    speechSynthesis.resume()
    setTimeout(() => speechSynthesis.speak(u), 60)
  })
}

// ─── Public API ────────────────────────────────────────────

// speakVoiceMode — for LIVE CONVERSATION (AbuAI voice mode, pipeline fallback)
// v24.3: OpenAI (paid, best quality) → Gemini (FREE) → Web Speech (FREE, last resort)
// Runtime TTS trace — visible on screen via localStorage for iPhone debugging
function ttsTrace(entry: { provider: string; model: string; voice: string; latencyMs: number; fallback: boolean; status: string }) {
  console.log(`[TTS-VM] ${entry.status} provider=${entry.provider} model=${entry.model} voice=${entry.voice} latency=${entry.latencyMs}ms fallback=${entry.fallback}`)
  try {
    const history = JSON.parse(localStorage.getItem('abu-tts-trace') || '[]') as unknown[]
    history.push({ ...entry, ts: new Date().toISOString() })
    // Keep last 20 entries
    if (history.length > 20) history.splice(0, history.length - 20)
    localStorage.setItem('abu-tts-trace', JSON.stringify(history))
  } catch {}
}

/** Read TTS trace for diagnostics. */
export function getTTSTrace(): Array<{ provider: string; model: string; voice: string; latencyMs: number; fallback: boolean; status: string; ts: string }> {
  try { return JSON.parse(localStorage.getItem('abu-tts-trace') || '[]') } catch { return [] }
}

/**
 * Debug summary: the configured voice profile + the engine/voice that actually
 * played last. Surfaced in diagnostics + console so Leo can confirm on a real
 * device which TTS engine spoke (not just which we intended).
 */
export function getVoiceDebug(): { config: string; lastEngine: string; lastVoice: string; lastStatus: string } {
  const last = getTTSTrace().slice(-1)[0]
  return {
    config: describeVoiceConfig(),
    lastEngine: last?.provider ?? '(none yet)',
    lastVoice: last?.voice ?? '(none yet)',
    lastStatus: last?.status ?? '(none yet)',
  }
}

export async function speakVoiceMode(text: string): Promise<boolean> {
  if (!text.trim()) return false
  const ttsStart = Date.now()

  // 1) OpenAI TTS (paid — server-proxied; key never in client) — skip only if TTS-specific quota exhausted
  const ttsQuotaFlag = localStorage.getItem('abu-openai-tts-quota-failed')
  const ttsQuotaOk = !ttsQuotaFlag || (Date.now() - parseInt(ttsQuotaFlag, 10)) > 300_000
  const vmLang = detectLang(text)
  const vmVoice = getVoiceProfile(vmLang).openaiVoice
  if (ttsQuotaOk) {
    const { blob, error } = await openAITTSBlob(
      { model: 'gpt-4o-mini-tts', input: text, voice: vmVoice, instructions: getTTSInstructions(text), speed: getVoiceSpeed(vmLang) },
      { timeoutMs: 6000 },
    )
    if (error === 'TTS_QUOTA') { try { localStorage.setItem('abu-openai-tts-quota-failed', String(Date.now())) } catch {} }
    if (blob && blob.size > 100) {
      const ok = await playBlobViaAudioCtx(blob)
      if (ok) { ttsTrace({ provider: 'OpenAI', model: 'gpt-4o-mini-tts', voice: vmVoice, latencyMs: Date.now() - ttsStart, fallback: false, status: '✅ played via AudioCtx' }); return true }
      if (await playBlob(blob)) { ttsTrace({ provider: 'OpenAI', model: 'gpt-4o-mini-tts', voice: vmVoice, latencyMs: Date.now() - ttsStart, fallback: false, status: '✅ played via HTMLAudio' }); return true }
    }
    ttsTrace({ provider: 'OpenAI', model: 'gpt-4o-mini-tts', voice: vmVoice, latencyMs: Date.now() - ttsStart, fallback: true, status: `❌ ${error ?? 'no audio'}` })
  } else {
    ttsTrace({ provider: 'OpenAI', model: 'gpt-4o-mini-tts', voice: vmVoice, latencyMs: 0, fallback: true, status: `⏭ skipped: quotaOk=false` })
  }

  // 2) Gemini TTS (FREE with existing key)
  if (await speakGeminiViaAudioCtx(text)) {
    ttsTrace({ provider: 'Gemini', model: 'gemini-2.5-flash-preview-tts', voice: 'Kore', latencyMs: Date.now() - ttsStart, fallback: true, status: '✅ Gemini TTS' })
    return true
  }

  // 3) Web Speech API (FREE, last audible resort). Voice mode PREVIOUSLY skipped
  //    this and returned "text only" — a SILENT failure (visible text, no voice).
  //    Now we degrade gracefully to the system voice before giving up.
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      await speakWebAPI(text)
      ttsTrace({ provider: 'WebSpeech', model: 'system', voice: '-', latencyMs: Date.now() - ttsStart, fallback: true, status: '✅ Web Speech (fallback)' })
      return true
    } catch { /* fall through to explicit failure */ }
  }

  // NO SILENT FAILURE: nothing could speak → the caller MUST surface a visible
  // recovery ("tap to hear") + a precise failure state. Returns false to force it.
  ttsTrace({ provider: 'NONE', model: '-', voice: '-', latencyMs: Date.now() - ttsStart, fallback: true, status: '⚠️ ALL FAILED — no audio (recovery required)' })
  return false
}

// Gemini TTS via AudioContext for voice mode (bypasses iOS audio restrictions)
async function speakGeminiViaAudioCtx(text: string): Promise<boolean> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (!apiKey) return false

  for (const model of GEMINI_TTS_MODELS) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },  // T4.2: Kore better for Hebrew than Aoede
                },
              },
            },
          }),
          signal: controller.signal,
        }
      )
      clearTimeout(t)
      if (!res.ok) continue
      const json = await res.json()
      const audioData = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      if (!audioData) continue

      // Convert base64 L16 PCM to WAV blob
      const raw = Uint8Array.from(atob(audioData), c => c.charCodeAt(0))
      const wavBlob = pcmToWav(raw, 24000)
      const ok = await playBlobViaAudioCtx(wavBlob)
      if (ok) return true
    } catch {
      continue
    }
  }
  return false
}

// speak — for TEXT CHAT and other non-realtime uses
// v24.3: OpenAI (paid) → Gemini (FREE) → Web Speech (FREE)
// v30.10: Added 20s safety timeout to prevent indefinite hang
export async function speak(text: string): Promise<void> {
  if (!text.trim()) return

  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('TTS_TIMEOUT')), 20_000),
  )

  try {
    await Promise.race([
      (async () => {
        // 1) OpenAI TTS (paid, best quality)
        if (await speakOpenAI(text)) return

        // 2) Gemini TTS (FREE)
        if (await speakGemini(text)) return

        // 3) Web Speech API (FREE, last resort)
        await speakWebAPI(text)
      })(),
      timeout,
    ])
  } catch {
    stopSpeaking()
  }
}

export function stopSpeaking(): void {
  // 1) HTMLAudioElement (used by playBlob fallback)
  if (currentAudio) {
    // Revoke blob URL to prevent memory leak on interrupted playback
    if (currentAudio.src?.startsWith('blob:')) {
      URL.revokeObjectURL(currentAudio.src)
    }
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  // 2) Web Speech API
  if ('speechSynthesis' in window) speechSynthesis.cancel()
  // 3) AudioContext source node (used by Gemini TTS + OpenAI TTS in voice mode)
  if (_currentAudioSource) {
    try { _currentAudioSource.stop() } catch { /* already stopped */ }
    _currentAudioSource = null
  }
  // 4) Streaming TTS queue
  if (_activeQueue) { _activeQueue.abort(); _activeQueue = null }
  console.log('[TTS] stopSpeaking — all audio channels killed')
}

// ─── Streaming TTS — Audio Chunk Queue ───────────────────────
// Plays audio chunks as they arrive with zero gap.
// Used by streaming voice mode: LLM tokens → sentence chunks → TTS → gapless playback.

let _activeQueue: AudioChunkQueue | null = null

/**
 * @workbench-keep FUTURE_API
 * reason: low-latency per-sentence streaming TTS path for future AbuAI FreeSpeech voice UX; currently superseded by speakVoiceMode and RealtimeVoiceSession
 * owner: leo
 * reviewAfter: 2026-08-01
 */
export class AudioChunkQueue {
  private queue: Blob[] = []
  private playing = false
  private aborted = false
  private ctx: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private onDone: (() => void) | null = null

  constructor(onDone?: () => void) {
    this.onDone = onDone ?? null
    this.ctx = _sharedAudioCtx
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext()
    }
    // Don't resume here — let enqueue() trigger it when first blob arrives (Bug #7 fix)
  }

  /** Enqueue an audio blob for playback */
  enqueue(blob: Blob): void {
    if (this.aborted) return
    this.queue.push(blob)
    if (!this.playing) {
      // Resume AudioContext on first blob (Bug #7 fix — avoids init silence)
      if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {})
      this.playNext()
    }
  }

  /** Signal that no more chunks will arrive */
  finish(): void {
    if (this.aborted) return
    if (!this.playing && this.queue.length === 0) {
      this.onDone?.()
    }
    // Otherwise playNext() will call onDone when queue empties
  }

  /** Immediately stop all playback and clear queue */
  abort(): void {
    this.aborted = true
    this.queue = []
    if (this.currentSource) {
      try { this.currentSource.stop() } catch { /* already stopped */ }
      this.currentSource = null
    }
  }

  /** Get current audio level for visual feedback (0-1) */
  get isPlaying(): boolean { return this.playing && !this.aborted }

  private async playNext(): Promise<void> {
    if (this.aborted) return
    const blob = this.queue.shift()
    if (!blob) {
      this.playing = false
      this.onDone?.()
      return
    }

    this.playing = true
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioContext()
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {})

      const arrayBuf = await blob.arrayBuffer()
      const audioBuf = await this.ctx.decodeAudioData(arrayBuf)
      if (this.aborted) return

      const src = this.ctx.createBufferSource()
      this.currentSource = src
      src.buffer = audioBuf
      src.connect(this.ctx.destination)
      src.onended = () => {
        this.currentSource = null
        this.playNext()
      }
      src.start(0)
    } catch (e) {
      console.log('[AudioQueue] playback error:', e)
      this.currentSource = null
      this.playNext() // skip failed chunk, play next
    }
  }
}

/**
 * @workbench-keep FUTURE_API
 * reason: low-latency per-sentence streaming TTS path for future AbuAI FreeSpeech voice UX; currently superseded by speakVoiceMode and RealtimeVoiceSession
 * owner: leo
 * reviewAfter: 2026-08-01
 */
/**
 * Stream-speak: plays TTS audio for each sentence as LLM tokens arrive.
 * Accumulates tokens until a sentence boundary, then sends to TTS and queues audio.
 * First audio plays while remaining sentences still generating.
 *
 * v16.2: Fixed critical bugs — await TTS, proper abort, non-blocking fallback.
 */
export async function streamSpeakVoiceMode(
  tokenStream: AsyncIterable<string>,
  onPhaseChange?: (phase: 'speaking' | 'done') => void,
  signal?: AbortSignal,
): Promise<void> {
  const queue = new AudioChunkQueue(() => {
    _activeQueue = null
    onPhaseChange?.('done')
  })
  _activeQueue = queue

  let buffer = ''
  let tokenCount = 0
  // v17: Extended sentence boundaries + token-count fallback for Hebrew (rarely uses commas)
  const sentenceEnd = /[.?!،,;:—–]\s/

  const speakChunk = async (text: string): Promise<void> => {
    if (signal?.aborted) return
    // OpenAI (paid, server-proxied; key never in client) → Gemini (FREE) → Web Speech (FREE)
    const sqf = localStorage.getItem('abu-openai-tts-quota-failed')
    const skipOpenAI = sqf && (Date.now() - parseInt(sqf, 10)) < 300_000
    if (!skipOpenAI) {
      const chunkLang = detectLang(text)
      const { blob, error } = await openAITTSBlob(
        { model: 'gpt-4o-mini-tts', input: text, voice: getVoiceProfile(chunkLang).openaiVoice, instructions: getTTSInstructions(text), speed: getVoiceSpeed(chunkLang) },
        { signal: signal ?? null },
      )
      if (error === 'TTS_QUOTA') { try { localStorage.setItem('abu-openai-tts-quota-failed', String(Date.now())) } catch {} }
      if (blob && blob.size > 100) { queue.enqueue(blob); return }
    }
    // Gemini TTS (FREE) — convert to blob and enqueue
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text }] }],
              generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
            }),
          }
        )
        if (res.ok) {
          const json = await res.json()
          const audioData = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
          if (audioData) {
            const raw = Uint8Array.from(atob(audioData), c => c.charCodeAt(0))
            const wavBlob = pcmToWav(raw, 24000)
            queue.enqueue(wavBlob)
            return
          }
        }
      } catch { /* try fallback */ }
    }
    // Web Speech (FREE, last resort)
    speakWebAPI(text).catch(() => {})
  }

  onPhaseChange?.('speaking')

  // Collect TTS promises so we can await them all before finishing
  const ttsPromises: Promise<void>[] = []

  for await (const token of tokenStream) {
    if (signal?.aborted) break
    buffer += token
    tokenCount++

    // Check for sentence boundary OR token-count fallback (Hebrew has few commas)
    const match = sentenceEnd.exec(buffer)
    const tokenOverflow = tokenCount >= 12 && buffer.trim().length > 10

    if (match || tokenOverflow) {
      let sentence: string
      if (match) {
        const splitIdx = (match.index ?? 0) + match[0].length
        sentence = buffer.substring(0, splitIdx).trim()
        buffer = buffer.substring(splitIdx)
      } else {
        // Token overflow: flush entire buffer as one chunk
        sentence = buffer.trim()
        buffer = ''
      }
      tokenCount = 0
      if (sentence.length > 2) {
        ttsPromises.push(speakChunk(sentence))
      }
    }
  }

  // Flush remaining text
  const remaining = buffer.trim()
  if (remaining.length > 2 && !signal?.aborted) {
    ttsPromises.push(speakChunk(remaining))
  }

  // Wait for all TTS requests to complete (blobs enqueued to audio queue)
  await Promise.all(ttsPromises)

  queue.finish()
}

// ─── Silence Detection (AudioContext + AnalyserNode) ────────

export interface SilenceDetector {
  stop: () => void
  getLevel: () => number
}

export function createSilenceDetector(
  stream: MediaStream,
  onSilence: () => void,
  options?: { threshold?: number; silenceMs?: number; maxMs?: number; minActiveMs?: number },
): SilenceDetector {
  const threshold    = options?.threshold   ?? 10    // lower = more sensitive
  const silenceMs    = options?.silenceMs   ?? 2000  // ms quiet after speech → stop
  const maxMs        = options?.maxMs       ?? 20000 // absolute max recording time
  const minActiveMs  = options?.minActiveMs ?? 1500  // never stop before this many ms

  let stopped = false
  let level = 0
  let hasSpeech = false
  let silenceStart = 0
  const startTime = Date.now()
  let ctx: AudioContext | null = null
  let frame = 0

  // v22.2: Noise floor gating — measure ambient level in first 500ms
  // and raise effective threshold above it (TV, AC, street noise)
  let noiseFloor = 0
  let noiseSamples: number[] = []
  const NOISE_CALIBRATION_MS = 500

  // ── HARD SAFETY TIMER ──────────────────────────────────────────────────────
  // This fires regardless of AudioContext state.  Guarantees onSilence is ALWAYS
  // called eventually even if AudioContext stays suspended forever on iOS Safari.
  const hardTimer = setTimeout(() => {
    if (!stopped) { cleanup(); onSilence() }
  }, maxMs + 1500)

  try {
    // Reuse shared AudioContext to avoid iOS Safari limit (~4-6 contexts)
    if (_sharedAudioCtx && _sharedAudioCtx.state !== 'closed') {
      ctx = _sharedAudioCtx
    } else {
      ctx = new AudioContext()
      _sharedAudioCtx = ctx
    }
    const source  = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      if (stopped) return
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i]! - 128) / 128
        sum += v * v
      }
      level = Math.min(100, Math.sqrt(sum / buf.length) * 300)

      const elapsed = Date.now() - startTime

      // v22.2: Calibrate noise floor from first 500ms of ambient audio
      // Exclude frames that look like speech (above 30) to avoid inflating the floor
      if (elapsed < NOISE_CALIBRATION_MS) {
        if (level < 30) noiseSamples.push(level)
        frame = requestAnimationFrame(tick)
        return
      } else if (noiseSamples.length > 0) {
        // Calculate noise floor as median of samples + margin
        noiseSamples.sort((a, b) => a - b)
        const median = noiseSamples[Math.floor(noiseSamples.length / 2)] ?? 0
        noiseFloor = median + 5 // 5-unit margin above ambient
        noiseSamples = [] // clear — calibration done
        console.log(`[SilenceDetector] Noise floor: ${noiseFloor.toFixed(1)}, effective threshold: ${Math.max(threshold, noiseFloor).toFixed(1)}`)
      }

      // Effective threshold = max(configured threshold, noise floor)
      const effectiveThreshold = Math.max(threshold, noiseFloor)

      // Only evaluate silence AFTER minActiveMs (prevents premature stops)
      if (elapsed >= minActiveMs) {
        if (level > effectiveThreshold) {
          hasSpeech = true
          silenceStart = 0
        } else if (hasSpeech) {
          if (!silenceStart) silenceStart = Date.now()
          else if (Date.now() - silenceStart > silenceMs) {
            cleanup(); onSilence(); return
          }
        }
        // Max time exceeded
        if (elapsed > maxMs) { cleanup(); onSilence(); return }
      }

      frame = requestAnimationFrame(tick)
    }

    if (ctx.state === 'running') {
      frame = requestAnimationFrame(tick)
    } else {
      // iOS Safari: ctx.resume() may never resolve outside a user gesture.
      // We add a 1200 ms timeout so tick() starts even if the promise hangs.
      const resumeGuard = setTimeout(() => {
        if (!stopped && frame === 0) {
          frame = requestAnimationFrame(tick)
        }
      }, 1200)

      ctx.resume().then(() => {
        clearTimeout(resumeGuard)
        if (!stopped) frame = requestAnimationFrame(tick)
      }).catch(() => {
        clearTimeout(resumeGuard)
        if (!stopped) frame = requestAnimationFrame(tick)
      })
    }
  } catch {
    // AudioContext not supported — hard timer above will call onSilence after maxMs
  }

  function cleanup() {
    if (stopped) return
    stopped = true
    clearTimeout(hardTimer)
    cancelAnimationFrame(frame)
    // Don't close shared AudioContext — it's reused across sessions (iOS limit ~4-6)
  }

  return { stop: cleanup, getLevel: () => level }
}

// On-device / e2e voice diagnostics hook (mirrors voiceFlightRecorder's
// __abuVoiceDiag): lets a browser/Preview test drive the REAL pipeline TTS and
// read the playback-proof counter, so "audio actually played" is verifiable
// without a human. Harmless (only speaks text); never exposes keys or data.
try {
  ;(globalThis as unknown as { __abuTTS?: Record<string, unknown> }).__abuTTS = {
    speakVoiceMode,
    getTTSPlayedCount,
    getTTSTrace,
  }
} catch { /* non-browser */ }
