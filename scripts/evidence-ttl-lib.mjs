/*
 * evidence-ttl-lib.mjs — PURE evidence TTL + external-drift invalidation. (§13/§29/B8)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Evidence TTL varies by class: static deterministic proof lives long, runtime/provider proof shorter,
 * current-info shortest. External drift (provider/model/alias) invalidates proof with NO code commit.
 * No wall-clock is read here (tests pass timestamps in); pure functions only.
 */
// TTL in hours by evidence class. null = no time-expiry (deterministic), but may still drift-invalidate.
export const TTL_HOURS = {
  CODE: null,
  DETERMINISTIC: null,
  DEPLOYED_STATIC: 720,     // 30d — a deployed deterministic proof
  PROVIDER_BACKED: 168,     // 7d — model/provider behaviour can drift
  CURRENT_INFO: 6,          // freshness expires fast
  STOCHASTIC: 168,
}

export function isExpired(evidenceClass, ageHours) {
  const ttl = TTL_HOURS[evidenceClass]
  if (ttl === undefined) return true // unknown class → treat as expired (fail-closed)
  if (ttl === null) return false
  return ageHours > ttl
}

/**
 * Drift invalidation: if any tracked external identity changed vs when the evidence was produced, the
 * evidence is invalid regardless of age or code commit.
 * @param sealed identities recorded when evidence was produced
 * @param current identities observed now
 * @returns { invalidated, driftedKeys }
 */
export function driftInvalidated(sealed = {}, current = {}) {
  const tracked = ['modelIdentity', 'providerIdentity', 'realtimeApiVersion', 'searchProvider', 'deploymentAlias', 'swVersion']
  const driftedKeys = tracked.filter((k) => sealed[k] !== undefined && current[k] !== undefined && sealed[k] !== current[k])
  return { invalidated: driftedKeys.length > 0, driftedKeys }
}

export function evidenceValid(evidenceClass, ageHours, sealed, current) {
  const expired = isExpired(evidenceClass, ageHours)
  const drift = driftInvalidated(sealed, current)
  return { valid: !expired && !drift.invalidated, expired, ...drift }
}
