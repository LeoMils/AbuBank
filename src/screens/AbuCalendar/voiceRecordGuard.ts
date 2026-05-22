/**
 * Decides whether a new voice recording attempt should be blocked.
 *
 * When voiceStatus is non-empty (i.e. the UI is showing a status message
 * like "מקשיבה..." or a clarification question), a new recording is blocked
 * to prevent overlapping sessions.
 *
 * The bypassGuard option allows handleVoiceRetry to force a fresh recording
 * even when voiceStatus is still set — this is the retry-after-clarification
 * path that resets state and immediately re-records.
 */
export function shouldBlockVoiceRecord(
  voiceStatus: string,
  opts?: { bypassGuard?: boolean },
): boolean {
  return Boolean(voiceStatus && !opts?.bypassGuard)
}
