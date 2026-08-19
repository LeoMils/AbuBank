/*
 * Golden Acceptance Corpus test — every real iPhone failure must stay impossible.
 * Per-category thresholds (mission Phase 9). 0 failures allowed.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runGoldenCorpus, scoreByCategory, type Cat } from './goldenAcceptanceCorpus'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

// Mission thresholds; any category not listed must be ≥95%.
const THRESH: Partial<Record<Cat, number>> = {
  CalendarCreate: 98, CalendarRead: 98, CalendarSearch: 98, CalendarUI: 98,
  Family: 98, Online: 95, Dialogue: 97, GoalContinuity: 97,
}

describe('Golden Acceptance Corpus (real iPhone failures — permanent)', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('every real failure stays impossible; every category meets threshold', async () => {
    const rows = await runGoldenCorpus()
    const sc = scoreByCategory(rows)
    // eslint-disable-next-line no-console
    console.log('[GOLDEN] ' + sc.map(c => `${c.cat}:${c.passed}/${c.total}`).join(' '))
    const failures = rows.filter(r => !r.pass)
    if (failures.length) {
      // eslint-disable-next-line no-console
      console.error('[GOLDEN] failures:\n' + failures.map(f => `  ${f.id} [${f.cat}] ${f.detail}`).join('\n'))
    }
    // 0 real failures reproducible.
    expect(failures.map(f => f.id)).toEqual([])
    // Every category meets its threshold (default 95%).
    const below = sc.filter(c => c.pct < (THRESH[c.cat] ?? 95))
    expect(below.map(c => `${c.cat}:${c.pct}%`)).toEqual([])
  }, 60000)
})
