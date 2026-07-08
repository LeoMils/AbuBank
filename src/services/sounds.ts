// ─── AbuBank Sound System ─────────────────────────────────────────────────
// Single, centralized sound service for the whole app. All sounds are
// synthesized via the Web Audio API — no files, no network requests, no
// bundled assets. Every emission passes through ONE gate (`canPlay()`), so
// there is no scattered volume/mute logic anywhere in the components.
//
// Design guarantees for an 80+ user (Martita):
//   • Subtle, warm, never harsh — low volume, short, sine-based tones.
//   • Fail-silent: if the browser blocks or lacks audio, nothing throws.
//   • Respects an explicit mute toggle (Settings) — persisted in localStorage.
//   • Respects `prefers-reduced-motion` for HAPTICS (vibration is motion).
//   • Never plays over AbuAI's voice/TTS — suppressed while speech is active.
//   • Safe to call from any context (SSR / tests / iOS lockdown) — no-ops.
//
// This module NEVER writes to the speech runtime. It only *reads* the native
// `speechSynthesis.speaking` flag (and an optional, read-only global hint) to
// decide whether it is safe to emit a UI sound.

// ─── Mute state (persisted, synchronous) ───────────────────────────────────

const MUTE_KEY = 'abu-sound-muted'
let _muted: boolean | null = null
const muteListeners = new Set<(muted: boolean) => void>()

function readMuted(): boolean {
  if (_muted !== null) return _muted
  try {
    _muted = localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    _muted = false
  }
  return _muted
}

/** Is the UI sound system currently muted by the user? (synchronous) */
export function getSoundMuted(): boolean {
  return readMuted()
}

/** Persist the mute preference and notify subscribers. */
export function setSoundMuted(value: boolean): void {
  _muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    /* quota / private mode — keep in-memory value */
  }
  muteListeners.forEach((fn) => {
    try { fn(value) } catch { /* isolate subscriber errors */ }
  })
}

/** Flip mute on/off. Returns the new muted state. */
export function toggleSoundMuted(): boolean {
  const next = !readMuted()
  setSoundMuted(next)
  return next
}

/** Subscribe to mute changes (e.g. to re-render a Settings toggle). */
export function subscribeSoundMuted(fn: (muted: boolean) => void): () => void {
  muteListeners.add(fn)
  return () => { muteListeners.delete(fn) }
}

// ─── Environmental gates (read-only) ───────────────────────────────────────

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * True while AbuAI (or any browser TTS) is speaking. Read-only — this module
 * never drives the speech runtime, it only observes it so a UI beep never
 * steps on Martita's voice. Also honors an optional, app-set global hint
 * (`window.__abuAISpeaking`) if one is present, but never sets it.
 */
export function isVoiceActive(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (window.speechSynthesis && window.speechSynthesis.speaking) return true
    const hint = (window as unknown as { __abuAISpeaking?: unknown }).__abuAISpeaking
    if (hint === true) return true
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Central predicate: may we emit an audible UI sound right now?
 * Muted → no. AbuAI speaking → no. Otherwise → yes.
 * Exported so the gating logic is directly unit-testable.
 */
export function canPlay(): boolean {
  if (readMuted()) return false
  if (isVoiceActive()) return false
  return true
}

// ─── Audio engine (lazy, unlocked on first gesture) ────────────────────────

let _ctx: AudioContext | null = null

function AudioCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function getCtx(): AudioContext | null {
  try {
    const Ctor = AudioCtor()
    if (!Ctor) return null
    if (!_ctx || _ctx.state === 'closed') _ctx = new Ctor()
    if (_ctx.state === 'suspended') void _ctx.resume()
    return _ctx
  } catch {
    return null
  }
}

/**
 * Safe preload/unlock. Browsers require a user gesture before audio may play;
 * calling this from a real interaction "warms" the context so the first real
 * sound is not swallowed. Idempotent and fail-silent.
 */
export function unlockAudio(): void {
  try {
    const c = getCtx()
    if (c && c.state === 'suspended') void c.resume()
  } catch {
    /* silent */
  }
}

// Warm the context on the first user gesture, then detach. Guarded so it is a
// no-op under SSR / tests where `window` has no event target.
let _gestureBound = false
function bindGestureUnlock(): void {
  if (_gestureBound) return
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  _gestureBound = true
  const warm = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', warm)
    window.removeEventListener('keydown', warm)
    window.removeEventListener('touchstart', warm)
  }
  try {
    window.addEventListener('pointerdown', warm, { once: true, passive: true })
    window.addEventListener('keydown', warm, { once: true, passive: true })
    window.addEventListener('touchstart', warm, { once: true, passive: true })
  } catch {
    /* silent */
  }
}
bindGestureUnlock()

// ─── Tone primitives ───────────────────────────────────────────────────────

function playTone(
  freq: number,
  duration: number,
  volume = 0.10,
  startTime = 0,
  ctx?: AudioContext,
): void {
  const c = ctx ?? getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, c.currentTime + startTime)
  gain.gain.setValueAtTime(0, c.currentTime + startTime)
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + startTime + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + duration / 1000)
  osc.start(c.currentTime + startTime)
  osc.stop(c.currentTime + startTime + duration / 1000 + 0.01)
}

