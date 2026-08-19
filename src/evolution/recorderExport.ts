/*
 * Flight Recorder — export (runtime-safe).
 * ════════════════════════════════════════
 * Pure, dependency-light export of captured turns. Lives in src/evolution (runtime)
 * so the Settings screen can import it WITHOUT pulling the eval/replay harness (and
 * the whole controller) into the app bundle. The eval importer
 * (src/eval/flightRecorderImport.ts) re-exports these so there is ONE export shape.
 *
 * Everything here is text-only: a trace envelope never carried audio, and the
 * serialized form is asserted to contain no audio field by the standing suite.
 */
import type { AbuTraceEnvelope } from './traceEnvelope'
import { getObserver } from './observer'

export const FLIGHT_RECORDER_EXPORT_VERSION = '1.0.0'

const HE_RE = /[֐-׿]/

/** One recorded turn in an exported transcript. All text is already redacted. */
export interface FlightRecorderTurn {
  input: string
  lang?: 'he' | 'es'
  recordedReply?: string
  expectContains?: string[]
  expectAbsent?: string[]
  expectSide?: string
  note?: string
}
export interface FlightRecorderSession { id: string; turns: FlightRecorderTurn[] }
export interface FlightRecorderExport {
  version: string
  exportedAt?: string
  appVersion?: string
  sessions: FlightRecorderSession[]
}

const inferLang = (s: string): 'he' | 'es' => (HE_RE.test(s) ? 'he' : 'es')

/** Map redacted trace envelopes → the export shape (grouped by session, ordered by time). */
export function envelopesToExport(envelopes: AbuTraceEnvelope[], meta?: { exportedAt?: string; appVersion?: string }): FlightRecorderExport {
  const bySession = new Map<string, AbuTraceEnvelope[]>()
  for (const e of envelopes) {
    const arr = bySession.get(e.sessionId) ?? []
    arr.push(e)
    bySession.set(e.sessionId, arr)
  }
  const sessions: FlightRecorderSession[] = []
  for (const [id, arr] of bySession) {
    const ordered = [...arr].sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : a.turnId < b.turnId ? -1 : 1))
    const turns: FlightRecorderTurn[] = ordered.map((e) => {
      const input = e.normalizedInput ?? ''
      const side = Array.isArray(e.committedStateChanges) && e.committedStateChanges.length
        ? String(e.committedStateChanges[0]) : undefined
      return {
        input,
        lang: inferLang(input),
        ...(e.assistantText ? { recordedReply: e.assistantText } : {}),
        ...(side ? { expectSide: side } : {}),
      }
    })
    sessions.push({ id, turns })
  }
  return {
    version: FLIGHT_RECORDER_EXPORT_VERSION,
    ...(meta?.exportedAt ? { exportedAt: meta.exportedAt } : {}),
    ...(meta?.appVersion ? { appVersion: meta.appVersion } : {}),
    sessions,
  }
}

/** The data an export button downloads: a text-only JSON transcript. */
export function serializeExport(exp: FlightRecorderExport): string {
  return JSON.stringify(exp, null, 2)
}

export function parseExport(json: string): FlightRecorderExport {
  const data = JSON.parse(json) as FlightRecorderExport
  if (!data || !Array.isArray(data.sessions)) throw new Error('flight-recorder: not a valid export (missing sessions[])')
  return data
}

/**
 * Read the locally-captured envelopes from the durable evidence queue and return a
 * ready-to-download transcript. Never throws (returns an empty export on any error) —
 * the export button must be safe for an 80+ user to tap. `appVersion`/`exportedAt`
 * are supplied by the caller (kept impure-free so this stays testable).
 */
export function exportStoredTranscript(meta?: { exportedAt?: string; appVersion?: string }): FlightRecorderExport {
  try {
    const records = getObserver().getQueue().all()
    const envelopes = records.map((r) => r.envelope).filter(Boolean)
    return envelopesToExport(envelopes, meta)
  } catch {
    return { version: FLIGHT_RECORDER_EXPORT_VERSION, sessions: [] }
  }
}
