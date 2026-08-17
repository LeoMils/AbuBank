/*
 * release-policy-lib.mjs — PURE release-policy gates: rollback / emergency / env-parity. (§40/§41/§39)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * No I/O. Deterministic policy encodings the release flow enforces.
 */

// ── §40 · Rollback safety ────────────────────────────────────────────────────────────────────────
// A rollback target is INVALID if it carries any known unsafe defect.
export function rollbackValid(target = {}) {
  const reasons = []
  if (target.openP0 > 0) reasons.push('target has known P0')
  if (target.openP1 > 0) reasons.push('target has known P1')
  if (target.secretExposed) reasons.push('target has known secret exposure')
  if (target.revokedCredentialMaterial) reasons.push('target ships revoked credential material')
  if (target.otherKnownUnsafe) reasons.push('target has other known unsafe release defect')
  return { valid: reasons.length === 0, reasons }
}

// ── §41 · Emergency path — controlled degradation, never bypass ───────────────────────────────────
export const NON_DEFERRABLE = new Set([
  'known-P0', 'secret-exposure', 'privacy-violation', 'unsafe-side-effect',
  'catastrophic-data-loss', 'unrestricted-billing-relay', 'runtime-artifact-identity', 'known-insecure-rollback',
])
export function emergencyEligible(req = {}) {
  const reasons = []
  // A non-deferrable safety-kernel item can NEVER be deferred.
  for (const d of req.deferrals ?? []) if (NON_DEFERRABLE.has(d.item)) reasons.push(`non-deferrable item cannot be deferred: ${d.item}`)
  // Every deferral must carry full proof-debt metadata + owner authorization.
  for (const d of req.deferrals ?? []) {
    if (!d.reason || !d.scope || !d.expiry || !d.repaymentCondition) reasons.push(`incomplete proof-debt for ${d.item ?? '?'}`)
    if (d.ownerAuthorized !== true) reasons.push(`emergency deferral not owner-authorized: ${d.item ?? '?'}`)
  }
  // Emergency state must be explicit, never a plain GO.
  const state = reasons.length === 0 ? 'EMERGENCY_ELIGIBLE_WITH_PROOF_DEBT' : 'BLOCKED'
  return { state, eligible: reasons.length === 0, reasons }
}

// ── §39 · Environment parity — compare by NAME/SCOPE only, never values ───────────────────────────
export function envParity(requiredNames = [], presentNames = []) {
  const present = new Set(presentNames)
  const missing = requiredNames.filter((n) => !present.has(n))
  return { ok: missing.length === 0, missing }
}
