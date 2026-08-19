/*
 * authority-oracle-lib.mjs — PURE owner/human authority + P2 oracle. (C11 §44 / §45)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * OWNER_ACTION and HUMAN_RESIDUAL are escape hatches; each must carry authority/negative proof.
 * Engineering difficulty is NOT an authority class. Also enumerates/validates P2 (no P2 may hide a
 * capability/security/safety/P0-P1 failure). No I/O.
 */
export const OWNER_CLASSES = new Set([
  'PRODUCT_POLICY', 'PRIVACY_POLICY', 'BUSINESS_RISK_ACCEPTANCE',
  'INFRASTRUCTURE_SPEND', 'EXTERNAL_ACCOUNT_OWNER_ACTION', 'PRODUCTION_AUTHORIZATION',
])

export function deriveAuthorityState(ownerActions, humanResiduals) {
  const ownerWithoutProof = []
  for (const o of ownerActions ?? []) {
    const validClass = OWNER_CLASSES.has(o.authorityClass)
    const hasWhy = !!o.whyMachineCannotClose
    const hasAttempts = Array.isArray(o.machineApproachesAttempted) && o.machineApproachesAttempted.length > 0
    // FALSE_OWNER_BOUNDARY: invalid class (e.g. relabelled machine work / "engineering difficulty"),
    // or missing justification/attempts.
    if (!validClass || !hasWhy || !hasAttempts) ownerWithoutProof.push(o.id)
  }
  const humanWithoutNegProof = []
  for (const h of humanResiduals ?? []) {
    const hasNeg = !!h.negativeProofStatus && Array.isArray(h.machineApproachesAttempted) && h.machineApproachesAttempted.length > 0 && !!h.exactIrreducibleRemainder
    if (!hasNeg) humanWithoutNegProof.push(h.id)
  }
  return {
    OWNER_ACTIONS_TOTAL: (ownerActions ?? []).length,
    HUMAN_RESIDUALS_TOTAL: (humanResiduals ?? []).length,
    OWNER_ACTIONS_WITHOUT_AUTHORITY_PROOF: ownerWithoutProof.length,
    HUMAN_RESIDUALS_WITHOUT_NEGATIVE_PROOF: humanWithoutNegProof.length,
    ownerWithoutProof, humanWithoutNegProof,
    ok: ownerWithoutProof.length === 0 && humanWithoutNegProof.length === 0,
  }
}

export function deriveP2State(p2) {
  // A P2 that masks an intended capability, or lacks a severity justification, is mis-classified.
  const misclassified = (p2 ?? []).filter((x) => x.masksIntendedCapability === true || !x.whyP2NotP0P1 || !x.disposition).map((x) => x.id)
  return {
    OPEN_P2: (p2 ?? []).length,
    P2_MISCLASSIFIED: misclassified.length,
    misclassified,
    ok: misclassified.length === 0,
  }
}
