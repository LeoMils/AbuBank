import { describe, it, expect, beforeEach } from 'vitest'
import { runRecordedReplay, recordedScore, byCategory, bySource } from './executiveControllerRecordedReplay'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

describe('Executive Controller — Recorded Conversation Replay', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('every recorded line passes through the single controller, finalized + clean (100%)', async () => {
    const rows = await runRecordedReplay()
    const score = recordedScore(rows)
    // eslint-disable-next-line no-console
    console.log(`[RECORDED] lines=${rows.length} behavior=${score.pct}% finalized=${score.finalizedPct}%\n` +
      'sources: ' + bySource(rows).map(s => `${s.source}(${s.total})`).join(' ') + '\n' +
      'by category:\n' + byCategory(rows).map(c => `  ${c.category}: ${c.pct}% (${c.passed}/${c.total})`).join('\n'))
    if (score.pct !== 100) {
      // eslint-disable-next-line no-console
      console.error('[RECORDED] failures:\n' + score.failures.slice(0, 40).map(f => `  [${f.source}] "${f.input}" cat=${f.category} finalized=${f.finalized} → ${f.detail}`).join('\n'))
    }
    expect(score.failures.map(f => `${f.source}:${f.input}`)).toEqual([])
    expect(score.pct).toBe(100)
    expect(score.finalizedPct).toBe(100)
    expect(rows.length).toBeGreaterThanOrEqual(150)
  })
})
