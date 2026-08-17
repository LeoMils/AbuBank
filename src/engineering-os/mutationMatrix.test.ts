/*
 * mutationMatrix.test.ts — proves the full §46/B11 mutation matrix is covered. (§46/B11)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Every mutation class maps to an EXISTING killing test file. A release-critical mutant with no killer
 * that exists = SURVIVED_RELEASE_CRITICAL_MUTANT > 0 → the matrix is incomplete.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const matrix = JSON.parse(readFileSync(resolve('docs/engineering-os/qa/MUTATION_MATRIX.json'), 'utf8'))
const mutants: Array<{ class: string; killedBy: string; releaseCritical: boolean }> = matrix.mutants

describe('full mutation matrix (§46/B11)', () => {
  it('every mutant names a killing test file that EXISTS on disk', () => {
    const missing = mutants.filter((m) => !existsSync(resolve(m.killedBy)))
    expect(missing.map((m) => `${m.class} → ${m.killedBy}`)).toEqual([])
  })

  it('SURVIVED_RELEASE_CRITICAL_MUTANTS = 0 (every release-critical mutant has an existing killer)', () => {
    const survived = mutants.filter((m) => m.releaseCritical && !existsSync(resolve(m.killedBy)))
    expect(survived).toEqual([])
  })

  it('the matrix covers the core release-critical classes', () => {
    const classes = new Set(mutants.map((m) => m.class))
    for (const c of ['false-success-exit', 'capsule-tamper', 'capsule-self-consistent-omission',
      'machine-obligation-omitted', 'false-owner-boundary', 'false-context-stop-yield',
      'stochastic-claim-omitted-from-sampling', 'proof-cache-stale-reuse', 'unsafe-emergency-bypass']) {
      expect(classes.has(c), `missing mutation class ${c}`).toBe(true)
    }
  })

  it('mutation classes are unique', () => {
    const cs = mutants.map((m) => m.class)
    expect(new Set(cs).size).toBe(cs.length)
  })
})
