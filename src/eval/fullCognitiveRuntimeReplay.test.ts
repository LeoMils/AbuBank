/*
 * Full Cognitive Runtime Replay test (Phase 12) — the complete Leo-failure set +
 * directional family + memory + broken-Hebrew, all through the runtime, at 100%.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runFullCognitiveReplay, gauntletScore } from './fullCognitiveRuntimeReplay'

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

describe('Full Cognitive Runtime Replay (Phase 12)', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  })

  it('replays the full Leo-failure set through the runtime at 100%', () => {
    const rows = runFullCognitiveReplay({ now: NOW, resetStore: true })
    const score = gauntletScore(rows)
    // eslint-disable-next-line no-console
    console.log(`[FULL-COGNITIVE-REPLAY] total=${rows.length} pass=${score.pct}%`)
    if (score.pct !== 100) {
      // eslint-disable-next-line no-console
      console.error('[FULL-COGNITIVE-REPLAY] failures:\n' + score.failures.map(f => `  ${f.id} [${f.kind}] "${f.input}" → ${f.detail}`).join('\n'))
    }
    expect(score.failures.map(f => f.id)).toEqual([])
    expect(score.pct).toBe(100)
    expect(rows.length).toBeGreaterThanOrEqual(65)
  })
})
