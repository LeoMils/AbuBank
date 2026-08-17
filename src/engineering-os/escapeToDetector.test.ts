/*
 * escapeToDetector.test.ts — the canonical escape→detector workflow. (§21/B6)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { validateEscapeRecord, scaffold, REQUIRED_ESCAPE_FIELDS } from '../../scripts/escape-to-detector-lib.mjs'

const escapes = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/QA_CONTROL_ESCAPE_CORPUS.json'), 'utf8')).escapes

describe('escape → detector workflow (§21/B6)', () => {
  it('every committed QA-control escape record is valid (has detector + closure fields)', () => {
    for (const e of escapes()) expect(validateEscapeRecord(e).ok, `${e.id}: ${validateEscapeRecord(e).missing}`).toBe(true)
  })
  it('THE §21 rule: a record claiming CLOSED without a detector is invalid', () => {
    expect(validateEscapeRecord({ id: 'x', originalFailure: 'a', howFalseConfidence: 'b', closureState: 'CLOSED', affectedReleaseLayer: 'z' }).ok).toBe(false)
  })
  it('the scaffold names every required field for a fresh defect', () => {
    const s = scaffold('ce-new')
    for (const f of REQUIRED_ESCAPE_FIELDS) expect(s).toHaveProperty(f)
    expect(s.closureState).toBe('OPEN')
  })
})
