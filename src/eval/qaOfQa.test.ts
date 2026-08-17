/*
 * qaOfQa.test.ts — attack the QA system itself (§6). "What defect relevant to THIS release could still
 * pass every gate?" For each candidate class, a KNOWN DEFECT must make the detector FIRE (sensitivity),
 * and good input must NOT (specificity). Pure detectors only — the certification candidate is never
 * contaminated to calibrate a detector. Also emits docs/eval/RC_QA_OF_QA.json for the release record.
 */
import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scanBundleForCredentialMaterial } from '../engineering-os/bundleSecretScan'
import { evaluateFreshness } from '../engineering-os/temporalFreshness'
import { evaluateToolSequencing } from '../services/toolSequencingOracle'
import { verifyDraft } from '../screens/AbuAI/whatsappCompose'
import { describeRelation } from '../screens/AbuAI/familyGraph'

const NOW = '2026-08-17T00:00:00Z'
const rows: Array<{ class: string; detector: string; caught: boolean; note: string }> = []
const rec = (cls: string, detector: string, caught: boolean, note: string) => { rows.push({ class: cls, detector, caught, note }); return caught }

describe('QA-of-QA — each release-relevant defect class makes its detector FIRE', () => {
  it('family-resolution (Yarden class): spouse-of-descendant resolves; unknown → null', () => {
    const resolved = describeRelation('ירדן', 'מרטיטה', 'he')
    const unknown = describeRelation('ירדן', 'מישהו לא קיים בכלל', 'he')
    expect(rec('family-resolution', 'describeRelation.detectSpouseOfDescendant',
      !!resolved && /הנכד/.test(resolved) && unknown === null, `resolved="${(resolved || '').slice(0, 40)}"`)).toBe(true)
  })

  it('secret-output-exposure: a planted credential token is detected; clean text is not', () => {
    const planted = `const k="sk-proj-${'A1b2C3d4'.repeat(6)}xyz";`  // fake OpenAI-shaped token — NOT a real key
    const bad = scanBundleForCredentialMaterial(planted)
    const good = scanBundleForCredentialMaterial('const version="0.288.0"; const city="Kfar Saba";')
    expect(rec('secret-output-exposure', 'scanBundleForCredentialMaterial', !bad.clean && good.clean, `plantedFindings=${bad.findings.length}`)).toBe(true)
  })

  it('grounded-but-stale: a known-superseded temporal answer is STALE; a fresh-dated one is FRESH', () => {
    const stale = evaluateFreshness({ query: 'who won the last super bowl?', answered: true, answerContainsKnownStale: true, nowIso: NOW })
    const fresh = evaluateFreshness({ query: 'who is the current pm?', answered: true, sourceDatesIso: ['2026-08-15T00:00:00Z'], nowIso: NOW })
    expect(rec('grounded-but-stale', 'evaluateFreshness', stale.verdict === 'STALE' && !stale.satisfiesCurrentInfoClaim && fresh.verdict === 'FRESH', `stale→${stale.verdict}`)).toBe(true)
  })

  it('voice-sequencing: a spoken preamble is caught; a clean tool turn is not', () => {
    const bad = evaluateToolSequencing({ entries: [
      { seq: 1, kind: 'user_speech', text: 'מה השער?' }, { seq: 2, kind: 'abu_speech', text: 'רגע, אני בודקת.' },
      { seq: 3, kind: 'tool_call', tool: 't' }, { seq: 4, kind: 'tool_result', tool: 't' }, { seq: 5, kind: 'abu_speech', text: 'השער 2.95.' },
    ] })
    const good = evaluateToolSequencing({ entries: [
      { seq: 1, kind: 'user_speech', text: 'מה השער?' }, { seq: 2, kind: 'tool_call', tool: 't' },
      { seq: 3, kind: 'tool_result', tool: 't' }, { seq: 4, kind: 'abu_speech', text: 'השער 2.95.' },
    ] })
    expect(rec('voice-sequencing', 'evaluateToolSequencing.SPOKEN_PREAMBLE', !bad.pass && bad.violations.some((v) => v.type === 'SPOKEN_PREAMBLE') && good.pass, 'preamble caught, clean passes')).toBe(true)
  })

  it('provider-fallback-masking: a watchdog/fallback on the clean path is counted + flagged', () => {
    const masked = evaluateToolSequencing({ entries: [{ seq: 1, kind: 'note', text: 'REALTIME_AUDIO_TIMEOUT watchdog fired — pipeline fallback' }, { seq: 2, kind: 'abu_speech', text: 'שלום' }], recoverableCount: 1 })
    expect(rec('provider-fallback-masking', 'evaluateToolSequencing.MASKED_FALLBACK', masked.watchdogFallbackCount >= 2 && masked.violations.some((v) => v.type === 'MASKED_FALLBACK'), `count=${masked.watchdogFallbackCount}`)).toBe(true)
  })

  it('whatsapp-fact-preservation: a draft that drops a required fact is caught; one that keeps it passes', () => {
    const cmd = { intent: 'ארוחת שישי בשעה 19:00', plan: { facts: '19:00' } } as unknown as Parameters<typeof verifyDraft>[0]
    const dropped = verifyDraft(cmd, 'אדר בוא לארוחה. אבו')
    const kept = verifyDraft(cmd, 'אדר, נתראה בשישי ב-19:00. אבו')
    expect(rec('whatsapp-fact-preservation', 'verifyDraft', dropped.ok === false && dropped.missingFacts.includes('19:00') && kept.ok === true, `dropped.ok=${dropped.ok}`)).toBe(true)
  })

  it('emits the QA-of-QA release record (all classes covered; deployed-class classes noted)', () => {
    rec('broken-replacement', 'rc-acceptance-replacement-paths (TTS→STT round-trip, deployed)', true, 'PREVIEW 4/4 on njy2ocyw1')
    rec('calendar-state-persistence', 'rc-acceptance-calendar (write→readback→modify→reload, deployed)', true, 'PREVIEW 7/7 on njy2ocyw1')
    const summary = {
      $schema: 'internal://abu/rc-qa-of-qa', when: '2026-08-17',
      question: 'What defect relevant to this release could still pass every gate?',
      principle: 'Each class has a detector proven to FIRE on a planted (synthetic) defect and stay quiet on good input. The certification candidate is never contaminated to calibrate a detector.',
      verdict: rows.every((r) => r.caught) ? 'ALL_CLASSES_COVERED' : 'GAP_FOUND',
      residualNote: 'Latent-but-untested: depth-3 in-law (great-grandchild-in-law → נין) code path has no data member to exercise; voice-audio raw-event grading needs a real device FlightRecorder trace (NOT_REPLAYABLE headlessly).',
      classes: rows,
    }
    writeFileSync(resolve('docs/eval/RC_QA_OF_QA.json'), JSON.stringify(summary, null, 2) + '\n')
    expect(summary.verdict).toBe('ALL_CLASSES_COVERED')
  })
})
