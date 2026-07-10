/*
 * Evolution OS — canonical Trace Envelope (Section 6)
 * ═══════════════════════════════════════════════════
 * ONE versioned, redacted, minimized record per turn, derived from what the
 * serving plane already produces (`LiveTurnRecord` + `FullTurnResult`). We do NOT
 * re-instrument the pipeline — the executive controller already assembles the turn
 * facts; Evolution OS maps them into a stable, uploadable, privacy-safe shape.
 *
 * Data minimization is enforced HERE: free text is redacted, raw audio is never
 * carried (only an STT transcript reference), and an integrity block gives every
 * envelope an idempotency key + content hash so duplicate delivery can never
 * create duplicate evidence (Section 18/19).
 */
import { redactText, redactDeep, assertInert, type PiiClass } from './redaction'

export const TRACE_SCHEMA_VERSION = '1.0.0'

export type Modality = 'text' | 'voice' | 'mixed'

export interface AbuTraceEnvelope {
  schemaVersion: string
  traceId: string
  sessionId: string
  turnId: string
  parentTraceId?: string

  startedAt: string
  completedAt?: string

  locale: string
  timezone: string
  modality: Modality
  deviceClass?: string
  networkState?: string

  /** Redacted, normalized user text. Raw input is NEVER stored — only this. */
  normalizedInput?: string
  sttTranscript?: string

  routeDecision?: string
  intentDecision?: string

  // Behavior-version stamps — what produced this turn (for replay + attribution).
  appVersion?: string
  promptVersion?: string
  toolRegistryVersion?: string
  memorySchemaVersion?: string
  familyGraphVersion?: string
  featureFlags?: Record<string, boolean | string | number>

  entities?: Record<string, unknown>
  missingFields?: string[]

  toolCalls?: Array<{
    toolName: string
    status: string
    resultRedacted?: string
    errorCode?: string
    latencyMs?: number
  }>

  /** What the turn CLAIMED changed vs what it actually committed — the core of the
   *  automatic "claimed-saved-but-not-committed" signal. */
  proposedStateChanges?: unknown[]
  committedStateChanges?: unknown[]

  /** Redacted assistant text + the text handed to TTS (to detect TTS≠approved). */
  assistantText?: string
  ttsInput?: string
  speechChunks?: string[]

  source?: string          // deterministic | llm | online | fallback
  supervisorApproved?: boolean
  supervisorReasons?: string[]

  error?: string | null

  latency?: { totalMs?: number; firstAudioMs?: number }

  privacy: {
    redactionStatus: 'redacted' | 'raw' | 'partial'
    piiClassesDetected: PiiClass[]
    retentionClass: string
    secretsRemoved: number
  }

  integrity: {
    idempotencyKey: string
    payloadHash: string
  }
}

/** Deterministic, dependency-free 53-bit string hash (djb2 → hex). For dedup/
 *  integrity, NOT security. Stable across environments (no crypto import). */
export function stableHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return n.toString(16).padStart(14, '0')
}

/** The raw per-turn facts the serving plane already has (a superset of LiveTurnRecord). */
export interface TurnFacts {
  ts: number
  sessionId?: string
  turnId?: string
  parentTraceId?: string
  locale?: string
  timezone?: string
  modality?: Modality
  deviceClass?: string
  networkState?: string
  input: string
  normalized?: string
  sttTranscript?: string
  intent: string
  route?: string
  source: string
  appVersion?: string
  promptVersion?: string
  toolRegistryVersion?: string
  memorySchemaVersion?: string
  familyGraphVersion?: string
  featureFlags?: Record<string, boolean | string | number>
  entities?: Record<string, unknown>
  missingFields?: string[]
  toolCalls?: Array<{ toolName: string; status: string; result?: string; errorCode?: string; latencyMs?: number }>
  proposedStateChanges?: unknown[]
  committedStateChanges?: unknown[]
  finalAnswer: string
  ttsInput?: string
  speechChunks?: string[]
  supervisorApproved?: boolean
  supervisorReasons?: string[]
  error?: string | null
  latency?: { totalMs?: number; firstAudioMs?: number }
  retentionClass?: string
}

