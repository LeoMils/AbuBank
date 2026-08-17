/*
 * certification-capsule-lib.mjs — PURE content-addressed release-proof primitives. (§12 / §42)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * NO I/O. Shared by the generator (scripts/certification-capsule.mjs), the verifier
 * (scripts/verify-capsule.mjs) and the tamper-mutation test (src/engineering-os/certificationCapsule.test.ts)
 * so one code path decides what a valid capsule is. The capsule answers, from itself alone:
 *   WHAT was certified · WHICH artifact · WHICH harness · WHICH evidence · WHICH external deps · WHY.
 * It is content-addressed: CAPSULE_ID = sha256(canonical(capsule-without-id)). Any post-certification
 * tamper (verdict flip, evidence edit/removal, identity change, dropped claim) breaks verification.
 */
import { createHash } from 'node:crypto'

// Deterministic serialization: recursively sort object keys so the hash is stable across runs/machines.
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  const keys = Object.keys(value).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}'
}

export function sha256Hex(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex')
}

// The fields a capsule MUST carry. A missing one is an integrity failure (never success by omission).
export const REQUIRED_CAPSULE_FIELDS = [
  'schemaVersion', 'when', 'identity', 'verdicts', 'worktree', 'evidence', 'runtimeProvenance', 'requiredClaims',
]
export const REQUIRED_IDENTITY_FIELDS = [
  'RUNTIME_SOURCE_SHA', 'DEPLOYED_ARTIFACT_ID', 'DEPLOYED_BUILD_ID', 'CERTIFICATION_HARNESS_SHA',
  'EVIDENCE_GENERATION_SHA', 'CONTROL_PLANE_VERSION',
]
export const REQUIRED_VERDICTS = ['PRODUCT_CANDIDATE_VERDICT', 'QA_SYSTEM_VERDICT', 'RELEASE_PROMOTION_VERDICT']

/**
 * Assemble a capsule and stamp it with its content address. `contents` is everything EXCEPT capsuleId.
 * Digests of referenced evidence are supplied by the caller (computed from file bytes) — the lib never
 * reads files, so the same builder is hermetic in a test.
 */
export function buildCapsule(contents) {
  const capsuleId = sha256Hex(canonicalize(contents))
  return { ...contents, capsuleId }
}

/**
 * Verify a capsule. `deps.digestOf(path)` returns the CURRENT sha256 of an evidence file, or null if
 * it no longer exists. Returns { ok, failures[] }. Fail-closed: any missing field / hash mismatch /
 * evidence drift / dropped claim / unproven runtime identity is a failure.
 */
export function verifyCapsule(capsule, deps = {}) {
  const failures = []
  const digestOf = deps.digestOf ?? (() => null)

  if (!capsule || typeof capsule !== 'object') return { ok: false, failures: ['capsule is not an object'] }

  // 1) Content address: recompute over everything except capsuleId itself.
  const { capsuleId, ...contents } = capsule
  const recomputed = sha256Hex(canonicalize(contents))
  if (!capsuleId) failures.push('missing capsuleId')
  else if (recomputed !== capsuleId) failures.push(`capsuleId mismatch (tampered): recorded ${capsuleId?.slice(0, 12)} != actual ${recomputed.slice(0, 12)}`)

  // 2) Required top-level fields.
  for (const f of REQUIRED_CAPSULE_FIELDS) if (!(f in contents)) failures.push(`missing required field: ${f}`)

  // 3) Required identity + verdict fields present.
  for (const f of REQUIRED_IDENTITY_FIELDS) if (!contents.identity || contents.identity[f] === undefined || contents.identity[f] === null) failures.push(`missing identity field: ${f}`)
  for (const v of REQUIRED_VERDICTS) if (!contents.verdicts || contents.verdicts[v] === undefined) failures.push(`missing verdict: ${v}`)

  // 4) Runtime provenance must be authoritative. NOT_PROVEN fails closed.
  if (!contents.runtimeProvenance || contents.runtimeProvenance.identity !== 'PROVEN') {
    failures.push(`runtime provenance not PROVEN (got ${contents.runtimeProvenance?.identity ?? 'undefined'})`)
  }

  // 5) Every referenced evidence artifact must still exist and match its recorded digest.
  for (const e of contents.evidence ?? []) {
    if (!e.digest) { failures.push(`evidence ${e.id ?? e.path} has no recorded digest`); continue }
    const current = digestOf(e.path)
    if (current === null) failures.push(`evidence missing on disk: ${e.path}`)
    else if (current !== e.digest) failures.push(`evidence changed since certification: ${e.path}`)
  }

  // 6) No required claim may have disappeared from the evidence set.
  const evidenceIds = new Set((contents.evidence ?? []).map((e) => e.id))
  for (const c of contents.requiredClaims ?? []) if (!evidenceIds.has(c)) failures.push(`required claim not backed by evidence: ${c}`)

  return { ok: failures.length === 0, failures }
}
