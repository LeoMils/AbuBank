/*
 * Flight Recorder — user off switch (persisted, live, safer-only).
 * ════════════════════════════════════════════════════════════════
 * A user-facing kill switch for local conversation capture. Consistent with the
 * Central Law (config.ts): a user can only ever make capture SAFER (turn it off) —
 * this flag can silence the recorder but can never escalate it. Persisted in
 * localStorage so it survives reloads, read per-turn at the serving seam
 * (observeTurn) so toggling takes effect immediately, and crash-proof (any storage
 * error is treated as "not disabled" — capture keeps its config-level default).
 */
export const RECORDER_OFF_KEY = 'abu-flight-recorder-off'

/** True when the user has switched local capture OFF. Never throws. */
export function isRecorderOff(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(RECORDER_OFF_KEY) === '1'
  } catch {
    return false
  }
}

/** Persist the user's choice. `true` = stop capturing; `false` = resume (default). */
export function setRecorderOff(off: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (off) localStorage.setItem(RECORDER_OFF_KEY, '1')
    else localStorage.removeItem(RECORDER_OFF_KEY)
  } catch {
    /* storage unavailable — the recorder keeps its config-level default */
  }
}
