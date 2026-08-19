/*
 * Phase-6 operational replay test — Leo's failures through runFullTurn, 100%
 * behavior AND 100% RUNTIME_FINALIZED (no legacy bypass).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runFullOperationalReplay, opScore } from './fullOperationalRuntimeReplay'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

describe('Full Operational Runtime Replay (Phase 6)', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  })

  it('replays every failure through runFullTurn: 100% behavior + 100% finalized', async () => {
    const rows = await runFullOperationalReplay({ resetStore: true })
    const score = opScore(rows)
    // eslint-disable-next-line no-console
    console.log(`[PHASE6] total=${rows.length} behavior=${score.pct}% finalized=${score.finalizedPct}%`)
    if (score.pct !== 100) {
      // eslint-disable-next-line no-console
      console.error('[PHASE6] failures:\n' + score.failures.map(f => `  ${f.id} [${f.kind}] "${f.input}" finalized=${f.finalized} → ${f.detail}`).join('\n'))
    }
    expect(score.failures.map(f => f.id)).toEqual([])
    expect(score.pct).toBe(100)
    expect(score.finalizedPct).toBe(100)
  })
})