/** A single frequency-glide blip (rising or falling). */
function playGlide(
  fromFreq: number,
  toFreq: number,
  duration: number,
  volume = 0.09,
): void {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(fromFreq, c.currentTime)
  osc.frequency.linearRampToValueAtTime(toFreq, c.currentTime + duration)
  gain.gain.setValueAtTime(0, c.currentTime)
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + duration + 0.01)
}

// ─── Haptics ───────────────────────────────────────────────────────────────

/**
 * 15ms haptic tap. Gated by mute AND `prefers-reduced-motion` (vibration is a
 * motion cue). Independent of the audio gate so a tap still registers even
 * while AbuAI is speaking.
 */
export function haptic(): void {
  if (readMuted() || prefersReducedMotion()) return
  try { navigator.vibrate?.(15) } catch { /* silent */ }
}

// ─── Sound library ─────────────────────────────────────────────────────────
// Every function is fire-and-forget and self-gated. Callers never check state.

/** Subtle button tap — soft keyboard-click feel + haptic. */
export function soundTap(): void {
  haptic()
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, c.currentTime)
    osc.frequency.linearRampToValueAtTime(600, c.currentTime + 0.045)
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.045)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.055)
  } catch { /* silent */ }
}

/** Action completed — warm soft chime (C5 then E5). */
export function soundSuccess(): void {
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    playTone(523, 80, 0.10, 0.000, c)   // C5
    playTone(659, 80, 0.10, 0.095, c)   // E5
  } catch { /* silent */ }
}

/** WhatsApp message sent — ascending sweep whoosh. */
export function soundSend(): void {
  if (!canPlay()) return
  try {
    playGlide(400, 800, 0.120, 0.10)
  } catch { /* silent */ }
}

/** Calendar reminder — warm C-E-G major chord ascending. */
export function soundAlert(): void {
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    playTone(523, 100, 0.10, 0.000, c)  // C5
    playTone(659, 100, 0.10, 0.110, c)  // E5
    playTone(784, 100, 0.10, 0.220, c)  // G5
  } catch { /* silent */ }
}

/** Text copied — quick double-tap pulse. */
export function soundCopy(): void {
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    playTone(1000, 25, 0.08, 0.000, c)
    playTone(1000, 25, 0.08, 0.055, c)
  } catch { /* silent */ }
}

/** AI processing tick — soft rhythmic pulse while a response is generated. */
export function soundProcessing(): void {
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    playTone(330, 30, 0.03, 0.000, c)
    playTone(330, 30, 0.03, 0.300, c)
    playTone(330, 30, 0.03, 0.600, c)
  } catch { /* silent */ }
}

/** Screen/modal opens — soft low-to-mid tone. */
export function soundOpen(): void {
  if (!canPlay()) return
  try {
    playGlide(220, 330, 0.080, 0.06)
  } catch { /* silent */ }
}

/** Navigation between screens — gentle mid two-note step (distinct from Open). */
export function soundNavigate(): void {
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    playTone(392, 55, 0.055, 0.000, c)  // G4
    playTone(523, 60, 0.055, 0.060, c)  // C5
  } catch { /* silent */ }
}

/**
 * Something went wrong — GENTLE low descending pair. Deliberately soft and
 * warm (never a harsh buzzer) so it is calm for an 80+ user.
 */
export function soundError(): void {
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    playTone(392, 110, 0.075, 0.000, c) // G4
    playTone(311, 150, 0.075, 0.120, c) // Eb4 — soft downward resolve
  } catch { /* silent */ }
}

/** Calendar appointment saved — confirming warm two-note (F5 → A5). */
export function soundSaveCalendar(): void {
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    playTone(698, 80, 0.09, 0.000, c)   // F5
    playTone(880, 100, 0.09, 0.090, c)  // A5
  } catch { /* silent */ }
}

/** Game tap — short playful high blip. */
export function soundGameTap(): void {
  haptic()
  if (!canPlay()) return
  try {
    playGlide(660, 990, 0.055, 0.06)
  } catch { /* silent */ }
}

/** Recording started (UI-level only) — soft rising cue. */
export function soundRecordStart(): void {
  if (!canPlay()) return
  try {
    playGlide(440, 660, 0.090, 0.07)
  } catch { /* silent */ }
}

/** Recording stopped (UI-level only) — soft falling cue. */
export function soundRecordStop(): void {
  if (!canPlay()) return
  try {
    playGlide(660, 440, 0.090, 0.07)
  } catch { /* silent */ }
}

/** Toast / notification appears — one very soft, high, brief tone. */
export function soundToast(): void {
  if (!canPlay()) return
  try {
    playTone(880, 70, 0.05, 0.000)      // A5, quiet
  } catch { /* silent */ }
}

/** Gentle completion — soft ascending resolve (C5-E5-G5, softer than Alert). */
export function soundComplete(): void {
  if (!canPlay()) return
  try {
    const c = getCtx()
    if (!c) return
    playTone(523, 90, 0.06, 0.000, c)   // C5
    playTone(659, 90, 0.06, 0.100, c)   // E5
    playTone(784, 120, 0.07, 0.200, c)  // G5
  } catch { /* silent */ }
}
