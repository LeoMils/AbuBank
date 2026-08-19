/**
 * BENCHMARK_CONVERSATIONS runner — the NORTH_STAR metric.
 * Prints the score + per-category + failures, and guards a regression floor so a
 * change can never silently lower the user-facing score.
 *   npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { runBenchmarks } from './benchmarkConversations'

const FIXED = new Date('2026-06-24T20:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => {
  const s: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} })
  vi.stubGlobal('navigator', { onLine: true })
})

// The current floor. Raise it whenever the score improves so it can never regress.
const FLOOR = 100

describe('BENCHMARK_CONVERSATIONS', () => {
  it('prints the IMPACT scoreboard line + per-category', () => {
    const r = runBenchmarks()
    const cats = Object.entries(r.categories).map(([k, v]) => `${k} ${v.passed}/${v.total}`).join(' · ')
    // eslint-disable-next-line no-console
    console.log(`\n[BENCHMARK_SCORE] ${r.score}%  (${r.passed}/${r.total})\n[BY_CATEGORY] ${cats}\n[FAILURES] ${r.failures.length ? r.failures.join(', ') : 'none'}\n`)
    expect(r.total).toBeGreaterThanOrEqual(35)
  })

  it(`score is at or above the floor (${FLOOR}%) — no regression`, () => {
    const r = runBenchmarks()
    if (r.score < FLOOR) throw new Error(`BENCHMARK regressed to ${r.score}% (floor ${FLOOR}%). Failing moments: ${r.failures.join(', ')}`)
    expect(r.score).toBeGreaterThanOrEqual(FLOOR)
  })
})
