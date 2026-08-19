/*
 * qaMonsterExitContract.test.ts — SELF-MUTATION proof of the qa:monster exit contract. (Integrity I3/I5, B11)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * This test guards the ONE thing CI ultimately trusts: the process exit code of qa:monster. The legacy
 * orchestrator exited `pass ? 0 : 1`, which let RC exit 0 while QA_SYSTEM=INCOMPLETE_PRODUCTIZATION —
 * a false-success exit that would turn CI green on a non-ready system. The contract now lives in a pure
 * module (scripts/qa-monster-verdict.mjs); here we PLANT each failure mode and assert the exit is
 * non-zero for the RIGHT reason, then assert the one true success path is exit 0. A green product path
 * that also silently accepts a planted defect would fail this test.
 *
 * Evidence class: CODE (deterministic). It proves the DECISION logic, not a deployed run.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling of the orchestrator; no types, intentionally shared verbatim.
import { deriveExit, scanIntegrity, EXIT, REQUIRED_AREAS } from '../../scripts/qa-monster-verdict.mjs'

// A fully-green RC area set (all 9 required areas pass, evidence materialized). The baseline the
// mutations perturb one at a time.
const greenAreas = (mode: 'rc' | 'production' = 'rc') =>
  (REQUIRED_AREAS[mode] as string[]).map((area: string) => ({
    area,
    pass: true,
    evidencePresent: true,
    evidence: area === 'security-scan' ? (mode === 'production' ? 'PRODUCTION' : 'PREVIEW') : 'PREVIEW',
  }))

// The certified-and-productized RC world: GO product, clean runtime, Track B complete, corpus 0-open.
const readyRcInputs = () => ({
  mode: 'rc' as const,
  areas: greenAreas('rc'),
  corpusStillOpen: 0,
  worktreeRuntimeClean: true,
  productizationComplete: true,
})

describe('qa:monster exit contract — fail-closed & mode-aware (I3/I5)', () => {
  it('the one true RC success path exits 0 (GO + READY + remaining=0)', () => {
    const d = deriveExit(readyRcInputs())
    expect(d.code).toBe(EXIT.SUCCESS)
    expect(d.state).toBe('RC_ELIGIBLE')
    expect(d.verdicts.PRODUCT_CANDIDATE_VERDICT).toBe('GO')
    expect(d.verdicts.QA_SYSTEM_VERDICT).toBe('READY')
    expect(d.verdicts.RELEASE_PROMOTION_VERDICT).toBe('ELIGIBLE_PENDING_OWNER')
  })

  it('MUTATION false-success: productization incomplete → RC is REJECTED, not exit 0', () => {
    // This is the exact legacy defect: area-level pass true, but B2..B13 not done.
    const d = deriveExit({ ...readyRcInputs(), productizationComplete: false })
    expect(d.code).toBe(EXIT.RELEASE_REJECTED)
    expect(d.verdicts.QA_SYSTEM_VERDICT).toBe('INCOMPLETE_PRODUCTIZATION')
    expect(d.code).not.toBe(EXIT.SUCCESS)
  })

  it('MUTATION product NO_GO: a failing product area → REJECTED', () => {
    const areas = greenAreas('rc').map((a) => (a.area === 'calendar' ? { ...a, pass: false } : a))
    const d = deriveExit({ ...readyRcInputs(), areas })
    expect(d.code).toBe(EXIT.RELEASE_REJECTED)
    expect(d.verdicts.PRODUCT_CANDIDATE_VERDICT).toBe('NO_GO')
  })

  it('MUTATION dirty runtime worktree → QA_SYSTEM NOT_READY → REJECTED', () => {
    const d = deriveExit({ ...readyRcInputs(), worktreeRuntimeClean: false })
    expect(d.code).toBe(EXIT.RELEASE_REJECTED)
    expect(d.verdicts.QA_SYSTEM_VERDICT).toBe('NOT_READY')
  })

  it('MUTATION denominator shrink: a required area silently missing → INTEGRITY_FAIL', () => {
    const areas = greenAreas('rc').filter((a) => a.area !== 'security-scan')
    const d = deriveExit({ ...readyRcInputs(), areas })
    expect(d.code).toBe(EXIT.INTEGRITY_FAIL)
    expect(d.reason).toMatch(/security-scan/)
  })

  it('MUTATION pass-by-omission: area claims pass but evidence did not materialize → INTEGRITY_FAIL', () => {
    const areas = greenAreas('rc').map((a) => (a.area === 'historical-corpus' ? { ...a, evidencePresent: false } : a))
    const d = deriveExit({ ...readyRcInputs(), areas })
    expect(d.code).toBe(EXIT.INTEGRITY_FAIL)
    expect(d.machineClosableUnknown).toBeGreaterThan(0)
  })

  it('MUTATION crashed/indeterminate area (no boolean pass) → INTEGRITY_FAIL, never success', () => {
    const areas = greenAreas('rc').map((a) => (a.area === 'whatsapp' ? { ...a, pass: undefined as unknown as boolean } : a))
    const d = deriveExit({ ...readyRcInputs(), areas })
    expect(d.code).toBe(EXIT.INTEGRITY_FAIL)
  })

  it('MUTATION unknown corpus north-star (missing corpus evidence) → INTEGRITY_FAIL, not GO', () => {
    const d = deriveExit({ ...readyRcInputs(), corpusStillOpen: null })
    expect(d.code).toBe(EXIT.INTEGRITY_FAIL)
    expect(d.reason).toMatch(/corpus|STILL_OPEN/i)
  })

  it('MUTATION corpus has an open escape (STILL_OPEN>0) → product NO_GO', () => {
    const d = deriveExit({ ...readyRcInputs(), corpusStillOpen: 1 })
    expect(d.code).toBe(EXIT.RELEASE_REJECTED)
    expect(d.verdicts.PRODUCT_CANDIDATE_VERDICT).toBe('NO_GO')
  })

  it('feature mode: green gates exit 0; a red gate is non-zero', () => {
    const green = deriveExit({ mode: 'feature', areas: [{ area: 'typecheck', pass: true, evidencePresent: true }, { area: 'unit-suite', pass: true, evidencePresent: true }], corpusStillOpen: 0, worktreeRuntimeClean: true, productizationComplete: false })
    expect(green.code).toBe(EXIT.SUCCESS)
    expect(green.state).toBe('FEATURE_COMPLETE')
    const red = deriveExit({ mode: 'feature', areas: [{ area: 'typecheck', pass: false, evidencePresent: true }, { area: 'unit-suite', pass: true, evidencePresent: true }], corpusStillOpen: 0, worktreeRuntimeClean: true, productizationComplete: false })
    expect(red.code).not.toBe(EXIT.SUCCESS)
  })

  it('production mode: RC-class (PREVIEW) evidence is NOT enough — needs PRODUCTION class', () => {
    // Even fully green + productized, PREVIEW-class security evidence cannot verify PRODUCTION.
    const previewGreen = deriveExit({ ...readyRcInputs(), mode: 'production' })
    expect(previewGreen.code).toBe(EXIT.RELEASE_REJECTED)
    expect(previewGreen.state).toBe('PRODUCTION_NOT_VERIFIED')
    // With genuine PRODUCTION-class evidence it verifies.
    const prodGreen = deriveExit({ mode: 'production', areas: greenAreas('production'), corpusStillOpen: 0, worktreeRuntimeClean: true, productizationComplete: true })
    expect(prodGreen.code).toBe(EXIT.SUCCESS)
    expect(prodGreen.state).toBe('FULL_PRODUCTION_VERIFIED')
  })

  it('unknown mode → USAGE exit, never success', () => {
    const d = deriveExit({ mode: 'bogus' as unknown as 'rc', areas: [], corpusStillOpen: 0, worktreeRuntimeClean: true, productizationComplete: true })
    expect(d.code).toBe(EXIT.USAGE)
  })

  it('scanIntegrity is the fail-closed layer: empty RC report is never ok', () => {
    const s = scanIntegrity({ mode: 'rc', areas: [], corpusStillOpen: null })
    expect(s.ok).toBe(false)
    expect(s.reasons.length).toBeGreaterThan(0)
  })
})
