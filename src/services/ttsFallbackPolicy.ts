/*
 * TTS fallback policy (pure, testable)
 * ════════════════════════════════════
 * When the Realtime voice path reports a per-turn audio-PLAYBACK failure
 * (browser blocked play(), or no audio was produced), AbuAI must automatically
 * voice the SAME reply through the pipeline TTS chain (OpenAI → Gemini → Web
 * Speech) — but only ONCE per turn, and if there is a reply to speak. If we've
 * already used the fallback this turn (or have nothing to speak), we instead
 * surface the visible tap-to-hear recovery. No silent text-only success.
 */

export interface RealtimeAudioFallbackDecision {
  /** Voice the reply via the pipeline TTS chain now. */
  useFallback: boolean
  /** The reply text to speak (only when useFallback). */
  reply: string | null
  /** Show the visible tap-to-hear recovery instead. */
  showRecovery: boolean
}

/**
 * Decide what to do when the Realtime path reports an audio failure.
 * @param reply       the assistant reply that was sent to Realtime speak() (or null)
 * @param alreadyUsed whether the pipeline fallback already ran this turn
 */
export function decideRealtimeAudioFallback(
  reply: string | null | undefined,
  alreadyUsed: boolean,
): RealtimeAudioFallbackDecision {
  const text = (reply ?? '').trim()
  if (text && !alreadyUsed) {
    return { useFallback: true, reply: text, showRecovery: false }
  }
  // Nothing to speak, or we already tried the pipeline once → visible recovery.
  return { useFallback: false, reply: null, showRecovery: true }
}
