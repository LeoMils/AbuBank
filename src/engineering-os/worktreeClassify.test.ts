/*
 * worktreeClassify.test.ts — the clean-certification detector. (§5 / Check 5)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * SENSITIVITY: a dirty executable harness file makes WORKTREE_HARNESS_CLEAN=false (a dirty-harness
 * capsule can never be the FINAL clean capsule). SPECIFICITY: generated/doc churn does not.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { classifyDirty, isHarnessFile, isRuntimeFile } from '../../scripts/worktree-classify-lib.mjs'

describe('worktree clean-certification classifier (§5)', () => {
  it('SENSITIVITY: a dirty *.test.ts / scripts / workflow file → HARNESS dirty (not clean)', () => {
    expect(classifyDirty(['src/engineering-os/foo.test.ts']).WORKTREE_HARNESS_CLEAN).toBe(false)
    expect(classifyDirty(['scripts/qa-monster.mjs']).WORKTREE_HARNESS_CLEAN).toBe(false)
    expect(classifyDirty(['.github/workflows/ci.yml']).WORKTREE_HARNESS_CLEAN).toBe(false)
  })

  it('SENSITIVITY: a dirty runtime file (api/ or src/ non-test) → RUNTIME dirty', () => {
    expect(classifyDirty(['api/health.ts']).WORKTREE_RUNTIME_CLEAN).toBe(false)
    expect(classifyDirty(['src/services/voice.ts']).WORKTREE_RUNTIME_CLEAN).toBe(false)
  })

  it('SPECIFICITY: generated/doc churn does NOT dirty runtime or harness', () => {
    const c = classifyDirty(['docs/eval/RESULT.json', 'knowledge/family.yaml', 'memory/graph.yaml', 'e2e/shot.png'])
    expect(c.WORKTREE_RUNTIME_CLEAN).toBe(true)
    expect(c.WORKTREE_HARNESS_CLEAN).toBe(true)
  })

  it('a clean tree is clean on both axes', () => {
    const c = classifyDirty([])
    expect(c.WORKTREE_RUNTIME_CLEAN).toBe(true)
    expect(c.WORKTREE_HARNESS_CLEAN).toBe(true)
  })

  it('classification is precise: a .test.ts is harness, not runtime', () => {
    expect(isHarnessFile('src/x/y.test.ts')).toBe(true)
    expect(isRuntimeFile('src/x/y.test.ts')).toBe(false)
  })
})
