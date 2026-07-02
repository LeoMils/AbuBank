/*
 * Full-runtime replay test — asserts the latest transcript lines pass through the
 * SAME cognitive runtime the app uses, at 100%. Runs with a clean local store and
 * a fixed clock so it is deterministic.
 *
 * The calendar save path round-trips through localStorage, which the default `node`
 * vitest env lacks. Rather than add a jsdom dependency (a package.json change), we
 * install a tiny in-memory localStorage shim — enough for the real save/read path.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runFullRuntimeReplay, replayScore } from './latestRealIphoneFullRuntimeReplay'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

// Fixed clock: 2026-07-02 (matches the project's currentDate).
const NOW = new Date(2026, 6, 2, 9, 0, 0)

describe('Latest real iPhone — FULL RUNTIME replay', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  })

  it('replays every transcript line through the runtime at 100%', () => {
    const rows = runFullRuntimeReplay({ now: NOW, resetStore: true })
    const score = replayScore(rows)
    if (score.pct !== 100) {
      // Surface exactly which lines/layers failed (failure-policy diagnosis).
      // eslint-disable-next-line no-console
      console.error('[FULL-RUNTIME-REPLAY] failures:\n' +
        score.failures.map(f => `  ${f.id} [${f.flow}] "${f.line}" → ${f.detail}`).join('\n'))
    }
    expect(score.failures.map(f => f.id)).toEqual([])
    expect(score.pct).toBe(100)
  })
})
