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

/** True only when Realtime beta is explicitly opted in. Default (and on any error) = false. */
export function isRealtimeBetaEnabled(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
    return s?.getItem(REALTIME_BETA_KEY) === '1'
  } catch {
    return false
  }
}
