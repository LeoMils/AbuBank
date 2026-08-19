/*
 * finalGates.test.ts — locks the promotion-rehearsal + clean-room results. (§51/§50)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const rd = (p: string) => JSON.parse(readFileSync(resolve(p), 'utf8'))

describe('promotion rehearsal (§51)', () => {
  it('PROMOTION_REHEARSAL = PASS with every check green', () => {
    const r = rd('docs/engineering-os/qa/PROMOTION_REHEARSAL.json')
    expect(r.PROMOTION_REHEARSAL).toBe('PASS')
    expect(r.checks.every((c: { pass: boolean }) => c.pass)).toBe(true)
    expect(r.EXACT_LOCKED_CANDIDATE).toMatch(/^https:\/\//)
  })
  it('rehearsal does NOT claim production is authorized (still pending owner)', () => {
    const r = rd('docs/engineering-os/qa/PROMOTION_REHEARSAL.json')
    expect(r.PRODUCTION_PROMOTION_ELIGIBLE).toMatch(/PENDING_OWNER/)
  })
})

describe('clean-room repository-only operability (§50/I7)', () => {
  it('every documented entry command works from repo state; no hidden dependency', () => {
    const r = rd('docs/engineering-os/qa/CLEAN_ROOM_RESULT.json')
    expect(r.CLEAN_ROOM_FIRST_HIDDEN_DEPENDENCY).toBeNull()
    expect(r.steps.every((s: { ok: boolean }) => s.ok)).toBe(true)
  })
  it('does not overclaim: only the deterministic portion is proven', () => {
    const r = rd('docs/engineering-os/qa/CLEAN_ROOM_RESULT.json')
    expect(r.FRESH_SESSION_REPOSITORY_ONLY).toBe('DETERMINISTIC_PORTION_PROVEN')
    expect(r.exactRemainingLimitation).toBeTruthy()
  })
  it('the operator guide (the entry point) exists', () => {
    expect(existsSync(resolve('docs/engineering-os/qa/QA_MONSTER_OPERATOR.md'))).toBe(true)
  })
})
