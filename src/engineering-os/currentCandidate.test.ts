/*
 * currentCandidate.test.ts — proof of canonical current-candidate discovery. (C7 / §49)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A clean-room operator must discover the candidate from repository truth, uniquely and fail-closed.
 * Hermetic: feeds fixture lock/capsule objects (no live files).
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling of the orchestrator; shared verbatim, no types.
import { deriveCurrentCandidate, CANDIDATE } from '../../scripts/current-candidate-lib.mjs'

const lock = () => ({
  candidateRC: 'https://abu-bank-353hxn1ha.vercel.app',
  buildVersion: '0.291.0-earonly',
  identity: { RUNTIME_SOURCE_SHA: '237bef9' },
})
const capsule = () => ({ capsuleId: 'abc123', identity: { DEPLOYED_BUILD_ID: '0.291.0-earonly' } })

describe('canonical current-candidate discovery (C7/§49)', () => {
  it('unique lock + consistent capsule → PROVEN with the URL + certify command', () => {
    const r = deriveCurrentCandidate(lock(), capsule())
    expect(r.status).toBe(CANDIDATE.PROVEN)
    expect(r.unique).toBe(true)
    expect(r.candidate.url).toMatch(/^https:\/\//)
    expect(r.candidate.certifyCommand).toContain('qa:monster rc')
  })

  it('missing lock → NOT_FOUND (fail-closed), never a guess', () => {
    const r = deriveCurrentCandidate(null, null)
    expect(r.status).toBe(CANDIDATE.NOT_FOUND)
    expect(r.candidate).toBeNull()
  })

  it('lock without candidateRC → NOT_FOUND', () => {
    const l = lock() as Record<string, unknown>
    delete l.candidateRC
    expect(deriveCurrentCandidate(l, null).status).toBe(CANDIDATE.NOT_FOUND)
  })

  it('capsule build disagrees with lock build → AMBIGUOUS (stale-candidate escape), never PROVEN', () => {
    const stale = { capsuleId: 'old', identity: { DEPLOYED_BUILD_ID: '0.290.0-earonly' } }
    const r = deriveCurrentCandidate(lock(), stale)
    expect(r.status).toBe(CANDIDATE.AMBIGUOUS)
    expect(r.candidate).toBeNull()
    expect(r.reasons.join(' ')).toMatch(/!= lock buildVersion/)
  })

  it('no capsule yet (lock only) still resolves PROVEN (capsule is an optional cross-check)', () => {
    const r = deriveCurrentCandidate(lock(), null)
    expect(r.status).toBe(CANDIDATE.PROVEN)
    expect(r.candidate.capsuleId).toBeNull()
  })
})
