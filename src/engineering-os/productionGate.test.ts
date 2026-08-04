/*
 * Deterministic production gate — adversarial contract tests.
 * Proves the gate (a) CAN pass on a legitimately-complete fixture (not always-fail),
 * and (b) REJECTS every false-green / gamed-evidence class the bootstrap enumerated.
 * If someone neutered evaluateGate to "always pass", the rejection tests below go RED.
 */
import { describe, it, expect } from 'vitest'
import { evaluateGate, EVIDENCE_LADDER, type Scorecard, type ScorecardRow } from './productionGate'

const FULL_SHA = 'abcdef0123456789abcdef0123456789abcdef01' // valid 40-hex
function provenRow(over: Partial<ScorecardRow> = {}): ScorecardRow {
  return {
    id: 'R1', surface: 'realtime/x', severity: 'High', classification: 'automatable',
    owner: 'main', oracle: 'unit test', minEvidenceClass: 'UNIT', currentEvidenceClass: 'UNIT',
    tests: ['x.test.ts'], evidenceArtifact: 'evidence.json',
    fingerprint: { commit: 'c1', build: 'b1' }, rollbackTrigger: 'git revert', status: 'PROVEN',
    ...over,
  }
}
function card(rows: ScorecardRow[], build = 'b1', commit = FULL_SHA): Scorecard {
  return { schemaVersion: 2, evidenceLadder: EVIDENCE_LADDER, fingerprint: { commit, build }, rows }
}
/** All new fs/inventory checks satisfied — used by the "CAN pass" test. */
const passOpts = { fast: true, fileExists: () => true, requiredInventoryIds: ['R1', 'R2'] }

describe('production gate — a complete fixture CAN pass (not an always-fail gate)', () => {
  it('passes when every automatable Critical/High row is truly PROVEN', () => {
    const rows = [provenRow(), provenRow({ id: 'R2', severity: 'Critical', tests: ['y.test.ts'], evidenceArtifact: 'other.json' })]
    const r = evaluateGate(card(rows), passOpts)
    expect(r.pass).toBe(true)
    expect(r.automatableCriticalHighOpen).toBe(0)
    expect(r.reasons).toEqual([])
  })
})

describe('production gate — rejects every false-green class', () => {
  it('rejects an OPEN row (GAP / PARTIAL / TESTED_NOT_DEPLOYED)', () => {
    for (const status of ['GAP', 'PARTIAL', 'TESTED_NOT_DEPLOYED'] as const) {
      const r = evaluateGate(card([provenRow({ status })]), { fast: true })
      expect(r.pass, status).toBe(false)
      expect(r.reasons.some((x) => x.code === 'OPEN_ROW')).toBe(true)
    }
  })

  it('rejects fabricated green: PROVEN with no tests and no evidence artifact', () => {
    const r = evaluateGate(card([provenRow({ tests: [], evidenceArtifact: '' })]), { fast: true })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'FALSE_GREEN')).toBe(true)
  })

  it('rejects an evidence-class deficit (claims PROVEN below its required class)', () => {
    const r = evaluateGate(card([provenRow({ minEvidenceClass: 'DEPLOYED_PREVIEW', currentEvidenceClass: 'UNIT' })]), { fast: true })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'EVIDENCE_DEFICIT')).toBe(true)
  })

  it('rejects a stale row build (green fingerprinted to an old candidate)', () => {
    const r = evaluateGate(card([provenRow({ fingerprint: { commit: 'c1', build: 'OLD' } })]), { fast: true })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'STALE_ROW_BUILD')).toBe(true)
  })

  it('rejects a stale scorecard fingerprint vs the real HEAD (non-fast)', () => {
    const r = evaluateGate(card([provenRow()]), { actualCommit: 'DIFFERENT' })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'STALE_FINGERPRINT')).toBe(true)
  })

  it('rejects a fake PHYSICAL_ONLY (automatable row hidden as physical, or no proof)', () => {
    const misclassified = evaluateGate(card([provenRow({ status: 'PHYSICAL_ONLY' })]), { fast: true })
    expect(misclassified.reasons.some((x) => x.code === 'MISCLASSIFIED_PHYSICAL')).toBe(true)
    const noProof = evaluateGate(card([provenRow({ classification: 'physical', status: 'PHYSICAL_ONLY' })]), { fast: true })
    expect(noProof.reasons.some((x) => x.code === 'FAKE_PHYSICAL_BLOCKER')).toBe(true)
  })

  it('rejects a fake EXTERNAL_BLOCKER (no concrete failed-access proof)', () => {
    const r = evaluateGate(card([provenRow({ classification: 'external', severity: 'Medium', status: 'EXTERNAL_BLOCKER' })]), { fast: true })
    expect(r.reasons.some((x) => x.code === 'FAKE_EXTERNAL_BLOCKER')).toBe(true)
  })

  it('rejects an automatable Critical/High surface hidden as external/physical without proof', () => {
    const r = evaluateGate(card([provenRow({ classification: 'external', status: 'GAP' })]), { fast: true })
    expect(r.reasons.some((x) => x.code === 'UNPROVEN_BLOCKER_HIDES_WORK')).toBe(true)
  })

  it('rejects a downgraded/invalid severity and a missing required field', () => {
    const badSev = evaluateGate(card([provenRow({ severity: 'Trivial' as unknown as ScorecardRow['severity'] })]), { fast: true })
    expect(badSev.reasons.some((x) => x.code === 'BAD_SEVERITY')).toBe(true)
    const missing = provenRow(); delete (missing as Partial<ScorecardRow>).rollbackTrigger
    const r = evaluateGate(card([missing]), { fast: true })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'MISSING_FIELD' || x.code === 'MISSING_ROLLBACK')).toBe(true)
  })

  it('rejects an empty scorecard and a non-object', () => {
    expect(evaluateGate(card([]), { fast: true }).reasons.some((x) => x.code === 'EMPTY')).toBe(true)
    expect(evaluateGate(null, { fast: true }).reasons.some((x) => x.code === 'INVALID_SCORECARD')).toBe(true)
  })

  it('rejects duplicate row ids', () => {
    const r = evaluateGate(card([provenRow(), provenRow()]), { fast: true })
    expect(r.reasons.some((x) => x.code === 'DUPLICATE_ID')).toBe(true)
  })
})

