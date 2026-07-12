/*
 * Shared ENGINEERING evidence schema (Foundation Release 1).
 * ═════════════════════════════════════════════════════════
 * ONE record shape for engineering evidence, used by: unit/integration results,
 * gold replays, Preview smoke checks, device reports, incident reports, and the
 * Production Acceptance Board.
 *
 * This is deliberately DISTINCT from — and NOT a replacement for — the two
 * existing runtime systems; it links to them instead of duplicating them:
 *   • src/evolution/traceEnvelope.ts  (AbuTraceEnvelope) — per-turn runtime trace.
 *     Reference it via `traceId`.
 *   • src/screens/AbuAI/evidencePacket.ts (EvidencePacket) — "what did a tool return".
 *
 * The core discipline it encodes: an evidence record may NEVER assert a stronger
 * evidence class than the environment it actually ran in.
 */

/** Ordered weakest → strongest. Order is meaningful (see `classRank`). */
export const EVIDENCE_CLASSES = [
  'CODE', 'MOCK', 'BROWSER', 'PREVIEW', 'PHYSICAL_DEVICE', 'PRODUCTION',
] as const
export type EvidenceClass = typeof EVIDENCE_CLASSES[number]

/** The environment a check actually executed in (1:1 with the evidence classes). */
export const ENVIRONMENTS = [
  'code', 'mock', 'browser', 'preview', 'physical_device', 'production',
] as const
export type Environment = typeof ENVIRONMENTS[number]

export type Verdict =
  | 'PROVEN'
  | 'PARTIALLY_PROVEN'
  | 'UNSUPPORTED_CLAIM'
  | 'DISPROVEN_BY_REAL_USER_EVIDENCE'
  | 'NOT_RUN'

export type Capability =
  | 'Voice' | 'STT' | 'TTS' | 'Online' | 'Calendar' | 'WorkingMemory'
  | 'PersistentMemory' | 'FamilyGraph' | 'FollowUp' | 'CorrectionHandling'
  | 'Grounding' | 'NaturalConversation' | 'Latency' | 'MobilePWA'
  | 'Privacy' | 'Diagnostics'

export interface EngineeringEvidence {
  capability: Capability
  scenario: string
  evidenceClass: EvidenceClass
  environment: Environment
  expected: string
  actual: string
  verdict: Verdict
  /** Earliest point actual ≠ expected (mechanism-first debugging). */
  firstDivergence?: string
  /** The runtime path exercised (e.g. "router→calendarCreate→durableStore"). */
  runtimePath?: string
  /** Provider or tool used (e.g. "openai:gpt-realtime", "idb"). */
  providerOrTool?: string
  latencyMs?: number
  commit?: string
  version?: string
  /** Link to the runtime AbuTraceEnvelope (src/evolution/traceEnvelope.ts). */
  traceId?: string
  /** Regression family/test IDs this evidence covers. */
  regressionIds?: string[]
  /** What is still NOT proven by this record (esp. device-only limits). */
  unprovenLimits?: string[]
  /** ISO-8601. Passed in (the codebase forbids Date.now() in some contexts). */
  timestamp: string
}

/** 0..5 rank of an evidence class (weakest → strongest). */
export function classRank(c: EvidenceClass): number {
  return EVIDENCE_CLASSES.indexOf(c)
}

/** The evidence class implied by an execution environment (1:1 with ENVIRONMENTS). */
export function environmentClass(env: Environment): EvidenceClass {
  // ENVIRONMENTS and EVIDENCE_CLASSES are the same length/order, and `env` is a
  // valid Environment, so the index is always in range.
  return EVIDENCE_CLASSES[ENVIRONMENTS.indexOf(env)] as EvidenceClass
}

/** True iff `actual` proves at least as much as `required`. */
export function isAtLeast(actual: EvidenceClass, required: EvidenceClass): boolean {
  return classRank(actual) >= classRank(required)
}

export interface ValidationResult { ok: boolean; errors: string[] }

/**
 * Validate an engineering evidence record. The central rule: the claimed
 * evidence class may not exceed what the environment can prove, and a PROVEN
 * verdict must carry a class that matches its environment.
 */
export function validateEvidence(e: EngineeringEvidence): ValidationResult {
  const errors: string[] = []
  if (!(EVIDENCE_CLASSES as readonly string[]).includes(e.evidenceClass)) errors.push(`invalid evidenceClass: ${e.evidenceClass}`)
  if (!(ENVIRONMENTS as readonly string[]).includes(e.environment)) errors.push(`invalid environment: ${e.environment}`)
  if (!e.scenario?.trim()) errors.push('scenario is required')
  if (!e.timestamp?.trim()) errors.push('timestamp is required')

  if (errors.length === 0) {
    // Never claim a class stronger than the environment can support.
    const envCap = environmentClass(e.environment)
    if (classRank(e.evidenceClass) > classRank(envCap)) {
      errors.push(`evidenceClass ${e.evidenceClass} exceeds what environment '${e.environment}' can prove (max ${envCap})`)
    }
    // A PROVEN device/production capability needs real device/production evidence.
    if (e.verdict === 'PROVEN' && (e.capability === 'Voice') && classRank(e.evidenceClass) < classRank('PHYSICAL_DEVICE')) {
      errors.push(`Voice cannot be PROVEN below PHYSICAL_DEVICE (got ${e.evidenceClass})`)
    }
    // A bug fix claim should carry a first divergence.
    if (e.verdict === 'PROVEN' && e.firstDivergence !== undefined && !e.firstDivergence.trim()) {
      errors.push('firstDivergence, if present, must be non-empty')
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Small constructor with sensible defaults (timestamp must be supplied by caller). */
export function createEvidence(
  input: Omit<EngineeringEvidence, 'verdict'> & Partial<Pick<EngineeringEvidence, 'verdict'>>,
): EngineeringEvidence {
  return { verdict: 'NOT_RUN', ...input }
}
