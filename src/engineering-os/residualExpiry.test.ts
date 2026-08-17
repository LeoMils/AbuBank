/*
 * residualExpiry.test.ts — human/device residuals are never permanent. (§24/B7)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Every residual must carry a review/expiry trigger (re-derived each release) + attempted machine
 * routes + a named remainder. Reuses the negative-proof rule so the check is one code path.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { negativeProofComplete } from '../../scripts/oracle-discipline-lib.mjs'

const residuals = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/OWNER_HUMAN_AUTHORITY.json'), 'utf8')).humanResiduals

describe('human/device residual expiry (§24/B7)', () => {
  it('every real residual has a review/expiry trigger — none is permanent', () => {
    for (const r of residuals()) expect(r.reviewTrigger, r.id).toBeTruthy()
  })
  it('every real residual passes the negative-proof protocol (attempted routes + remainder + review)', () => {
    for (const r of residuals()) {
      const n = negativeProofComplete(r)
      expect(n.valid, `${r.id}: ${n.reasons.join(',')}`).toBe(true)
    }
  })
  it('a residual without a review trigger would fail (permanence is a defect)', () => {
    expect(negativeProofComplete({ machineApproachesAttempted: ['x'], exactIrreducibleRemainder: 'y' }).valid).toBe(false)
  })
})
