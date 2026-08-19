/*
 * reportSchema.test.ts — proof the canonical QA report carries the required machine-state fields. (§10/B13)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { validateReport, REQUIRED_REPORT_PATHS } from '../../scripts/report-schema-lib.mjs'

describe('Canonical report schema (§10/B13)', () => {
  it('the committed QA_MONSTER_REPORT.json satisfies the required schema', () => {
    const report = JSON.parse(readFileSync(resolve('docs/eval/QA_MONSTER_REPORT.json'), 'utf8'))
    const r = validateReport(report)
    expect(r.missing).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('a report missing a required verdict field fails validation (narrative cannot outrun schema)', () => {
    const report = JSON.parse(readFileSync(resolve('docs/eval/QA_MONSTER_REPORT.json'), 'utf8'))
    delete report.verdicts.QA_SYSTEM_VERDICT
    expect(validateReport(report).ok).toBe(false)
  })

  it('the schema requires split identities + all three verdicts + exit state', () => {
    expect(REQUIRED_REPORT_PATHS).toContain('identity.RUNTIME_SOURCE_SHA')
    expect(REQUIRED_REPORT_PATHS).toContain('verdicts.QA_SYSTEM_VERDICT')
    expect(REQUIRED_REPORT_PATHS).toContain('exit.state')
  })
})
