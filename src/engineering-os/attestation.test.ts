/*
 * ATTESTATION adversarial suite (Stage 3C §10). AT1–AT6.
 * Binds source→build→deploy; a mismatch at any hop blocks. A dirty tree ahead of the deployed
 * candidate is a NOTE, not a bind failure (do not force-certify undeployed work, but do not
 * falsely fail the deployed candidate either).
 */
import { describe, it, expect } from 'vitest'
import { evaluateAttestation, type AttestationInput } from './attestation'

const bound: AttestationInput = {
  candidateSha: 'abc123', candidateBuildVersion: '0.286.0-earonly',
  deployedBuildVersion: '0.286.0-earonly',
  deployedCommitShaInBundle: 'fp:234566f5', expectedCommitShaInBundle: 'fp:234566f5',
}

describe('attestation — source→build→deploy binding', () => {
  it('AT1 · all three identities agree → bound, zero blockers', () => {
    const r = evaluateAttestation(bound)
    expect(r.bound).toBe(true)
    expect(r.blockers).toEqual([])
  })
  it('AT2 · deployed buildVersion differs → ATTESTATION_DRIFT', () => {
    expect(evaluateAttestation({ ...bound, deployedBuildVersion: '0.285.0' }).blockers.some((b) => b.code === 'ATTESTATION_DRIFT')).toBe(true)
  })
  it('AT3 · no deployed build → ATTESTATION_NO_DEPLOY', () => {
    expect(evaluateAttestation({ ...bound, deployedBuildVersion: null }).blockers.some((b) => b.code === 'ATTESTATION_NO_DEPLOY')).toBe(true)
  })
  it('AT4 · bundle commit-sha differs → ATTESTATION_DRIFT', () => {
    expect(evaluateAttestation({ ...bound, deployedCommitShaInBundle: 'fp:deadbeef' }).blockers.some((b) => b.code === 'ATTESTATION_DRIFT')).toBe(true)
  })
  it('AT5 · no commit stamp in bundle → ATTESTATION_NO_COMMIT_STAMP', () => {
    expect(evaluateAttestation({ ...bound, deployedCommitShaInBundle: null }).blockers.some((b) => b.code === 'ATTESTATION_NO_COMMIT_STAMP')).toBe(true)
  })
  it('AT6 · a dirty working tree ahead of the deployed candidate is a NOTE, not a bind failure', () => {
    const r = evaluateAttestation({ ...bound, workingTreeDirty: true })
    expect(r.bound).toBe(true)
    expect(r.notes.length).toBeGreaterThan(0)
  })
})
