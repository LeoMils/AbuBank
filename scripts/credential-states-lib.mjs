/*
 * credential-states-lib.mjs — PURE credential-state distinctness rules. (§33)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Four states must never collapse into one another. In particular a CLEAN current bundle does NOT imply
 * the old key was revoked, and an env-var change does NOT imply revocation. No I/O.
 */
export const CREDENTIAL_STATES = ['CREDENTIAL_REVOKED', 'OLD_PUBLIC_BUNDLE_NO_LONGER_SERVED', 'ENVIRONMENT_VARIABLE_CHANGED', 'CURRENT_BUNDLE_SECRET_CLEAN']

/**
 * Given observed facts, return what is PROVEN vs UNKNOWN. The point: no observation about bundles/env
 * may upgrade CREDENTIAL_REVOKED — only explicit owner confirmation can.
 * @param obs { currentBundleSecretClean, envVarChanged, oldBundleNoLongerServed, ownerConfirmedRevocation }
 */
export function deriveCredentialState(obs = {}) {
  return {
    CURRENT_BUNDLE_SECRET_CLEAN: obs.currentBundleSecretClean === true ? 'PROVEN' : 'UNKNOWN',
    ENVIRONMENT_VARIABLE_CHANGED: obs.envVarChanged === true ? 'PROVEN' : 'UNKNOWN',
    OLD_PUBLIC_BUNDLE_NO_LONGER_SERVED: obs.oldBundleNoLongerServed === true ? 'PROVEN' : 'UNKNOWN',
    // Revocation is PROVEN only by explicit owner confirmation — never inferred from the others.
    CREDENTIAL_REVOKED: obs.ownerConfirmedRevocation === true ? 'PROVEN' : 'UNKNOWN',
  }
}

// The forbidden implications (each must NOT hold). Used by the test to prove the states stay distinct.
export function revocationInferredFrom(obs = {}) {
  // Returns true iff any non-owner observation would (incorrectly) mark revocation PROVEN.
  const withoutOwner = deriveCredentialState({ ...obs, ownerConfirmedRevocation: false })
  return withoutOwner.CREDENTIAL_REVOKED === 'PROVEN'
}
