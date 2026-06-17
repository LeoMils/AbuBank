import { describe, it, expect } from 'vitest'
import { compareQaRunToExpectation, classifyFailureLayer } from './qaExpectationMatcher'
import type { QaRun, QaExpectation } from './qaRunTypes'
import { RELEASE_CANDIDATE_EXPECTATIONS } from './releaseCandidateExpectations'

function makeRun(overrides: Partial<QaRun> = {}): QaRun {
  return {
    id: 'test-1', timestamp: '2026-06-01T10:00:00Z', appVersion: '0.1.0',
    rawTranscript: 'מחר בחצות פגישה עם אופיר',
    normalizedTranscript: 'מחר בחצות פגישה עם אופיר',
    semanticRoute: 'appointment_create', intent: 'appointment',
    date: '2026-06-02', time: '00:00',
    relationPhrase: null, resolvedPersonName: null, resolvedPersonStatus: null,
    finalTitle: 'פגישה עם אופיר', confirmationText: null,
    saveAllowed: true, saveBlockReason: null,
    cardState: null, cardTitle: null, cardMainText: null, cardSecondaryText: null, cardActions: null,
    audioDurationMs: 3000, blobSize: 45000, chunksCount: 12, mimeType: 'audio/webm',
    stopReason: 'manual', sttStatus: 'ok', transcriptLength: 28, normalizedLength: 28,
    noSpeechProb: 0.01, avgLogprob: -0.3, compressionRatio: 1.2, errorStep: null,
    ...overrides,
  }
}

describe('compareQaRunToExpectation', () => {
  const exp = RELEASE_CANDIDATE_EXPECTATIONS[0]! // rc-01: midnight basic

  it('returns pass when all fields match', () => {
    const run = makeRun()
    const result = compareQaRunToExpectation(run, exp)
    expect(result.pass).toBe(true)
    expect(result.failedFields).toEqual([])
  })

  it('fails on wrong route', () => {
    const run = makeRun({ semanticRoute: 'reminder_create', intent: 'reminder' })
    const result = compareQaRunToExpectation(run, exp)
    expect(result.pass).toBe(false)
    expect(result.failedFields).toContain('route')
    expect(result.suspectedLayer).toBe('ROUTING')
  })

  it('fails on wrong time', () => {
    const run = makeRun({ time: '12:00' })
    const result = compareQaRunToExpectation(run, exp)
    expect(result.pass).toBe(false)
    expect(result.failedFields).toContain('time')
    expect(result.suspectedLayer).toBe('TIME_PARSE')
  })

  it('fails on wrong saveAllowed', () => {
    const run = makeRun({ saveAllowed: false })
    const result = compareQaRunToExpectation(run, exp)
    expect(result.pass).toBe(false)
    expect(result.failedFields).toContain('saveAllowed')
  })

  it('fails on empty rawTranscript → MIC_CAPTURE or STT', () => {
    const run = makeRun({ rawTranscript: '', blobSize: 500 })
    const result = compareQaRunToExpectation(run, exp)
    expect(result.pass).toBe(false)
    expect(result.suspectedLayer).toBe('MIC_CAPTURE')
  })

  it('empty rawTranscript with large blob → STT', () => {
    const run = makeRun({ rawTranscript: '', blobSize: 50000 })
    const result = compareQaRunToExpectation(run, exp)
    expect(result.pass).toBe(false)
    expect(result.suspectedLayer).toBe('STT')
  })

  it('checks resolved person name for resolved: policy', () => {
    const exp5 = RELEASE_CANDIDATE_EXPECTATIONS[4]! // rc-05: הבעל של אופיר → גלעד
    const run = makeRun({
      semanticRoute: 'appointment_create', time: '21:00',
      relationPhrase: 'הבעל של אופיר', resolvedPersonName: 'גלעד',
    })
    const result = compareQaRunToExpectation(run, exp5)
    expect(result.pass).toBe(true)
  })

  it('fails when resolved name is wrong', () => {
    const exp5 = RELEASE_CANDIDATE_EXPECTATIONS[4]!
    const run = makeRun({
      semanticRoute: 'appointment_create', time: '21:00',
      relationPhrase: 'הבעל של אופיר', resolvedPersonName: 'לאו',
    })
    const result = compareQaRunToExpectation(run, exp5)
    expect(result.pass).toBe(false)
    expect(result.failedFields).toContain('resolvedPersonName')
    expect(result.suspectedLayer).toBe('FAMILY_RESOLVE')
  })

  it('checks ambiguous status', () => {
    const exp8 = RELEASE_CANDIDATE_EXPECTATIONS[7]! // rc-08: אבא של אנאבל → ambiguous
    const run = makeRun({
      semanticRoute: 'appointment_create', time: '08:00',
      relationPhrase: 'אבא של אנאבל', resolvedPersonStatus: 'ambiguous',
      saveAllowed: false,
    })
    const result = compareQaRunToExpectation(run, exp8)
    expect(result.pass).toBe(true)
  })

  it('skips saveAllowed check when expectedSaveAllowed is null', () => {
    const expNull = RELEASE_CANDIDATE_EXPECTATIONS[5]! // rc-06: save null
    const run = makeRun({
      semanticRoute: 'appointment_create', time: '21:30',
      relationPhrase: 'אחות של ארי', resolvedPersonStatus: 'missing',
      saveAllowed: false,
    })
    const result = compareQaRunToExpectation(run, expNull)
    // Should not fail on saveAllowed
    expect(result.failedFields).not.toContain('saveAllowed')
  })

  it('query expectations pass with no save', () => {
    const exp22 = RELEASE_CANDIDATE_EXPECTATIONS[21]! // rc-22: schedule_query
    const run = makeRun({
      semanticRoute: 'calendar_query', intent: 'schedule_query',
      rawTranscript: 'מה התוכניות שלי השבוע',
      normalizedTranscript: 'מה התוכניות שלי השבוע',
      date: null, time: null, saveAllowed: false,
    })
    const result = compareQaRunToExpectation(run, exp22)
    expect(result.pass).toBe(true)
  })
})

