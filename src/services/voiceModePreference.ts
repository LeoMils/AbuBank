/*
 * Voice-mode preference (Option C, docs/VOICE_ARCHITECTURE_VERDICT.md).
 *
 * The DEFAULT voice path is now the reliable pipeline (push-to-talk: STT → controller →
 * server TTS played via a gesture-unlocked AudioContext, which is proven to produce audio).
 * The OpenAI Realtime (WebRTC) path — lower latency and full-duplex, but never proven on a
 * real device and prone to autoplay-blocked remote audio — is now OPT-IN "beta", enabled
 * only when the user explicitly turns it on. This finally makes audible voice the default
 * for the real user while keeping the Live-like path available for device iteration.
 */
export const REALTIME_BETA_KEY = 'abu-voice-realtime-beta'
// URL override so the beta can be toggled on a phone with NO JS console (installed
// iOS PWA): open …?voice=realtime to opt in, …?voice=pipeline to opt out. The choice
// is persisted to localStorage so it survives the query-string being dropped later.
export const REALTIME_BETA_QUERY = 'voice'

/** True only when Realtime beta is explicitly opted in. Default (and on any error) = false. */
export function isRealtimeBetaEnabled(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
    return s?.getItem(REALTIME_BETA_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Apply a `?voice=realtime|pipeline` URL override and PERSIST it, so Leo can enable the
 * Realtime beta from a link on the phone (no console on installed iOS PWA). Returns the
 * applied boolean, or null when no recognized param is present. Safe no-op / false on error.
 * Accepted opt-in values: realtime | beta | on | 1. Opt-out: pipeline | off | 0.
 */
export function syncRealtimeBetaFromUrl(
  search?: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): boolean | null {
  try {
    const q = search ?? (typeof window !== 'undefined' ? window.location.search : '')
    if (!q) return null
    const v = new URLSearchParams(q).get(REALTIME_BETA_QUERY)
    if (v == null) return null
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
    if (v === 'realtime' || v === 'beta' || v === 'on' || v === '1') { s?.setItem(REALTIME_BETA_KEY, '1'); return true }
    if (v === 'pipeline' || v === 'off' || v === '0') { s?.setItem(REALTIME_BETA_KEY, '0'); return false }
    return null
  } catch {
    return null
  }
}
