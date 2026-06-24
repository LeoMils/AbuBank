// ─── Microphone Preflight ───────────────────────────────────────────────────
// P0 (real iPhone Safari): the app was opened over plain HTTP on a LAN IP
// (http://10.0.0.10:5177). iOS Safari only exposes navigator.mediaDevices on a
// SECURE context (https://, localhost, or 127.0.0.1). On an insecure origin
// `navigator.mediaDevices` is `undefined`, so every getUserMedia() call throws a
// confusing TypeError. The old code called getUserMedia blindly, so:
//   • Realtime WebRTC threw → retried twice → fell back to the pipeline
//   • the pipeline greeted ("בוקר טוב, Martita. אני כאן.")
//   • Web Speech / Whisper getUserMedia threw → "לא הצלחתי להתחיל הקלטה"
//   • the user tapped again → greeting again → the observed loop
//
// This module answers ONE question BEFORE we touch the mic: can we record here?
// If not, the caller shows a single calm message and does NOT enter the loop.

export type MicBlockReason =
  | 'insecure_context' // not https/localhost — iOS Safari hides mediaDevices
  | 'no_media_devices' // navigator.mediaDevices missing (old/embedded browser)
  | 'no_getusermedia'  // mediaDevices present but getUserMedia missing

export type MicPreflight =
  | { ok: true }
  | { ok: false; reason: MicBlockReason; userMessage: string; devReason: string }

// Calm, senior-friendly Hebrew. NEVER technical, never "https"/"context"/"API".
// Tells Martita exactly what she CAN do right now (write to me) so the screen is
// never a dead end. The technical truth goes to the console + diagnostics for Leo.
const CALM_MIC_MESSAGE = 'אני עדיין לא יכולה לשמוע כאן. אפשר לכתוב לי כאן בינתיים — אני קוראת הכל ועונה.'

interface PreflightDeps {
  isSecureContext?: boolean
  mediaDevices?: { getUserMedia?: unknown } | undefined
  protocol?: string
  hostname?: string
}

/**
 * Decide whether the microphone can be used in THIS browsing context, without
 * triggering a permission prompt or touching the device. Pure + injectable so
 * it is unit-testable without a real browser.
 */
export function checkMicPreflight(deps?: PreflightDeps): MicPreflight {
  const isSecure = deps?.isSecureContext ??
    (typeof window !== 'undefined' ? window.isSecureContext : false)
  const mediaDevices = deps?.mediaDevices ??
    (typeof navigator !== 'undefined' ? (navigator.mediaDevices as { getUserMedia?: unknown } | undefined) : undefined)
  const protocol = deps?.protocol ??
    (typeof window !== 'undefined' ? window.location.protocol : '')
  const hostname = deps?.hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : '')

  // Insecure context is the single most common cause on a real device: the app
  // served over http:// on a LAN IP. mediaDevices is undefined there on Safari,
  // but we check isSecureContext FIRST so the diagnostic names the real problem
  // even on browsers that keep a (non-functional) mediaDevices stub around.
  if (isSecure === false) {
    return {
      ok: false,
      reason: 'insecure_context',
      userMessage: CALM_MIC_MESSAGE,
      devReason: `insecure context (${protocol}//${hostname}) — iOS Safari blocks the microphone unless the page is served over https or from localhost. Run \`npm run dev:https\` and open the https:// address.`,
    }
  }

  if (!mediaDevices) {
    return {
      ok: false,
      reason: 'no_media_devices',
      userMessage: CALM_MIC_MESSAGE,
      devReason: 'navigator.mediaDevices is undefined — browser too old or microphone unavailable in this context.',
    }
  }

  if (typeof mediaDevices.getUserMedia !== 'function') {
    return {
      ok: false,
      reason: 'no_getusermedia',
      userMessage: CALM_MIC_MESSAGE,
      devReason: 'navigator.mediaDevices.getUserMedia is not a function — microphone capture is not supported here.',
    }
  }

  return { ok: true }
}

/** Convenience boolean for guard sites that don't need the message. */
export function isMicAvailable(deps?: PreflightDeps): boolean {
  return checkMicPreflight(deps).ok
}

export const MIC_CALM_MESSAGE = CALM_MIC_MESSAGE
