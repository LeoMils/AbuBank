/*
 * LIVE DEVICE TRACE HARNESS (ADR-0001 §5/§9 — the live-path certifier).
 * ════════════════════════════════════════════════════════════════════════════
 * Ingests a PRIVACY-SAFE real-device turn trace (no content / no phone / no
 * secrets) and deterministically REJECTS the device-falsified failure classes.
 * A live-dependent scorecard row may only return to PROVEN when a real iPhone
 * trace passes checkDeviceTrace with zero violations — injected-event proofs are
 * NOT sufficient. The trace fields mirror the diagnostic-integrity contract.
 */

export interface DeviceTurnTrace {
  sessionId: string
  turnId: string
  clientSha: string            // must be a full 40-hex SHA, NOT "local"
  buildId: string              // must not be "unknown"/"local"
  runtimeMode: 'REALTIME_ACTIVE' | 'FALLBACK_ACTIVE' | 'TERMINATED'
  talkOwners: string[]         // must be exactly ONE per turn
  responseCreateCount: number  // <= 1
  activeSessions: number       // == 1
  activeRemoteTracks: number   // <= 1
  activeOutputStreams: number  // <= 1
  greetingCountThisSession: number   // <= 1
  path: string                 // must not be "unknown"
  micPermission: 'granted' | 'denied' | 'unknown'
  outputStopReason: string | null    // must be a real reason when output stopped
  truncatedEarly: boolean      // true = stopped before completion (~5-6s)
  transcriptRetryLoop: boolean // true = repeated STT failure loop
  calendarIntentRoutedToComm: boolean
  unresolvedRelationshipBecamePerson: boolean
  fallbackAndRealtimeOverlap: boolean
}

export interface TraceViolation { code: string; detail: string }

const FULL_SHA = /^[0-9a-f]{40}$/

/** Deterministic invariants — each maps to a device-falsified failure class. */
export function checkDeviceTrace(t: DeviceTurnTrace): TraceViolation[] {
  const v: TraceViolation[] = []
  const push = (code: string, detail: string) => v.push({ code, detail })

  if (!FULL_SHA.test(String(t.clientSha))) push('BUILD_IDENTITY_UNKNOWN', `clientSha '${t.clientSha}' is not a full SHA`)
  if (!t.buildId || /unknown|local/i.test(t.buildId)) push('BUILD_IDENTITY_UNKNOWN', `buildId '${t.buildId}'`)
  if (t.path === 'unknown' || !t.path) push('PATH_UNKNOWN', 'live diagnostic path is unknown')
  if ((t.talkOwners?.length ?? 0) !== 1) push('MULTIPLE_TALK_OWNERS', `talkOwners=${JSON.stringify(t.talkOwners)}`)
  if (t.responseCreateCount > 1) push('MULTIPLE_RESPONSES', `responseCreateCount=${t.responseCreateCount}`)
  if (t.activeSessions !== 1) push('MULTIPLE_SESSIONS', `activeSessions=${t.activeSessions}`)
  if (t.activeRemoteTracks > 1) push('MULTIPLE_REMOTE_TRACKS', `activeRemoteTracks=${t.activeRemoteTracks}`)
  if (t.activeOutputStreams > 1) push('MULTIPLE_OUTPUT_STREAMS', `activeOutputStreams=${t.activeOutputStreams}`)
  if (t.greetingCountThisSession > 1) push('MULTIPLE_GREETINGS', `greetingCount=${t.greetingCountThisSession}`)
  if (t.truncatedEarly) push('OUTPUT_TRUNCATED', 'output stopped before completion')
  if (t.outputStopReason === null && t.truncatedEarly) push('OUTPUT_STOP_UNEXPLAINED', 'truncated with no stop reason')
  if (t.transcriptRetryLoop) push('STT_RETRY_LOOP', 'repeated transcription failure loop')
  if (t.calendarIntentRoutedToComm) push('CAL_INTENT_TO_COMM', 'calendar intent reached the communication path')
  if (t.unresolvedRelationshipBecamePerson) push('UNRESOLVED_BECAME_PERSON', 'an unresolved relationship became a concrete person')
  if (t.fallbackAndRealtimeOverlap) push('FALLBACK_REALTIME_OVERLAP', 'fallback and realtime spoke concurrently')
  if (t.runtimeMode === 'REALTIME_ACTIVE' && t.talkOwners?.length === 1 && t.talkOwners[0] === 'legacy_brain') {
    push('WRONG_TALK_OWNER', 'legacy_brain owned TALK under REALTIME_ACTIVE')
  }
  return v
}

/** A trace PASSES only with zero violations. */
export function deviceTracePasses(t: DeviceTurnTrace): boolean { return checkDeviceTrace(t).length === 0 }
