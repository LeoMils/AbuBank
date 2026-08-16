/*
 * TEMPORAL FRESHNESS oracle suite (§16, owner correction #2: GROUNDED ≠ CURRENT).
 * Re-evaluates the "last super bowl" result as a current-info FAIL, and proves the freshness gate.
 */
import { describe, it, expect } from 'vitest'
import { isTemporalQuery, evaluateFreshness } from './temporalFreshness'

const NOW = '2026-08-17T00:00:00Z'

describe('temporal-intent detection', () => {
  it('detects temporal markers (EN/HE/ES)', () => {
    for (const q of ['who is the current president', 'latest news', 'who won the last super bowl', 'weather today', 'מי ראש הממשלה עכשיו', 'מזג האוויר היום', 'precio actual del dólar']) {
      expect(isTemporalQuery(q), q).toBe(true)
    }
  })
  it('does NOT flag a static/atemporal fact', () => {
    for (const q of ['how tall is mount everest', 'who was the first prime minister of israel', 'capital of france']) {
      expect(isTemporalQuery(q), q).toBe(false)
    }
  })
})

describe('freshness — GROUNDED ≠ CURRENT', () => {
  it('RE-EVALUATION · "last super bowl" grounded but known-stale → STALE (current-info FAIL)', () => {
    const r = evaluateFreshness({ query: 'who won the last super bowl?', answered: true, answerContainsKnownStale: true, nowIso: NOW })
    expect(r.verdict).toBe('STALE')
    expect(r.satisfiesCurrentInfoClaim).toBe(false)
  })
  it('temporal + answered + FRESH source → FRESH (satisfies current-info)', () => {
    const r = evaluateFreshness({ query: 'who is the current president?', answered: true, sourceDatesIso: ['2026-08-10T00:00:00Z'], nowIso: NOW })
    expect(r.verdict).toBe('FRESH')
    expect(r.satisfiesCurrentInfoClaim).toBe(true)
  })
  it('temporal + answered + STALE source (older than maxAge) → STALE', () => {
    const r = evaluateFreshness({ query: 'latest exchange rate', answered: true, sourceDatesIso: ['2024-01-01T00:00:00Z'], nowIso: NOW })
    expect(r.verdict).toBe('STALE')
    expect(r.satisfiesCurrentInfoClaim).toBe(false)
  })
  it('temporal + answered but freshness UNVERIFIED (no source dates) → not certifiable (fail closed)', () => {
    const r = evaluateFreshness({ query: 'who won the last super bowl?', answered: true, nowIso: NOW })
    expect(r.satisfiesCurrentInfoClaim).toBe(false)
  })
  it('temporal + NOT answered → UNGROUNDED (honest decline is a SEPARATE pass, not current-info)', () => {
    const r = evaluateFreshness({ query: 'weather today', answered: false, nowIso: NOW })
    expect(r.verdict).toBe('UNGROUNDED')
    expect(r.satisfiesCurrentInfoClaim).toBe(false)
  })
  it('NON-temporal query → grounding alone satisfies (freshness not required)', () => {
    const r = evaluateFreshness({ query: 'how tall is mount everest', answered: true, nowIso: NOW })
    expect(r.verdict).toBe('NOT_TEMPORAL')
    expect(r.satisfiesCurrentInfoClaim).toBe(true)
  })
})
