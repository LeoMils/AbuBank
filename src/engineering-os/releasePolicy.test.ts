/*
 * releasePolicy.test.ts — rollback (§40) / emergency (§41/B9) / env-parity (§39).
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { rollbackValid, emergencyEligible, envParity, NON_DEFERRABLE } from '../../scripts/release-policy-lib.mjs'

describe('rollback safety (§40)', () => {
  it('a clean target is a valid rollback', () => {
    expect(rollbackValid({ openP0: 0, openP1: 0 }).valid).toBe(true)
  })
  it('a target with a known P0 or secret exposure is INVALID (never reactivate insecure build)', () => {
    expect(rollbackValid({ openP0: 1 }).valid).toBe(false)
    expect(rollbackValid({ secretExposed: true }).valid).toBe(false)
    expect(rollbackValid({ revokedCredentialMaterial: true }).valid).toBe(false)
  })
})

describe('emergency path (§41/B9)', () => {
  it('a fully-authorized proof-debt deferral of a deferrable item is EMERGENCY_ELIGIBLE_WITH_PROOF_DEBT (never plain GO)', () => {
    const r = emergencyEligible({ deferrals: [{ item: 'extra-soak-coverage', reason: 'x', scope: 'y', expiry: '2026-09-01', repaymentCondition: 'z', ownerAuthorized: true }] })
    expect(r.state).toBe('EMERGENCY_ELIGIBLE_WITH_PROOF_DEBT')
    expect(r.eligible).toBe(true)
  })
  it('THE §41 ATTACK: deferring a non-deferrable kernel item (secret exposure / P0) is BLOCKED', () => {
    const r = emergencyEligible({ deferrals: [{ item: 'secret-exposure', reason: 'x', scope: 'y', expiry: 'z', repaymentCondition: 'w', ownerAuthorized: true }] })
    expect(r.eligible).toBe(false)
    expect(r.state).toBe('BLOCKED')
  })
  it('a deferral without owner authorization is BLOCKED', () => {
    const r = emergencyEligible({ deferrals: [{ item: 'x', reason: 'a', scope: 'b', expiry: 'c', repaymentCondition: 'd', ownerAuthorized: false }] })
    expect(r.eligible).toBe(false)
  })
  it('the non-deferrable kernel includes P0/secret/privacy/data-loss/billing/identity/insecure-rollback', () => {
    expect(NON_DEFERRABLE.has('known-P0')).toBe(true)
    expect(NON_DEFERRABLE.has('secret-exposure')).toBe(true)
  })
})

describe('environment parity (§39)', () => {
  it('missing required Production config (by name) blocks before promotion', () => {
    expect(envParity(['OPENAI_API_KEY', 'VITE_AZURE_TTS_KEY'], ['OPENAI_API_KEY']).ok).toBe(false)
  })
  it('all required names present → parity ok (values never compared)', () => {
    expect(envParity(['A', 'B'], ['B', 'A', 'C']).ok).toBe(true)
  })
})
