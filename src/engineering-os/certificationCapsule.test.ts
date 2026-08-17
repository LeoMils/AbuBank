/*
 * certificationCapsule.test.ts — TAMPER-mutation proof of the Certification Capsule. (§12 / §42 / B11)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A capsule is only worth trusting if tampering is detectable. This test builds a VALID capsule from a
 * hermetic fixture (no live files — the file digests are injected), then plants each tamper class and
 * asserts verification FAILS for the right reason. Part of the enforced suite, so a regression that
 * weakens the verifier turns CI red.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling of the capsule CLIs; shared verbatim, no types.
import { buildCapsule, verifyCapsule, canonicalize, sha256Hex } from '../../scripts/certification-capsule-lib.mjs'

// Hermetic evidence: two artifacts with fixed digests. digestOf() returns exactly these → "on disk,
// unchanged". Mutating the map models a file changing/disappearing after certification.
const DISK: Record<string, string> = {
  'docs/eval/A.json': sha256Hex('content-A'),
  'docs/eval/B.json': sha256Hex('content-B'),
}
const digestOf = (p: string): string | null => DISK[p] ?? null

const validContents = () => ({
  schemaVersion: 'capsule/1',
  when: '2026-08-17T13:30:58.187Z',
  identity: {
    RUNTIME_SOURCE_SHA: '237bef9', DEPLOYED_ARTIFACT_ID: 'abu-bank-353hxn1ha.vercel.app',
    DEPLOYED_BUILD_ID: '0.291.0-earonly', CERTIFICATION_HARNESS_SHA: 'deadbeef',
    EVIDENCE_GENERATION_SHA: 'deadbeef', CONTROL_PLANE_VERSION: 'cp_bfccc899',
  },
  verdicts: { PRODUCT_CANDIDATE_VERDICT: 'GO', QA_SYSTEM_VERDICT: 'READY', RELEASE_PROMOTION_VERDICT: 'ELIGIBLE_PENDING_OWNER' },
  worktree: { WORKTREE_RUNTIME_CLEAN: true, WORKTREE_HARNESS_CLEAN: true },
  runtimeProvenance: { identity: 'PROVEN', method: 'buildVersion↔commit', RUNTIME_SOURCE_SHA: '237bef9' },
  evidence: [
    { id: 'calendar', path: 'docs/eval/A.json', digest: DISK['docs/eval/A.json'], producer: 'x', schema: 'y' },
    { id: 'secret-scan', path: 'docs/eval/B.json', digest: DISK['docs/eval/B.json'], producer: 'x', schema: 'y' },
  ],
  requiredClaims: ['calendar', 'secret-scan'],
})

describe('Certification Capsule — tamper detection (§12)', () => {
  it('a freshly built, untouched capsule verifies OK', () => {
    const cap = buildCapsule(validContents())
    const r = verifyCapsule(cap, { digestOf })
    expect(r.ok).toBe(true)
    expect(cap.capsuleId).toMatch(/^[0-9a-f]{64}$/)
  })

  it('MUTATION verdict flip after sealing → capsuleId mismatch → FAIL', () => {
    const cap = buildCapsule(validContents())
    cap.verdicts.PRODUCT_CANDIDATE_VERDICT = 'NO_GO' // tamper post-seal, id unchanged
    const r = verifyCapsule(cap, { digestOf })
    expect(r.ok).toBe(false)
    expect(r.failures.join(' ')).toMatch(/capsuleId mismatch|tampered/)
  })

  it('MUTATION evidence file changed after certification → FAIL', () => {
    const cap = buildCapsule(validContents())
    const drifted: Record<string, string> = { ...DISK, 'docs/eval/A.json': sha256Hex('content-A-EDITED') }
    const r = verifyCapsule(cap, { digestOf: (p: string) => drifted[p] ?? null })
    expect(r.ok).toBe(false)
    expect(r.failures.join(' ')).toMatch(/changed since certification/)
  })

  it('MUTATION evidence file removed → FAIL', () => {
    const cap = buildCapsule(validContents())
    const r = verifyCapsule(cap, { digestOf: (p: string) => (p === 'docs/eval/B.json' ? null : DISK[p] ?? null) })
    expect(r.ok).toBe(false)
    expect(r.failures.join(' ')).toMatch(/missing on disk/)
  })

  it('MUTATION a required claim dropped from the evidence set → FAIL', () => {
    const c = validContents()
    c.evidence = c.evidence.filter((e) => e.id !== 'secret-scan') // seal WITHOUT the secret-scan claim
    const cap = buildCapsule(c)
    const r = verifyCapsule(cap, { digestOf })
    expect(r.ok).toBe(false)
    expect(r.failures.join(' ')).toMatch(/required claim not backed by evidence: secret-scan/)
  })

  it('MUTATION runtime provenance NOT_PROVEN → fail-closed FAIL', () => {
    const c = validContents()
    c.runtimeProvenance = { identity: 'NOT_PROVEN', method: 'could not tie build to commit', RUNTIME_SOURCE_SHA: null } as never
    const cap = buildCapsule(c)
    const r = verifyCapsule(cap, { digestOf })
    expect(r.ok).toBe(false)
    expect(r.failures.join(' ')).toMatch(/provenance not PROVEN/)
  })

  it('MUTATION missing required field (identity) → FAIL', () => {
    const c = validContents() as Record<string, unknown>
    delete c.identity
    const cap = buildCapsule(c)
    const r = verifyCapsule(cap, { digestOf })
    expect(r.ok).toBe(false)
    expect(r.failures.join(' ')).toMatch(/missing required field: identity|missing identity field/)
  })

  it('MUTATION forged capsuleId (no matching contents) → FAIL', () => {
    const cap = buildCapsule(validContents())
    cap.capsuleId = 'f'.repeat(64)
    const r = verifyCapsule(cap, { digestOf })
    expect(r.ok).toBe(false)
    expect(r.failures.join(' ')).toMatch(/capsuleId mismatch/)
  })

  it('canonicalize is order-independent (stable content address)', () => {
    const a = canonicalize({ x: 1, y: [3, 2], z: { b: 2, a: 1 } })
    const b = canonicalize({ z: { a: 1, b: 2 }, y: [3, 2], x: 1 })
    expect(a).toBe(b)
    // ...but element order in arrays is significant (arrays are ordered data).
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]))
  })
})