describe('production gate — hardened bypass rejections (hostile review)', () => {
  it('rejects a DELETED / omitted required inventory row (cannot pass by removing a row)', () => {
    const r = evaluateGate(card([provenRow()]), { fast: true, requiredInventoryIds: ['R1', 'DELETED-ROW'] })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'MISSING_INVENTORY_ROW' && x.id === 'DELETED-ROW')).toBe(true)
  })

  it('rejects a PROVEN row that cites a NONEXISTENT test file (deleted evidence)', () => {
    const r = evaluateGate(card([provenRow({ tests: ['ghost.test.ts'] })]), { fast: true, fileExists: () => false })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'MISSING_TEST_FILE')).toBe(true)
  })

  it('rejects a PROVEN row that cites a NONEXISTENT evidence artifact', () => {
    const r = evaluateGate(card([provenRow({ tests: ['ok.test.ts'], evidenceArtifact: 'docs/gone.md' })]), { fast: true, fileExists: (p) => !p.includes('gone') })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'MISSING_EVIDENCE_ARTIFACT')).toBe(true)
  })

  it('rejects a PREFIX-ONLY (non 40-hex) commit fingerprint', () => {
    const r = evaluateGate(card([provenRow()], 'b1', 'ceda213'), { fast: true })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'PREFIX_ONLY_FINGERPRINT')).toBe(true)
  })

  it('rejects COPIED evidence: two PROVEN rows with an identical evidence signature', () => {
    const a = provenRow({ id: 'R1', tests: ['same.test.ts'], evidenceArtifact: 'same.json' })
    const b = provenRow({ id: 'R2', tests: ['same.test.ts'], evidenceArtifact: 'same.json' })
    const r = evaluateGate(card([a, b]), { fast: true, fileExists: () => true })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'DUPLICATE_EVIDENCE')).toBe(true)
  })

  it('rejects harness evidence substituted for a user-visible (BROWSER+) row', () => {
    const r = evaluateGate(card([provenRow({ minEvidenceClass: 'BROWSER', currentEvidenceClass: 'INTEGRATION' })]), { fast: true, fileExists: () => true })
    expect(r.pass).toBe(false)
    expect(r.reasons.some((x) => x.code === 'EVIDENCE_DEFICIT')).toBe(true)
  })
})
