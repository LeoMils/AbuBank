/*
 * releaseEligibility.test.ts — the derived release state machine. (§2 reconciliation)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * PRODUCTION_PROMOTION_ELIGIBLE must be NO while any blocking owner action OR required human residual
 * remains open, even when machine work is complete. Uses the REAL registers.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { deriveReleaseEligibility } from '../../scripts/release-eligibility-lib.mjs'

const auth = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/OWNER_HUMAN_AUTHORITY.json'), 'utf8'))

describe('release eligibility state machine (§2)', () => {
  it('CURRENT state: machine READY but blocking owner + human gates open → ELIGIBLE_PENDING_OWNER, PRODUCTION=NO', () => {
    const a = auth()
    const r = deriveReleaseEligibility({ machineReady: true, ownerActions: a.ownerActions, humanResiduals: a.humanResiduals })
    expect(r.MACHINE_RELEASE_READINESS).toBe('READY')
    expect(r.BLOCKING_OWNER_ACTIONS_REMAINING).toBeGreaterThan(0)
    expect(r.BLOCKING_HUMAN_RESIDUALS_REMAINING).toBeGreaterThan(0)
    expect(r.PRODUCTION_PROMOTION_ELIGIBLE).toBe('NO')
    expect(r.RELEASE_PROMOTION_VERDICT).toBe('ELIGIBLE_PENDING_OWNER')
  })

  it('MUTATION: machine READY + one blocking HUMAN residual open → PRODUCTION_PROMOTION_ELIGIBLE = NO', () => {
    const r = deriveReleaseEligibility({ machineReady: true, ownerActions: [], humanResiduals: [{ id: 'voice', releaseBlocking: true }] })
    expect(r.PRODUCTION_PROMOTION_ELIGIBLE).toBe('NO')
  })

  it('MUTATION: machine READY + one blocking OWNER action open → PRODUCTION_PROMOTION_ELIGIBLE = NO', () => {
    const r = deriveReleaseEligibility({ machineReady: true, ownerActions: [{ id: 'revoke', releaseBlocking: 'production' }], humanResiduals: [] })
    expect(r.PRODUCTION_PROMOTION_ELIGIBLE).toBe('NO')
  })

  it('ONLY all blocking gates closed → PRODUCTION_PROMOTION_ELIGIBLE = YES (RELEASE=ELIGIBLE)', () => {
    const r = deriveReleaseEligibility({ machineReady: true, ownerActions: [{ id: 'kv', releaseBlocking: 'none' }], humanResiduals: [] })
    expect(r.PRODUCTION_PROMOTION_ELIGIBLE).toBe('YES')
    expect(r.RELEASE_PROMOTION_VERDICT).toBe('ELIGIBLE')
  })

  it('machine NOT ready → NOT_YET regardless of gates', () => {
    expect(deriveReleaseEligibility({ machineReady: false }).RELEASE_PROMOTION_VERDICT).toBe('NOT_YET')
  })

  it('a non-blocking owner action (releaseBlocking:none) does not block eligibility', () => {
    const r = deriveReleaseEligibility({ machineReady: true, ownerActions: [{ id: 'kv', releaseBlocking: 'none' }], humanResiduals: [] })
    expect(r.BLOCKING_OWNER_ACTIONS_REMAINING).toBe(0)
  })
})