describe('classifyFailureLayer', () => {
  it('empty transcript + small blob → MIC_CAPTURE', () => {
    const run = makeRun({ rawTranscript: '', blobSize: 500 })
    expect(classifyFailureLayer(run)).toBe('MIC_CAPTURE')
  })

  it('empty transcript + large blob → STT', () => {
    const run = makeRun({ rawTranscript: '', blobSize: 50000 })
    expect(classifyFailureLayer(run)).toBe('STT')
  })

  it('normalized much shorter than raw → NORMALIZATION', () => {
    const run = makeRun({ rawTranscript: 'מחר בחצות פגישה עם אופיר', normalizedTranscript: 'מחר' })
    expect(classifyFailureLayer(run)).toBe('NORMALIZATION')
  })

  it('unknown route → ROUTING', () => {
    const run = makeRun({ semanticRoute: 'unknown' })
    expect(classifyFailureLayer(run)).toBe('ROUTING')
  })

  it('appointment with no time/date → TIME_PARSE', () => {
    const run = makeRun({ semanticRoute: 'appointment_create', time: null, date: null })
    expect(classifyFailureLayer(run)).toBe('TIME_PARSE')
  })

  it('missing relation → FAMILY_RESOLVE', () => {
    const run = makeRun({
      semanticRoute: 'appointment_create',
      resolvedPersonStatus: 'missing', relationPhrase: 'הבעל של אופיר',
    })
    expect(classifyFailureLayer(run)).toBe('FAMILY_RESOLVE')
  })
})

describe('RELEASE_CANDIDATE_EXPECTATIONS integrity', () => {
  it('has exactly 30 expectations', () => {
    expect(RELEASE_CANDIDATE_EXPECTATIONS.length).toBe(30)
  })

  it('all have unique ids', () => {
    const ids = RELEASE_CANDIDATE_EXPECTATIONS.map(e => e.id)
    expect(new Set(ids).size).toBe(30)
  })

  it('all have non-empty utterances', () => {
    for (const e of RELEASE_CANDIDATE_EXPECTATIONS) {
      expect(e.utterance.length).toBeGreaterThan(0)
    }
  })

  it('all P0 expectations have expectedSaveAllowed set (not null)', () => {
    for (const e of RELEASE_CANDIDATE_EXPECTATIONS) {
      if (e.criticality === 'P0') {
        expect(e.expectedSaveAllowed, `${e.id} P0 must have explicit save`).not.toBeNull()
      }
    }
  })
})
