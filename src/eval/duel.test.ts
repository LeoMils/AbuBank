/*
 * CHAMPION vs CHALLENGER — promotion-duel proofs (Constitution §6, proof d).
 * Proves: the real corpus scores across every dimension; a build equal-or-better is
 * promotable; a DELIBERATELY REGRESSED challenger is BLOCKED (and named); losing a whole
 * dimension (coverage) is also blocked; the weekly plain-Hebrew line is emitted.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { corpusScore, duel, runWeeklyDuel, type Scorecard } from './duel'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
})

const clone = (s: Scorecard): Scorecard => ({ dimensions: s.dimensions.map((d) => ({ ...d })) })

describe('DUEL — the real corpus scores across every dimension', () => {
  it('corpusScore covers parity(6) + marathonSmoke + flightRecorder + mirrors, all green, mirrors ≥ 1000', async () => {
    const s = await corpusScore('2026-06-24')
    const names = s.dimensions.map((d) => d.name)
    expect(names).toContain('parity:correctness')
    expect(names).toContain('marathonSmoke')
    expect(names).toContain('flightRecorder')
    expect(names).toContain('mirrors')
    const mirrors = s.dimensions.find((d) => d.name === 'mirrors')!
    expect(mirrors.total).toBeGreaterThanOrEqual(1000)
    for (const d of s.dimensions) expect(d.pass, `${d.name} not green`).toBe(d.total) // champion is all-green
  })
})

describe('DUEL — promotion gate', () => {
  it('an identical build is promotable (no regression)', async () => {
    const champ = await corpusScore('2026-06-24')
    const r = duel(champ, clone(champ))
    expect(r.promotable).toBe(true)
    expect(r.returned).toBe(0)
    expect(r.summaryHe).toContain('עבר')
  })

  it('a DELIBERATELY REGRESSED challenger is BLOCKED and the regressed dimension is named (proof d)', async () => {
    const champ = await corpusScore('2026-06-24')
    const bad = clone(champ)
    const mirrors = bad.dimensions.find((d) => d.name === 'mirrors')!
    mirrors.pass = mirrors.total - 25 // regress: 25 mirror breaks introduced
    const r = duel(champ, bad)
    expect(r.promotable).toBe(false)
    expect(r.returned).toBeGreaterThanOrEqual(1)
    expect(r.regressions.map((x) => x.name)).toContain('mirrors')
    expect(r.summaryHe).toContain('נחסם')
    expect(r.summaryHe).toContain('חזרו')
  })

  it('losing a whole dimension (coverage) is treated as a regression and BLOCKS promotion', async () => {
    const champ = await corpusScore('2026-06-24')
    const missing: Scorecard = { dimensions: champ.dimensions.filter((d) => d.name !== 'flightRecorder') }
    const r = duel(champ, missing)
    expect(r.promotable).toBe(false)
    expect(r.regressions.map((x) => x.name)).toContain('flightRecorder')
  })

  it('a genuine improvement is promotable and counted as fixed', () => {
    const champ: Scorecard = { dimensions: [{ name: 'parity:correctness', pass: 8, total: 10 }, { name: 'mirrors', pass: 1380, total: 1380 }] }
    const better: Scorecard = { dimensions: [{ name: 'parity:correctness', pass: 10, total: 10 }, { name: 'mirrors', pass: 1380, total: 1380 }] }
    const r = duel(champ, better)
    expect(r.promotable).toBe(true)
    expect(r.fixed).toBe(1)
    expect(r.improvements[0]!.name).toBe('parity:correctness')
  })
})

describe('DUEL — weekly guard emits Leo one plain-Hebrew line', () => {
  it('self-baseline run passes and produces the Hebrew summary', async () => {
    const w = await runWeeklyDuel('2026-06-24') // no write, no injected baseline → self-duel
    expect(w.result.promotable).toBe(true)
    expect(w.result.summaryHe).toMatch(/^השבוע: \d+ נתפסו, \d+ תוקנו, \d+ חזרו/)
    expect(w.result.summaryHe).toContain('עבר')
  })

  it('duels the CURRENT build against an injected champion with EXTRA coverage → BLOCKED (lost dimension)', async () => {
    const cur = await corpusScore('2026-06-24')
    // A champion that covered a dimension the current build no longer covers = a regression.
    const strongerChampion: Scorecard = { dimensions: [...cur.dimensions, { name: 'securityGuard', pass: 10, total: 10 }] }
    const w = await runWeeklyDuel('2026-06-24', { champion: strongerChampion })
    expect(w.hadBaseline).toBe(true)
    expect(w.result.promotable).toBe(false)
    expect(w.result.regressions.map((r) => r.name)).toContain('securityGuard')
    expect(w.result.summaryHe).toContain('נחסם')
  })
})
