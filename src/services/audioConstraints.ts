/*
 * Mic capture constraints — ONE source of truth.
 * ══════════════════════════════════════════════
 * iOS Safari benefits from explicit echoCancellation / noiseSuppression /
 * autoGainControl on the STT capture stream (cleaner audio → better transcription).
 * These were duplicated across the recording, realtime, and calendar-voice paths;
 * this centralizes them so they cannot drift. A BARE `{ audio: true }` remains the
 * correct FALLBACK when a device rejects the constrained request (some iOS versions).
 */
export const MIC_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

/** The primary getUserMedia request shape for all mic capture paths. */
export const MIC_GETUSERMEDIA: MediaStreamConstraints = { audio: MIC_AUDIO_CONSTRAINTS }
