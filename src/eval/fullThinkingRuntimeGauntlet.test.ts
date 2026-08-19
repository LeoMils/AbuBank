/*
 * Full Thinking Runtime Gauntlet test — transcript replay + smart-calendar batch,
 * all through the runtime, at 100%. Reports the real scenario count (honest: this
 * is a varied real set, not 500 hand-authored conversations).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runFullThinkingGauntlet, gauntletScore } from './fullThinkingRuntimeGauntlet'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

const NOW = new Date(2026, 6, 2, 9, 0, 0)

describe('Full Thinking Runtime Gauntlet', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  })

  it('passes transcript replay + smart-calendar batch at 100%', () => {
    const { all, transcript, calendar } = runFullThinkingGauntlet({ now: NOW, resetStore: true })
    const score = gauntletScore(all)
    // eslint-disable-next-line no-console
    console.log(`[GAUNTLET] transcript=${transcript.length} calendar=${calendar.length} total=${all.length} pass=${score.pct}%`)
    if (score.pct !== 100) {
      // eslint-disable-next-line no-console
      console.error('[GAUNTLET] failures:\n' + score.failures.map(f => `  ${f.id} [${f.kind}] "${f.input}" → ${f.detail}`).join('\n'))
    }
    expect(score.failures.map(f => f.id)).toEqual([])
    expect(score.pct).toBe(100)
    // Real coverage sanity: transcript lines + a varied calendar batch.
    expect(all.length).toBeGreaterThanOrEqual(40)
  })
})
