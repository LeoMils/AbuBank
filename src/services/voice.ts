// ─── Text-to-Speech ─────────────────────────────────────────
// Priority: 1) OpenAI TTS (shimmer — warm woman, direct REST)
//           2) Gemini TTS (Aoede — multilingual)
//           3) Azure TTS (HilaNeural/ElenaNeural — dev proxy)
//           4) Edge TTS (same voices, WebSocket fallback)
//           5) Google Translate TTS  6) Web Speech API

let currentAudio: HTMLAudioElement | null = null
let currentAudioCtxSource: AudioBufferSourceNode | null = null

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

export function detectLang(text: string): 'he' | 'es' {
  // Count Hebrew Unicode characters
  const heChars = (text.match(/[\u0590-\u05FF]/g) ?? []).length
  // Count Spanish-indicator characters (accented Latin)
  const esChars = (text.match(/[áéíóúüñ¿¡]/gi) ?? []).length
  // If Hebrew chars dominate → Hebrew
  if (heChars > 2) return 'he'
  // Rioplatense + general Spanish vocabulary (broad coverage)
  const esWords = /\b(hola|gracias|buenos|buenas|cómo|qué|por|favor|sí|estoy|tengo|quiero|puedo|mamá|abuela|bien|mucho|todo|nada|casa|amor|vida|sabes|sabías|cuéntame|rico|claro|bueno|ja ja|querida|familia|che|dale|vos|sos|andá|mirá|decime|contame|bancame|tranqui|boludo|pibe|mina|laburar|re|piola|bárbaro|genial|lindo|hermoso|extraño|recuerdo|siempre|nunca|cuando|donde|porque|entonces|también|después|antes|ahora|todavía|ojalá|chau|basta|parar)\b/i
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
      currentAudioCtxSource = src
      src.buffer = audioBuf
      src.connect(_sharedAudioCtx!.destination)
      src.onended = () => { currentAudioCtxSource = null; resolve(true) }
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
          model: 'tts-1-hd',         // HD = higher quality, more natural sounding
          input: chunk,
          voice: 'shimmer',          // shimmer = warm, expressive, very human-like
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

  // Language-aware speed: Hebrew slightly slower (denser info), Spanish natural pace
  const lang = detectLang(text)
  const speed = lang === 'he' ? 0.90 : 0.94

  // 1) OpenAI TTS → AudioContext playback (best quality, works on iOS after mic)
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
  if (apiKey) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 12000)
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'tts-1', input: text, voice: 'shimmer', speed, response_format: 'mp3' }),
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

export function isSpeaking(): boolean {
  return !!(currentAudio || currentAudioCtxSource) ||
    (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking)
}