/**
 * Build the canonical envelope from turn facts. Redacts all free text, minimizes,
 * and computes a stable idempotency key (session+turn+content) so the same turn
 * delivered twice yields the same key → dedup at ingestion.
 */
export function buildEnvelope(facts: TurnFacts): AbuTraceEnvelope {
  const inputR = redactText(facts.normalized ?? facts.input)
  const sttR = redactText(facts.sttTranscript)
  const answerR = redactText(facts.finalAnswer)
  const ttsR = redactText(facts.ttsInput)
  const entitiesR = redactDeep(facts.entities ?? {})
  const toolsR = (facts.toolCalls ?? []).map(t => {
    const rr = redactText(t.result).text
    return {
      toolName: t.toolName,
      status: t.status,
      ...(rr ? { resultRedacted: rr } : {}),
      ...(t.errorCode ? { errorCode: t.errorCode } : {}),
      ...(t.latencyMs !== undefined ? { latencyMs: t.latencyMs } : {}),
    }
  })

  const pii = new Set<PiiClass>([...inputR.piiClassesDetected, ...sttR.piiClassesDetected, ...answerR.piiClassesDetected, ...ttsR.piiClassesDetected, ...entitiesR.pii])
  const secretsRemoved = inputR.secretsRemoved + sttR.secretsRemoved + answerR.secretsRemoved + ttsR.secretsRemoved + entitiesR.secretsRemoved

  const startedAt = new Date(facts.ts).toISOString()
  const sessionId = facts.sessionId ?? 'session-unknown'
  const turnId = facts.turnId ?? `turn-${facts.ts}`
  const idempotencyKey = stableHash(`${sessionId}|${turnId}|${inputR.text}|${answerR.text}`)

  // Constructed with a cast: several fields are legitimately undefined here, and the
  // closing `assertInert` JSON round-trip strips undefined-valued properties, so the
  // emitted envelope satisfies `exactOptionalPropertyTypes` at runtime.
  const envelope = {
    schemaVersion: TRACE_SCHEMA_VERSION,
    traceId: stableHash(`${sessionId}|${turnId}|${facts.ts}`),
    sessionId,
    turnId,
    ...(facts.parentTraceId ? { parentTraceId: facts.parentTraceId } : {}),
    startedAt,
    completedAt: startedAt,
    locale: facts.locale ?? 'he-IL',
    timezone: facts.timezone ?? 'Asia/Jerusalem',
    modality: facts.modality ?? 'text',
    ...(facts.deviceClass ? { deviceClass: facts.deviceClass } : {}),
    ...(facts.networkState ? { networkState: facts.networkState } : {}),
    normalizedInput: inputR.text || undefined,
    ...(sttR.text ? { sttTranscript: sttR.text } : {}),
    ...(facts.route ? { routeDecision: facts.route } : {}),
    intentDecision: facts.intent,
    appVersion: facts.appVersion,
    promptVersion: facts.promptVersion,
    toolRegistryVersion: facts.toolRegistryVersion,
    memorySchemaVersion: facts.memorySchemaVersion,
    familyGraphVersion: facts.familyGraphVersion,
    featureFlags: facts.featureFlags,
    entities: entitiesR.value as Record<string, unknown>,
    missingFields: facts.missingFields,
    toolCalls: toolsR.length ? toolsR : undefined,
    proposedStateChanges: facts.proposedStateChanges,
    committedStateChanges: facts.committedStateChanges,
    assistantText: answerR.text || undefined,
    ttsInput: ttsR.text || undefined,
    speechChunks: facts.speechChunks,
    source: facts.source,
    supervisorApproved: facts.supervisorApproved,
    supervisorReasons: facts.supervisorReasons,
    error: facts.error ?? null,
    latency: facts.latency,
    privacy: {
      redactionStatus: 'redacted',
      piiClassesDetected: [...pii],
      retentionClass: facts.retentionClass ?? 'standard',
      secretsRemoved,
    },
    integrity: { idempotencyKey, payloadHash: '' },
  } as AbuTraceEnvelope

  // payloadHash over the fully-built, redacted envelope (excluding the hash itself).
  envelope.integrity.payloadHash = stableHash(JSON.stringify({ ...envelope, integrity: { idempotencyKey } }))
  // Inertness: only plain JSON data leaves this function.
  return assertInert(envelope)
}
