/*
 * PRIVACY-CONTROL adversarial suite (Stage 3C §10). PC1–PC5.
 * The key distinction: a control that EXECUTED and found a leak is IMPLEMENTED (control complete)
 * with a RELEASE blocker — NOT an absent control. A control that did not execute is incomplete.
 */
import { describe, it, expect } from 'vitest'
import { evaluatePrivacyControl, type PrivacyCheckResult } from './privacyControl'

const ok = (id: PrivacyCheckResult['id']): PrivacyCheckResult => ({ id, executed: true, passed: true, detail: 'clean' })

describe('privacy control — completeness vs cleanliness', () => {
  it('PC1 · all checks executed + passed → control complete AND clean, zero blockers', () => {
    const r = evaluatePrivacyControl(['SHIPPED_ARTIFACT_SECRET_SCAN', 'SERVER_CREDENTIAL_CONTRACT', 'CLIENT_PII_BOUNDARY'].map((id) => ok(id as PrivacyCheckResult['id'])))
    expect(r.controlExecuted).toBe(true)
    expect(r.clean).toBe(true)
    expect(r.releaseBlockers).toEqual([])
    expect(r.controlBlockers).toEqual([])
  })

  it('PC2 · the REAL 0.286 state: secret scan EXECUTED but FAILED → control complete, release blocked', () => {
    const checks: PrivacyCheckResult[] = [
      { id: 'SHIPPED_ARTIFACT_SECRET_SCAN', executed: true, passed: false, detail: '3 credentials exposed in shipped bundle (redacted fingerprints)' },
      ok('SERVER_CREDENTIAL_CONTRACT'), ok('CLIENT_PII_BOUNDARY'),
    ]
    const r = evaluatePrivacyControl(checks)
    expect(r.controlExecuted).toBe(true)          // the control IS implemented (o-privacy done)
    expect(r.clean).toBe(false)                   // but the release is not clean
    expect(r.releaseBlockers.some((b) => b.code === 'PRIVACY_VIOLATION')).toBe(true)
    expect(r.controlBlockers).toEqual([])
  })

  it('PC3 · a required check that did NOT execute → control INCOMPLETE (not merely "clean")', () => {
    const r = evaluatePrivacyControl([ok('SHIPPED_ARTIFACT_SECRET_SCAN'), ok('SERVER_CREDENTIAL_CONTRACT')]) // PII check missing
    expect(r.controlExecuted).toBe(false)
    expect(r.controlBlockers.some((b) => b.code === 'PRIVACY_CHECK_NOT_EXECUTED')).toBe(true)
  })

  it('PC4 · a check present but executed:false does NOT count as run (no assumed pass)', () => {
    const checks: PrivacyCheckResult[] = [
      { id: 'SHIPPED_ARTIFACT_SECRET_SCAN', executed: false, passed: true, detail: 'not run' },
      ok('SERVER_CREDENTIAL_CONTRACT'), ok('CLIENT_PII_BOUNDARY'),
    ]
    expect(evaluatePrivacyControl(checks).controlExecuted).toBe(false)
  })

  it('PC5 · specificity — a failing check is a RELEASE blocker, an absent check is a CONTROL blocker (distinct)', () => {
    const failing = evaluatePrivacyControl([{ id: 'SHIPPED_ARTIFACT_SECRET_SCAN', executed: true, passed: false, detail: 'leak' }, ok('SERVER_CREDENTIAL_CONTRACT'), ok('CLIENT_PII_BOUNDARY')])
    const absent = evaluatePrivacyControl([ok('SERVER_CREDENTIAL_CONTRACT'), ok('CLIENT_PII_BOUNDARY')])
    expect(failing.releaseBlockers.length).toBe(1)
    expect(failing.controlBlockers.length).toBe(0)
    expect(absent.controlBlockers.length).toBe(1)
    expect(absent.releaseBlockers.length).toBe(0)
  })
})
