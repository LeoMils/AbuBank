/*
 * qa-monster-verdict.mjs — PURE mode-aware release verdict + fail-closed exit contract. (Integrity I3)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * NO I/O, NO side effects. This is the ONE code path that decides whether qa:monster signals success.
 * It is imported by BOTH:
 *   - scripts/qa-monster.mjs                              (the orchestrator that emits the report)
 *   - src/engineering-os/qaMonsterExitContract.test.ts   (the self-mutation proof / B11)
 * so a mutation test exercises the exact logic CI depends on — the fixer cannot silently weaken its
 * own judge.
 *
 * WHY THIS EXISTS (the defect it closes): the legacy orchestrator exited `pass ? 0 : 1` where `pass`
 * was the area-level roll-up. That let RC exit 0 while QA_SYSTEM=INCOMPLETE_PRODUCTIZATION and
 * RELEASE=NOT_YET — a false-success exit. Wiring that command into CI would make CI green on a system
 * that is not release-ready. The exit code MUST derive from the release state machine, and MUST
 * fail-closed (never default to success) on a missing/malformed report, a crash, an incomplete
 * denominator, or an unknown-but-claimed-pass area.
 */

// Distinct, non-overlapping exit codes. A reader (or CI) can tell WHY the run did not succeed.
export const EXIT = {
  SUCCESS: 0, // mode objective met
  USAGE: 2, // bad arguments (matches the orchestrator's argv guard)
  RELEASE_REJECTED: 3, // machine evidence says not-releasable (NO_GO / NOT_READY / remaining>0)
  INTEGRITY_FAIL: 4, // fail-closed: missing/malformed report, crash, unknown denominator, pass-by-omission
}

// The denominator each mode MUST fully cover. A missing required area is denominator shrink → fail-closed.
export const REQUIRED_AREAS = {
  feature: ['typecheck', 'unit-suite'],
  rc: ['typecheck', 'unit-suite', 'security-scan', 'calendar', 'whatsapp', 'current-info-freshness', 'replacement-paths', 'tool-sequencing', 'historical-corpus'],
  production: ['typecheck', 'unit-suite', 'security-scan', 'calendar', 'whatsapp', 'current-info-freshness', 'replacement-paths', 'tool-sequencing', 'historical-corpus'],
}

const PRODUCT_AREAS = ['security-scan', 'calendar', 'whatsapp', 'current-info-freshness', 'replacement-paths', 'tool-sequencing', 'historical-corpus']
const GATE_AREAS = ['typecheck', 'unit-suite']

/**
 * Integrity scan — the fail-closed layer. Runs BEFORE any success can be declared.
 * Returns { ok, reasons[], machineClosableUnknown } where machineClosableUnknown counts areas that
 * are CLAIMED pass but whose declared evidence file is absent/unparseable (pass-by-omission).
 */
export function scanIntegrity({ mode, areas, corpusStillOpen }) {
  const reasons = []
  const required = REQUIRED_AREAS[mode] ?? []
  const present = new Set((areas ?? []).map((a) => a.area))

  // Denominator shrink: a required area silently absent from the report.
  for (const a of required) if (!present.has(a)) reasons.push(`denominator-incomplete: missing required area "${a}"`)

  // Pass-by-omission: an area claims pass but its declared evidence file did not materialize.
  // (The orchestrator sets evidencePresent=false when a json result was declared but could not be read.)
  let machineClosableUnknown = 0
  for (const a of areas ?? []) {
    if (a.pass === true && a.evidencePresent === false) {
      machineClosableUnknown++
      reasons.push(`pass-by-omission: area "${a.area}" is pass but its evidence did not materialize`)
    }
    // A crashed/indeterminate area (no boolean pass) can never count as success.
    if (a.pass !== true && a.pass !== false) {
      machineClosableUnknown++
      reasons.push(`indeterminate: area "${a.area}" has no boolean pass verdict`)
    }
  }

  // For RC/production the historical corpus north-star must be a real number, not unknown.
  if ((mode === 'rc' || mode === 'production') && (corpusStillOpen === null || corpusStillOpen === undefined)) {
    machineClosableUnknown++
    reasons.push('historical-corpus STILL_OPEN is unknown (corpus evidence missing/unreadable)')
  }

  return { ok: reasons.length === 0, reasons, machineClosableUnknown }
}

/**
 * Derive the three non-overlapping release verdicts from machine evidence.
 * productizationComplete = Track B (B2..B13) machine-closable floor is done.
 * Owner/human gates do NOT block QA_SYSTEM readiness (they are not machine-closable) — they surface as
 * RELEASE_PROMOTION_VERDICT = ELIGIBLE_PENDING_OWNER, which is still a machine success for RC.
 */
