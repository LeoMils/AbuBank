/*
 * report-schema-lib.mjs — PURE canonical QA report schema validator. (§10/B13)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The report is the born-into schema for all evidence. This validates that a QA_MONSTER_REPORT carries
 * the required machine-state fields so narrative can never outrun the schema. No I/O.
 */
export const REQUIRED_REPORT_PATHS = [
  'mode', 'when', 'identity.RUNTIME_SOURCE_SHA', 'identity.CERTIFICATION_HARNESS_SHA',
  'identity.EVIDENCE_GENERATION_SHA', 'identity.DEPLOYED_BUILD_ID', 'identity.CONTROL_PLANE_VERSION',
  'worktree.WORKTREE_RUNTIME_CLEAN', 'verdicts.PRODUCT_CANDIDATE_VERDICT', 'verdicts.QA_SYSTEM_VERDICT',
  'verdicts.RELEASE_PROMOTION_VERDICT', 'exit.code', 'exit.state', 'counts.areas', 'areas',
]

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function validateReport(report) {
  const missing = REQUIRED_REPORT_PATHS.filter((p) => getPath(report, p) === undefined)
  return { ok: missing.length === 0, missing }
}