export function stopSpeaking(): void {
  if (currentAudioCtxSource) {
    try { currentAudioCtxSource.stop() } catch {}
    currentAudioCtxSource = null
  }
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

// ─── Silence Detection (AudioContext + AnalyserNode) ────────
// Professional voice activity detection:
// 1. Ambient calibration — first 600ms measures room noise floor
// 2. Frequency-weighted energy — band-pass 250Hz-3500Hz (human voice range)
// 3. Speech frame debounce — requires 3+ consecutive frames to confirm speech
// 4. Exponential moving average — smooths level for UI and prevents flicker
// 5. Adaptive threshold — auto-adjusts above ambient noise floor

export interface SilenceDetector {
  stop: () => void
  getLevel: () => number
}

export function createSilenceDetector(
  stream: MediaStream,
  onSilence: () => void,
  options?: { threshold?: number; silenceMs?: number; maxMs?: number; minActiveMs?: number },
): SilenceDetector {
  const baseThreshold = options?.threshold   ?? 18    // base threshold (adjusted by ambient calibration)
  const silenceMs     = options?.silenceMs   ?? 3000  // ms quiet after speech → stop (tolerates natural pauses)
  const maxMs         = options?.maxMs       ?? 30000 // absolute max recording time
  const minActiveMs   = options?.minActiveMs ?? 2500  // never stop before this many ms

  let stopped = false
  let smoothLevel = 0                // exponential moving average of level
  let hasSpeech = false
  let silenceStart = 0
  const startTime = Date.now()
  let ctx: AudioContext | null = null
  let frame = 0

  // Ambient calibration state
  let calibrating = true
  const CALIBRATION_MS = 600         // how long to measure ambient noise
  let ambientSamples: number[] = []
  let effectiveThreshold = baseThreshold

  // Speech debounce state — require N consecutive frames above threshold
  const SPEECH_CONFIRM_FRAMES = 3
  let consecutiveSpeechFrames = 0

  // ── HARD SAFETY TIMER ──────────────────────────────────────────────────────
  const hardTimer = setTimeout(() => {
    if (!stopped) { cleanup(); onSilence() }
  }, maxMs + 2000)

  try {
    ctx = new AudioContext()
    const source   = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024              // more frequency resolution for band-pass
    analyser.smoothingTimeConstant = 0.3 // slight smoothing at analyser level
    source.connect(analyser)

    const freqBins = analyser.frequencyBinCount
    const freqBuf  = new Uint8Array(freqBins)
    const sampleRate = ctx.sampleRate
    const binHz = sampleRate / analyser.fftSize  // Hz per bin

    // Pre-calculate which bins fall in human voice range (250Hz – 3500Hz)
    const voiceLowBin  = Math.max(1, Math.floor(250 / binHz))
    const voiceHighBin = Math.min(freqBins - 1, Math.ceil(3500 / binHz))

    const tick = () => {
      if (stopped) return
      const elapsed = Date.now() - startTime

      // Use frequency-domain data for voice band energy
      analyser.getByteFrequencyData(freqBuf)
      let voiceEnergy = 0
      let voiceBins = 0
      for (let i = voiceLowBin; i <= voiceHighBin; i++) {
        voiceEnergy += freqBuf[i]!
        voiceBins++
      }
      const rawLevel = voiceBins > 0 ? (voiceEnergy / voiceBins) / 2.55 : 0  // normalize 0-100

      // Exponential moving average (alpha=0.3 → responsive but smooth)
      smoothLevel = smoothLevel * 0.7 + rawLevel * 0.3

      // ── Phase 1: Ambient calibration (first 600ms) ──
      if (calibrating) {
        ambientSamples.push(rawLevel)
        if (elapsed >= CALIBRATION_MS) {
          calibrating = false
          if (ambientSamples.length > 0) {
            // Set threshold at ambient floor + base margin (never below baseThreshold)
            const ambientAvg = ambientSamples.reduce((a, b) => a + b, 0) / ambientSamples.length
            effectiveThreshold = Math.max(baseThreshold, ambientAvg + 12)
          }
        }
        frame = requestAnimationFrame(tick)
        return
      }

      // ── Phase 2: Voice activity detection ──
      if (elapsed >= minActiveMs) {
        if (smoothLevel > effectiveThreshold) {
          consecutiveSpeechFrames++
          if (consecutiveSpeechFrames >= SPEECH_CONFIRM_FRAMES) {
            hasSpeech = true
          }
          silenceStart = 0
        } else {
          consecutiveSpeechFrames = 0
          if (hasSpeech) {
            if (!silenceStart) silenceStart = Date.now()
            else if (Date.now() - silenceStart > silenceMs) {
              cleanup(); onSilence(); return
            }
          }
        }
        if (elapsed > maxMs) { cleanup(); onSilence(); return }
      } else {
        // Before minActiveMs: still track speech but don't evaluate silence
        if (smoothLevel > effectiveThreshold) {
          consecutiveSpeechFrames++
          if (consecutiveSpeechFrames >= SPEECH_CONFIRM_FRAMES) hasSpeech = true
        } else {
          consecutiveSpeechFrames = 0
        }
      }

      frame = requestAnimationFrame(tick)
    }

    if (ctx.state === 'running') {
      frame = requestAnimationFrame(tick)
    } else {
      const resumeGuard = setTimeout(() => {
        if (!stopped && frame === 0) frame = requestAnimationFrame(tick)
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

  return { stop: cleanup, getLevel: () => smoothLevel }
}