export function deriveVerdicts({ mode, areas, corpusStillOpen, worktreeRuntimeClean, productizationComplete }) {
  const list = areas ?? []
  const productAreas = list.filter((a) => PRODUCT_AREAS.includes(a.area))
  const gateAreas = list.filter((a) => GATE_AREAS.includes(a.area))

  const PRODUCT_CANDIDATE_VERDICT = mode === 'feature'
    ? 'N/A'
    : (productAreas.length > 0 && productAreas.every((a) => a.pass) && corpusStillOpen === 0 ? 'GO' : 'NO_GO')

  const QA_SYSTEM_VERDICT = (gateAreas.length > 0 && gateAreas.every((a) => a.pass) && worktreeRuntimeClean)
    ? (productizationComplete ? 'READY' : 'INCOMPLETE_PRODUCTIZATION')
    : 'NOT_READY'

  let RELEASE_PROMOTION_VERDICT = 'NOT_YET'
  if (PRODUCT_CANDIDATE_VERDICT === 'GO' && QA_SYSTEM_VERDICT === 'READY') RELEASE_PROMOTION_VERDICT = 'ELIGIBLE_PENDING_OWNER'

  return { PRODUCT_CANDIDATE_VERDICT, QA_SYSTEM_VERDICT, RELEASE_PROMOTION_VERDICT }
}

/**
 * THE exit contract. Fail-closed first, then mode-aware success. Never defaults to success.
 * @returns { code, state, reason, verdicts, machineClosableUnknown, machineClosableRemaining }
 */
export function deriveExit({ mode, areas, corpusStillOpen, worktreeRuntimeClean, productizationComplete, machineClosableRemaining }) {
  if (!['feature', 'rc', 'production'].includes(mode)) {
    return { code: EXIT.USAGE, state: 'USAGE_ERROR', reason: `unknown mode "${mode}"`, verdicts: null, machineClosableUnknown: null, machineClosableRemaining: null }
  }

  // 1) FAIL-CLOSED integrity gate — a missing/malformed/incomplete denominator can never be success.
  const integrity = scanIntegrity({ mode, areas, corpusStillOpen })
  if (!integrity.ok) {
    return {
      code: EXIT.INTEGRITY_FAIL, state: 'INTEGRITY_FAIL', reason: integrity.reasons.join(' ; '),
      verdicts: null, machineClosableUnknown: integrity.machineClosableUnknown, machineClosableRemaining: machineClosableRemaining ?? null,
    }
  }

  const verdicts = deriveVerdicts({ mode, areas, corpusStillOpen, worktreeRuntimeClean, productizationComplete })
  const remaining = machineClosableRemaining ?? (productizationComplete ? 0 : 1)

  // 2) FEATURE mode: success iff the fast gates pass (feature machine objective complete).
  if (mode === 'feature') {
    const gatesGreen = (areas ?? []).filter((a) => GATE_AREAS.includes(a.area)).every((a) => a.pass)
    return gatesGreen
      ? { code: EXIT.SUCCESS, state: 'FEATURE_COMPLETE', reason: 'feature gates green', verdicts, machineClosableUnknown: 0, machineClosableRemaining: remaining }
      : { code: EXIT.RELEASE_REJECTED, state: 'FEATURE_INCOMPLETE', reason: 'feature gates not all green', verdicts, machineClosableUnknown: 0, machineClosableRemaining: remaining }
  }

  // 3) RC mode: success ONLY when PRODUCT=GO ∧ QA_SYSTEM=READY ∧ unknown=0 ∧ remaining=0.
  if (mode === 'rc') {
    const ok = verdicts.PRODUCT_CANDIDATE_VERDICT === 'GO' && verdicts.QA_SYSTEM_VERDICT === 'READY' && remaining === 0
    return ok
      ? { code: EXIT.SUCCESS, state: 'RC_ELIGIBLE', reason: `PRODUCT=GO QA_SYSTEM=READY remaining=0 → ${verdicts.RELEASE_PROMOTION_VERDICT}`, verdicts, machineClosableUnknown: 0, machineClosableRemaining: 0 }
      : { code: EXIT.RELEASE_REJECTED, state: 'RC_REJECTED', reason: `not RC-eligible: PRODUCT=${verdicts.PRODUCT_CANDIDATE_VERDICT} QA_SYSTEM=${verdicts.QA_SYSTEM_VERDICT} machineClosableRemaining=${remaining}`, verdicts, machineClosableUnknown: 0, machineClosableRemaining: remaining }
  }

  // 4) PRODUCTION mode: success ONLY for FULL_PRODUCTION_VERIFIED. Machine-only RC evidence is never
  //    enough — production verification is a separate, stronger evidence class (owner-authorized deploy).
  const productionVerified = verdicts.PRODUCT_CANDIDATE_VERDICT === 'GO' && verdicts.QA_SYSTEM_VERDICT === 'READY' && remaining === 0
    && (areas ?? []).find((a) => a.area === 'security-scan')?.evidence === 'PRODUCTION'
  return productionVerified
    ? { code: EXIT.SUCCESS, state: 'FULL_PRODUCTION_VERIFIED', reason: 'production evidence class + GO/READY', verdicts, machineClosableUnknown: 0, machineClosableRemaining: 0 }
    : { code: EXIT.RELEASE_REJECTED, state: 'PRODUCTION_NOT_VERIFIED', reason: 'production not verified (needs PRODUCTION-class evidence + GO/READY/remaining=0)', verdicts, machineClosableUnknown: 0, machineClosableRemaining: remaining }
}
