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

describe('TRACK D · gaps closed, and the one that remains is documented', () => {
  it('SOURCE_NAMED gaps are now CLOSED (dot-less domain, transliterated source, "אתר של")', () => {
    // v0.259 added dot-less-domain + named-source + broadened-provenance patterns; these three
    // former gaps are now fire cases at 100% interception with 0 FP (asserted above).
    expect(by('SOURCE_NAMED').gaps.length).toBe(0)
  })
  it('READ_BACK still cannot catch an INSERTED-word break (contiguous-run limit) — reported honestly', () => {
    // Punctuation-only breaks are now caught; an inserted word is not, and closing it needs fuzzy
    // matching with real FP risk. Kept as an explicit gap so the limit cannot rot silently.
    expect(by('READ_BACK').gaps.length).toBeGreaterThanOrEqual(1)
  })
})
