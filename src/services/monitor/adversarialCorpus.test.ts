/*
 * adversarialCorpus.test.ts — proves each M2 detector FIRES on engineered violations
 * and stays quiet on engineered-clean/borderline output, over a large generated corpus.
 * This is the answer to "0/5 real turns proves nothing": interception is measured against
 * cases built to trigger each detector, not against 5 turns that happened to be clean.
 * Known GAPS (regex-uncatchable defects) are asserted as documented, not silently passing.
 */
import { describe, it, expect } from 'vitest'
import { buildAdversarialCorpus, measure } from './adversarialCorpus'

const reports = measure(buildAdversarialCorpus())
const by = (d: string) => reports.find((r) => r.detector === d)!

describe('adversarial corpus is substantial (small samples prove nothing)', () => {
  it('generates hundreds of cases across all five detectors', () => {
    const total = reports.reduce((n, r) => n + r.firePositives + r.cleanNegatives, 0)
    expect(total).toBeGreaterThan(300)
    for (const r of reports) {
      expect(r.firePositives).toBeGreaterThanOrEqual(8)   // each detector has a real fire set
      expect(r.cleanNegatives).toBeGreaterThanOrEqual(6)  // …and a real clean set
    }
  })
})

describe('every detector intercepts 100% of its engineered violations', () => {
  for (const d of ['LANGUAGE_IMPURE', 'SOURCE_NAMED', 'TOO_LONG', 'READ_BACK', 'LITERAL_COUNT']) {
    it(`${d}: interception rate === 1.0 (no misses ${JSON.stringify(by(d).missed)})`, () => {
      expect(by(d).missed).toEqual([])
      expect(by(d).interceptionRate).toBe(1)
    })
  }
})

describe('no detector fires on engineered-clean output (a blocked good answer is worse than the defect)', () => {
  for (const d of ['LANGUAGE_IMPURE', 'SOURCE_NAMED', 'TOO_LONG', 'READ_BACK', 'LITERAL_COUNT']) {
    it(`${d}: false-positive rate === 0 (no FPs ${JSON.stringify(by(d).falsePositives)})`, () => {
      expect(by(d).falsePositives).toEqual([])
      expect(by(d).falsePositiveRate).toBe(0)
    })
  }
})

describe('known GAPS are documented, not hidden', () => {
  it('SOURCE_NAMED cannot catch a dot-less spoken domain or a Hebrew-transliterated source (reported)', () => {
    // These are REAL defects the deterministic regex structurally cannot catch. They are
    // emitted as gap cases so the report states honestly where Layer-1 ends — they are NOT
    // counted against interception. If a future change DOES catch them, this test flags it
    // (the gap closed) rather than letting the limit rot silently.
    expect(by('SOURCE_NAMED').gaps.length).toBeGreaterThanOrEqual(3)
  })
})
