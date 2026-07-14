/*
 * STT strategy — a tiny PURE decision layer kept out of the 3,500-line AbuAI component
 * so it can be unit-tested. Device root-cause (docs/DEVICE_P0_ROOT_CAUSE.md): on iOS Safari
 * (including installed PWA) `webkitSpeechRecognition` is unreliable — it can start and then
 * fire no onresult/onend/onerror, hanging "מקשיבה..." forever. So on iOS we do NOT use Web
 * Speech as the primary; we start with the Whisper path (getUserMedia + MediaRecorder→Groq,
 * which uses an iOS-supported audio/mp4 mime). Non-iOS keeps Web Speech primary (fast turns).
 */

/** Detect iOS / iPadOS across browsers (all use WebKit → same Web Speech limitation). */
export function isIOS(userAgent: string, platform = '', maxTouchPoints = 0): boolean {
  const ua = userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ reports as "Macintosh" but is touch-capable (maxTouchPoints > 1).
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return true
  if (platform === 'MacIntel' && maxTouchPoints > 1) return true
  return false
}

/**
 * Should the Web Speech API (webkitSpeechRecognition) be the PRIMARY STT?
 * True off iOS; false on iOS (start with Whisper instead of the flaky Web Speech).
 */
export function shouldUseWebSpeechPrimary(userAgent: string, platform = '', maxTouchPoints = 0): boolean {
  return !isIOS(userAgent, platform, maxTouchPoints)
}

/**
 * Listening watchdog: if the Web Speech recognizer produces NO event within this window
 * (no onresult / onend / onerror — the iOS hang), the caller must abort and fall back to
 * Whisper so "מקשיבה..." can never last forever. Bounded fallback per .claude/rules/voice.md.
 */
export const LISTEN_WATCHDOG_MS = 7000
