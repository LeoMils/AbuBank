import { describe, it, expect, beforeEach } from 'vitest'
import { runMasterReplay, masterScore } from './abuaiRealFailureMasterReplay'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

describe('AbuAI Real Failure Master Replay (Phase 3)', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('every real failure passes AND is RUNTIME_FINALIZED (100%)', async () => {
    const rows = await runMasterReplay({ resetStore: true })
    const score = masterScore(rows)
    // eslint-disable-next-line no-console
    console.log(`[MASTER] total=${rows.length} behavior=${score.pct}% finalized=${score.finalizedPct}%`)
    if (score.pct !== 100) {
      // eslint-disable-next-line no-console
      console.error('[MASTER] failures:\n' + score.failures.map(f => `  ${f.id} ${f.title} finalized=${f.finalized} → ${f.detail}`).join('\n'))
    }
    expect(score.failures.map(f => f.id)).toEqual([])
    expect(score.pct).toBe(100)
    expect(score.finalizedPct).toBe(100)
    expect(rows.length).toBeGreaterThanOrEqual(20)
  })
})
