/*
 * Evolution OS — secure ingestion boundary (Section 19)
 * ═════════════════════════════════════════════════════
 * The trust boundary between (untrusted) production evidence and the learning
 * pipeline. A pure, deterministic transform so it is fully testable and can be
 * hosted unchanged behind a serverless function later. TODAY it runs locally:
 * no server datastore is provisioned, and provisioning one is a STOP condition
 * (infra/credentials) — so the vertical slice is client-durable + this boundary.
 *
 * Responsibilities: validate schema version, enforce payload limits, reject
 * malformed events, redact/secret-scan, attach a server-receipt time, verify
 * idempotency, and route failures to a dead-letter path. Production content is
 * DATA — it is never interpreted as instructions/code (structural inertness).
 */
import { redactDeep, assertInert, looksLikeInjection } from './redaction'
import { TRACE_SCHEMA_VERSION, type AbuTraceEnvelope } from './traceEnvelope'

export interface IngestionPolicy {
  acceptedSchemaVersions: string[]
  maxPayloadBytes: number
}

export const DEFAULT_INGESTION_POLICY: IngestionPolicy = {
  acceptedSchemaVersions: [TRACE_SCHEMA_VERSION],
  maxPayloadBytes: 32 * 1024,
}

export interface AcceptedEvent {
  idempotencyKey: string
  receivedAt: string
  envelope: AbuTraceEnvelope
  injectionSuspected: boolean
  secretsRemovedAtBoundary: number
}

export type IngestionOutcome =
  | { status: 'accepted'; event: AcceptedEvent }
  | { status: 'deduped'; idempotencyKey: string }
  | { status: 'rejected'; reason: string; deadLetter: boolean }

/**
 * Ingest one raw event. `seenKeys` is the idempotency ledger (a Set the caller
 * owns — server-side it would be a unique index). Malformed → rejected+deadLetter;
 * unsupported schema → rejected (not dead-lettered — it may be a newer client).
 */
export function ingestEvent(
  raw: unknown,
  seenKeys: Set<string>,
  receivedAt: string,
  policy: IngestionPolicy = DEFAULT_INGESTION_POLICY,
): IngestionOutcome {
  // 1) Structural validity.
  if (raw === null || typeof raw !== 'object') return { status: 'rejected', reason: 'not_an_object', deadLetter: true }
  const obj = raw as Record<string, unknown>

  // 2) Payload limit (measured on the raw input).
  let serialized: string
  try { serialized = JSON.stringify(obj) } catch { return { status: 'rejected', reason: 'unserializable', deadLetter: true } }
  if (serialized.length > policy.maxPayloadBytes) return { status: 'rejected', reason: 'oversized', deadLetter: true }

  // 3) Schema version.
  const schemaVersion = obj.schemaVersion
  if (typeof schemaVersion !== 'string') return { status: 'rejected', reason: 'missing_schema_version', deadLetter: true }
  if (!policy.acceptedSchemaVersions.includes(schemaVersion)) return { status: 'rejected', reason: `unsupported_schema:${schemaVersion}`, deadLetter: false }

  // 4) Required identity + integrity.
  const integrity = obj.integrity as { idempotencyKey?: unknown } | undefined
  const idempotencyKey = integrity?.idempotencyKey
  if (typeof idempotencyKey !== 'string' || !idempotencyKey) return { status: 'rejected', reason: 'missing_idempotency_key', deadLetter: true }

  // 5) Idempotency — duplicate delivery must NOT create duplicate evidence.
  if (seenKeys.has(idempotencyKey)) return { status: 'deduped', idempotencyKey }

  // 6) Redact + secret-scan at the boundary (defense in depth — client already
  //    redacted, but the boundary re-redacts because it does not trust the client).
  const { value: cleaned, secretsRemoved } = redactDeep(obj)

  // 7) Injection heuristic (flag, do NOT execute — the content is inert data).
  const injectionSuspected = looksLikeInjection(serialized)

  // 8) Inertness: only plain JSON data proceeds. This is where "production content
  //    can never become executable" is made structural.
  const envelope = assertInert(cleaned) as AbuTraceEnvelope

  seenKeys.add(idempotencyKey)
  return {
    status: 'accepted',
    event: { idempotencyKey, receivedAt, envelope, injectionSuspected, secretsRemovedAtBoundary: secretsRemoved },
  }
}

/** Batch ingest — same idempotency ledger across the batch. Returns per-event outcomes. */
export function ingestBatch(rawEvents: unknown[], seenKeys: Set<string>, receivedAt: string, policy?: IngestionPolicy): IngestionOutcome[] {
  return rawEvents.map(e => ingestEvent(e, seenKeys, receivedAt, policy))
}
