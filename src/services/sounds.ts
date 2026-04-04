// ─── AbuBank Sound System ─────────────────────────────────────────────────
// All sounds generated via Web Audio API — no files, no network requests.
// Respects iOS silent mode (sounds use AudioContext which follows media volume).
// Safe to call from any context — all errors silently swallowed.

let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext()
    return _ctx
  } catch {
    return null
  }
}

function playTone(
  freq: number,
  duration: number,
  volume = 0.10,
  startTime = 0,
  ctx?: AudioContext
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

// ─── Exports ──────────────────────────────────────────────────────────────

/** Call this inside a user tap to unlock iOS audio for sounds.
 *  Already handled by unlockIOSAudio() in voice.ts for voice features.
 *  This one is specifically for the sounds system. */
export function unlockSounds(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

/** Subtle button tap — soft keyboard click feel */
export function soundTap(): void {
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

/** Action completed — warm soft chime (C5 then E5) */
export function soundSuccess(): void {
  try {
    const c = getCtx()
    if (!c) return
    playTone(523, 80, 0.10, 0.000, c)   // C5
    playTone(659, 80, 0.10, 0.095, c)   // E5
  } catch { /* silent */ }
}

/** WhatsApp message sent — ascending sweep whoosh */
export function soundSend(): void {
  try {
    const c = getCtx()
    if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, c.currentTime)
    osc.frequency.linearRampToValueAtTime(800, c.currentTime + 0.120)
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(0.10, c.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.120)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.130)
  } catch { /* silent */ }
}

/** Calendar reminder — warm C-E-G major chord ascending */
export function soundAlert(): void {
  try {
    const c = getCtx()
    if (!c) return
    playTone(523, 100, 0.10, 0.000, c)  // C5
    playTone(659, 100, 0.10, 0.110, c)  // E5
    playTone(784, 100, 0.10, 0.220, c)  // G5
  } catch { /* silent */ }
}

/** Something went wrong — soft low tone, not alarming */
export function soundError(): void {
  try {
    const c = getCtx()
    if (!c) return
    playTone(200, 150, 0.08, 0, c)
  } catch { /* silent */ }
}

/** Voice mode activated — light ascending shimmer */
export function soundVoiceStart(): void {
  try {
    const c = getCtx()
    if (!c) return
    playTone(440, 60, 0.08, 0.000, c)   // A4
    playTone(660, 60, 0.08, 0.070, c)   // E5
    playTone(880, 60, 0.08, 0.140, c)   // A5
  } catch { /* silent */ }
}

/** Voice mode ended — descending shimmer */
export function soundVoiceEnd(): void {
  try {
    const c = getCtx()
    if (!c) return
    playTone(880, 60, 0.08, 0.000, c)   // A5
    playTone(660, 60, 0.08, 0.070, c)   // E5
    playTone(440, 60, 0.08, 0.140, c)   // A4
  } catch { /* silent */ }
}

/** Text copied — quick double-tap pulse */
export function soundCopy(): void {
  try {
    const c = getCtx()
    if (!c) return
    playTone(1000, 25, 0.08, 0.000, c)
    playTone(1000, 25, 0.08, 0.055, c)
  } catch { /* silent */ }
}

/** Screen/modal opens — soft low-to-mid tone */
export function soundOpen(): void {
  try {
    const c = getCtx()
    if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, c.currentTime)
    osc.frequency.linearRampToValueAtTime(330, c.currentTime + 0.080)
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.080)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.090)
  } catch { /* silent */ }
}
