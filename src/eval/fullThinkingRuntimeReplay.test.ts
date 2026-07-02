/*
 * Phase-13 replay test — Leo's failures through the FULL async runtime entry
 * (runFullTurn), at 100%. Proves no-bypass + supervisor + speech resume.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runFullThinkingReplay, replayScore } from './fullThinkingRuntimeReplay'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

describe('Full Thinking Runtime Replay (Phase 13)', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  })

  it('replays every real failure through runFullTurn at 100%', async () => {
    const rows = await runFullThinkingReplay({ resetStore: true })
    const score = replayScore(rows)
    // eslint-disable-next-line no-console
    console.log(`[PHASE13] total=${rows.length} pass=${score.pct}%`)
    if (score.pct !== 100) {
      // eslint-disable-next-line no-console
      console.error('[PHASE13] failures:\n' + score.failures.map(f => `  ${f.id} [${f.kind}] "${f.input}" → ${f.detail}`).join('\n'))
    }
    expect(score.failures.map(f => f.id)).toEqual([])
    expect(score.pct).toBe(100)
  })
})
