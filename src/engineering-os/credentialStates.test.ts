/*
 * credentialStates.test.ts — proof the 4 credential states stay distinct. (§33)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The canonical incident: inferring CREDENTIAL_REVOKED from a clean bundle / env edit. Revocation is
 * PROVEN only by explicit owner confirmation.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { deriveCredentialState, revocationInferredFrom, CREDENTIAL_STATES } from '../../scripts/credential-states-lib.mjs'

describe('credential-state distinctness (§33)', () => {
  it('there are exactly four distinct states', () => {
    expect(new Set(CREDENTIAL_STATES).size).toBe(4)
  })

  it('a CLEAN current bundle does NOT imply the old key was revoked', () => {
    const s = deriveCredentialState({ currentBundleSecretClean: true })
    expect(s.CURRENT_BUNDLE_SECRET_CLEAN).toBe('PROVEN')
    expect(s.CREDENTIAL_REVOKED).toBe('UNKNOWN')
  })

  it('an env-var change does NOT imply revocation', () => {
    expect(deriveCredentialState({ envVarChanged: true }).CREDENTIAL_REVOKED).toBe('UNKNOWN')
  })

  it('old bundle no longer served does NOT imply revocation (may still be retrievable elsewhere)', () => {
    expect(deriveCredentialState({ oldBundleNoLongerServed: true }).CREDENTIAL_REVOKED).toBe('UNKNOWN')
  })

  it('NO combination of non-owner observations can infer revocation', () => {
    expect(revocationInferredFrom({ currentBundleSecretClean: true, envVarChanged: true, oldBundleNoLongerServed: true })).toBe(false)
  })

  it('ONLY explicit owner confirmation proves revocation', () => {
    expect(deriveCredentialState({ ownerConfirmedRevocation: true }).CREDENTIAL_REVOKED).toBe('PROVEN')
  })
})
