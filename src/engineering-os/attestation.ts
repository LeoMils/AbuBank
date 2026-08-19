/*
 * SOURCE→BUILD→DEPLOY ATTESTATION (o-attest).  (Stage 3C §10)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * "Golden against the deployed build" only means something if the deployed bundle == the
 * certified source. This binds three identities and refuses a silent mismatch:
 *   SOURCE  (git commit sha)  →  BUILD  (buildVersion + commit-sha stamped in the bundle)  →
 *   DEPLOY  (the /api/health buildVersion + the bundle actually served).
 * A drift at any hop is ATTESTATION_DRIFT — the deployed artifact is NOT the certified candidate.
 */

export interface AttestationInput {
  /** The candidate we intend to certify (git). */
  candidateSha: string
  candidateBuildVersion: string
  /** What the DEPLOYED runtime reports (/api/health) — read-only. */
  deployedBuildVersion: string | null
  /** The commit sha stamped INTO the deployed bundle (VITE_COMMIT_SHA), fingerprinted. */
  deployedCommitShaInBundle: string | null
  /** The candidate's own commit sha as it would be stamped (fingerprint/prefix). */
  expectedCommitShaInBundle: string
  /** Does the working tree have uncommitted/undeployed changes vs the candidate? */
  workingTreeDirty?: boolean
}

export interface AttestationResult {
  bound: boolean
  blockers: { code: string; reason: string }[]
  /** Advisory notes that are not themselves release blockers. */
  notes: string[]
}

/**
 * Attest the deploy binds to the candidate. Requires: deployed buildVersion present and equal to
 * the candidate's; the bundle-stamped commit sha equal to the candidate's expected sha. A dirty
 * working tree ahead of the candidate is a NOTE (expected during active work), not a bind failure —
 * unless the dirty runtime is what is being certified.
 */
export function evaluateAttestation(input: AttestationInput): AttestationResult {
  const blockers: { code: string; reason: string }[] = []
  const notes: string[] = []

  if (!input.deployedBuildVersion) {
    blockers.push({ code: 'ATTESTATION_NO_DEPLOY', reason: 'the deployed runtime reported no buildVersion — cannot bind deploy to source' })
  } else if (input.deployedBuildVersion !== input.candidateBuildVersion) {
    blockers.push({ code: 'ATTESTATION_DRIFT', reason: `deployed buildVersion ${input.deployedBuildVersion} != candidate ${input.candidateBuildVersion}` })
  }

  if (!input.deployedCommitShaInBundle) {
    blockers.push({ code: 'ATTESTATION_NO_COMMIT_STAMP', reason: 'the deployed bundle carries no commit-sha stamp — source→build binding unverifiable' })
  } else if (input.deployedCommitShaInBundle !== input.expectedCommitShaInBundle) {
    blockers.push({ code: 'ATTESTATION_DRIFT', reason: `deployed bundle commit-sha ${input.deployedCommitShaInBundle} != expected ${input.expectedCommitShaInBundle}` })
  }

  if (input.workingTreeDirty) {
    notes.push('working tree is ahead of the deployed candidate (uncommitted/undeployed changes) — expected during active engineering; a new candidate must be built+deployed before certifying THIS tree')
  }

  return { bound: blockers.length === 0, blockers, notes }
}
