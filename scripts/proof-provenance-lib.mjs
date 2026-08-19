/*
 * proof-provenance-lib.mjs — PURE Proof Provenance Key + safe-reuse rules. (§12/B4)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Evidence may be reused ONLY when its Proof Provenance Key is unchanged. The key is the MINIMUM CORRECT
 * dependency set per evidence family (not "the obvious file didn't change"). An unknown/changed
 * dependency WIDENS scope (invalidates). No I/O.
 */
import { createHash } from 'node:crypto'

// Minimum correct dependency set per evidence family. A dependency NOT listed is asserted irrelevant to
// that family; an unrecognized family widens scope (returns null key → must invalidate).
export const FAMILY_DEPENDENCIES = {
  'deployed-acceptance': ['runtimeSourceSha', 'deployedBuildId', 'harnessSha', 'providerIdentity'],
  'deterministic-unit': ['harnessSha'],
  'secret-scan': ['runtimeSourceSha', 'deployedBuildId', 'scannerVersion'],
  'stochastic': ['runtimeSourceSha', 'deployedBuildId', 'providerIdentity', 'modelIdentity'],
  'historical-corpus': ['harnessSha', 'corpusVersion'],
}

export function provenanceKey(family, deps = {}) {
  const keys = FAMILY_DEPENDENCIES[family]
  if (!keys) return null // unknown family → cannot prove reuse safety → widen (invalidate)
  const material = keys.map((k) => `${k}=${deps[k] ?? 'UNKNOWN'}`).join('|')
  return `${family}:${createHash('sha256').update(material).digest('hex').slice(0, 16)}`
}

/**
 * Decide reuse vs invalidation. Reuse ONLY if the family is known, no dependency is UNKNOWN, and the key
 * matches the previously-recorded key.
 * @returns { decision: 'EVIDENCE_REUSED'|'EVIDENCE_INVALIDATED', reason, proofProvenanceKey }
 */
export function reuseDecision(family, prevKey, deps = {}) {
  const keys = FAMILY_DEPENDENCIES[family]
  if (!keys) return { decision: 'EVIDENCE_INVALIDATED', reason: `unknown evidence family "${family}" — widen scope`, proofProvenanceKey: null }
  const missing = keys.filter((k) => deps[k] === undefined || deps[k] === null)
  if (missing.length) return { decision: 'EVIDENCE_INVALIDATED', reason: `unknown dependency (${missing.join(',')}) — widen scope`, proofProvenanceKey: null }
  const key = provenanceKey(family, deps)
  if (prevKey && prevKey === key) return { decision: 'EVIDENCE_REUSED', reason: 'proof provenance key unchanged', proofProvenanceKey: key, provenUnaffectedDependencies: keys }
  return { decision: 'EVIDENCE_INVALIDATED', reason: prevKey ? 'proof provenance key changed' : 'no prior key', proofProvenanceKey: key }
}
