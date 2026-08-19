/*
 * current-candidate-lib.mjs — PURE canonical current-candidate discovery. (C7 / §49)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A clean-room operator must NOT be handed the candidate URL. This derives THE current candidate from
 * repository truth (RELEASE_LOCK.json is the single canonical lock), cross-checks it against the sealed
 * capsule, and is fail-closed + unique: zero → NOT_FOUND, inconsistent/duplicate → AMBIGUOUS. No I/O.
 */
export const CANDIDATE = {
  PROVEN: 'PROVEN',
  NOT_FOUND: 'CURRENT_CANDIDATE_NOT_FOUND',
  AMBIGUOUS: 'CURRENT_CANDIDATE_AMBIGUOUS',
}

/**
 * @param lock parsed RELEASE_LOCK.json (or null if missing/unreadable)
 * @param capsule parsed CERTIFICATION_CAPSULE.json (or null) — optional consistency cross-check
 * @returns { status, unique, candidate|null, reasons[] }
 */
export function deriveCurrentCandidate(lock, capsule) {
  const reasons = []
  if (!lock || typeof lock !== 'object') return { status: CANDIDATE.NOT_FOUND, unique: false, candidate: null, reasons: ['RELEASE_LOCK.json missing or unreadable'] }

  const url = lock.candidateRC
  const build = lock.buildVersion
  const runtime = lock.identity?.RUNTIME_SOURCE_SHA ?? null
  if (!url || !build) return { status: CANDIDATE.NOT_FOUND, unique: false, candidate: null, reasons: ['lock lacks candidateRC and/or buildVersion'] }

  // Consistency: if a capsule is present it must describe the SAME build — otherwise two artifacts each
  // claim to be current (the "stale candidate after runtime change" escape). Fail closed as AMBIGUOUS.
  if (capsule && typeof capsule === 'object') {
    const capBuild = capsule.identity?.DEPLOYED_BUILD_ID
    if (capBuild && capBuild !== build) {
      reasons.push(`capsule DEPLOYED_BUILD_ID (${capBuild}) != lock buildVersion (${build})`)
      return { status: CANDIDATE.AMBIGUOUS, unique: false, candidate: null, reasons }
    }
  }

  return {
    status: CANDIDATE.PROVEN,
    unique: true,
    candidate: { url, build, runtime, capsuleId: capsule?.capsuleId ?? null,
      certifyCommand: `npm run qa:monster rc ${url}`, verifyCapsuleCommand: 'npm run qa:verify-capsule' },
    reasons,
  }
}
