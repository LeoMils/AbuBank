// ─── Text-to-Speech ─────────────────────────────────────────
// Priority: 1) Azure TTS REST API (HilaNeural/ElenaNeural — needs VITE_AZURE_TTS_KEY)
//           2) Edge TTS WebSocket (same voices, unofficial fallback)
//           3) Gemini TTS (Aoede — human but not Israeli/Argentine)
//           4) Google Translate TTS  5) Web Speech API

let currentAudio: HTMLAudioElement | null = null

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
    audio.play().catch(() => { currentAudio = null; URL.revokeObjectURL(url); resolve(false) })
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
      src.onended = () => resolve(true)
      src.start(0)
    })
  } catch (e) {
    console.log('[TTS] AudioContext playback error:', e)
    return false
  }
}

// ─── 0. OpenAI TTS (primary — direct REST, works on iPhone) ──
// "nova" voice: warm, clear, slightly husky female — the most natural-sounding
// for Hebrew and Spanish. No proxy required. Works in Vercel production.
// Speed 0.88: comfortable pace for Martita's ears without sounding slow.

async function speakOpenAI(text: string): Promise<boolean> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
  if (!apiKey) return false

  const chunks = splitText(text, 400)
  for (const chunk of chunks) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 15000)
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',            // tts-1 = low latency (best for real-time conversation)
          input: chunk,
          voice: 'nova',             // warm, feminine, clear — most pleasant for ear
          speed: 0.88,               // slightly slower → easier to follow for 80+ listener
          response_format: 'mp3',
        }),
        signal: controller.signal,
      })
      clearTimeout(t)
      if (!res.ok) {
        console.log('[TTS] OpenAI status:', res.status)
        return false
      }
      const blob = await res.blob()
      if (blob.size < 100) { console.log('[TTS] OpenAI: empty audio'); return false }
      const ok = await playBlob(blob)
      if (!ok) return false
    } catch (e) {
      console.log('[TTS] OpenAI error:', e)
      return false
    }
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
      const t = setTimeout(() => controller.abort(), 5000) // fast timeout — iPhone can't reach proxy
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
  'gemini-2.0-flash-preview-tts',
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
                  prebuiltVoiceConfig: { voiceName: 'Aoede' },
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
      const t = setTimeout(() => controller.abort(), 5000) // fast timeout — iPhone can't reach proxy
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
      const t = setTimeout(() => controller.abort(), 5000) // fast timeout — iPhone can't reach proxy
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
    const voices = speechSynthesis.getVoices()
    const prefix = lang === 'es' ? 'es' : 'he'
    const allForLang = voices.filter(v => v.lang.startsWith(prefix))

    // Hebrew priority: Carmit (macOS Israeli) → Google (Android) → any Hebrew female
    // Spanish priority: Paulina (macOS) → Google (Android) → any Spanish female
    let bestVoice: SpeechSynthesisVoice | undefined
    if (lang === 'he') {
      bestVoice =
        allForLang.find(v => /carmit/i.test(v.name)) ??
        allForLang.find(v => /google/i.test(v.name)) ??
        allForLang.find(v => /lihi|yael|female|woman/i.test(v.name)) ??
        allForLang.find(v => !/amit|asaf|male(?!.*fe)/i.test(v.name)) ??
        allForLang[0]
    } else {
      bestVoice =
        allForLang.find(v => /paulina/i.test(v.name)) ??
        allForLang.find(v => /google/i.test(v.name)) ??
        allForLang.find(v => /mónica|penélope|elena|female|woman/i.test(v.name)) ??
        allForLang.find(v => !/jorge|diego|male(?!.*fe)/i.test(v.name)) ??
        allForLang[0]
    }

    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'es' ? 'es-AR' : 'he-IL'
    u.rate = lang === 'he' ? 0.82 : 0.88   // slightly slower for Hebrew (80-year-old listener)
    u.pitch = 1.0                            // neutral pitch — no robot adjustment
    u.volume = 1.0
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

// speakVoiceMode — for LIVE CONVERSATION (AbuAI voice mode)
// iOS strategy: play OpenAI TTS through the pre-unlocked AudioContext.
// The shared AudioContext was resumed during the user's tap (unlockIOSAudio),
// and AudioContext.createBufferSource().start() is NEVER blocked by iOS after
// mic use — unlike HTMLAudioElement.play() or speechSynthesis which can silently
// fail after a WebSpeechRecognition session ends.
// Falls back to speechSynthesis (with resume fix) if no OpenAI key.
export async function speakVoiceMode(text: string): Promise<void> {
  if (!text.trim()) return

  // 1) OpenAI TTS → AudioContext playback (best quality, works on iOS after mic)
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
  if (apiKey) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 12000)
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', speed: 0.88, response_format: 'mp3' }),
        signal: controller.signal,
      })
      clearTimeout(t)
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 100) {
          const ok = await playBlobViaAudioCtx(blob)
          if (ok) return
          console.log('[TTS] AudioCtx failed, trying HTMLAudioElement fallback')
          if (await playBlob(blob)) return
        }
      }
    } catch (e) {
      console.log('[TTS] speakVoiceMode OpenAI error:', e)
    }
  }

  // 2) Web Speech API fallback (resume fix applied inside speakWebAPI)
  await speakWebAPI(text)
}

// speak — for TEXT CHAT and other non-realtime uses
// OpenAI nova is primary (best quality), falls back to Web Speech.
export async function speak(text: string): Promise<void> {
  if (!text.trim()) return

  // 0) OpenAI TTS — nova voice — direct REST API, works on iPhone/Vercel (no proxy needed)
  console.log('[TTS] Trying OpenAI nova...')
  if (await speakOpenAI(text)) { console.log('[TTS] ✅ OpenAI nova worked'); return }
  console.log('[TTS] ❌ OpenAI failed (no key or network error)')

  // 1) Gemini TTS — multilingual Aoede (direct API, works in production)
  console.log('[TTS] Trying Gemini...')
  if (await speakGemini(text)) { console.log('[TTS] ✅ Gemini worked'); return }
  console.log('[TTS] ❌ Gemini failed')

  // 2) Azure TTS — HilaNeural/ElenaNeural — dev proxy only, will skip in production
  console.log('[TTS] Trying Azure TTS...')
  if (await speakAzureTTS(text)) { console.log('[TTS] ✅ Azure TTS worked'); return }

  // 3) Edge TTS — dev proxy only, will skip in production
  console.log('[TTS] Trying Edge TTS...')
  if (await speakEdgeTTS(text)) { console.log('[TTS] ✅ Edge TTS worked'); return }

  // 4) Google Translate TTS — dev proxy only, will skip in production
  console.log('[TTS] Trying Google TTS...')
  if (await speakGoogleTTS(text)) { console.log('[TTS] ✅ Google TTS worked'); return }

  // 5) Last resort — browser built-in Web Speech
  console.log('[TTS] Falling back to Web Speech API')
  await speakWebAPI(text)
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel()
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

  // ── HARD SAFETY TIMER ──────────────────────────────────────────────────────
  // This fires regardless of AudioContext state.  Guarantees onSilence is ALWAYS
  // called eventually even if AudioContext stays suspended forever on iOS Safari.
  const hardTimer = setTimeout(() => {
    if (!stopped) { cleanup(); onSilence() }
  }, maxMs + 1500)

  try {
    ctx = new AudioContext()
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

      // Only evaluate silence AFTER minActiveMs (prevents premature stops)
      if (elapsed >= minActiveMs) {
        if (level > threshold) {
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
    ctx?.close().catch(() => {})
  }

  return { stop: cleanup, getLevel: () => level }
}
