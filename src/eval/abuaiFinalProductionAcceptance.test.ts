/*
 * Final production acceptance — ≥150 behavior-first cases through the one
 * ExecutiveCognitiveController. Every layer must meet its threshold; 0 critical
 * failures (wrong family relation / wrong calendar create-cancel / broken Hebrew /
 * confirmation loop / legacy bypass are all encoded as forbidden answers).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runFinalAcceptance } from './abuaiFinalProductionAcceptance'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

describe('AbuAI Final Production Acceptance', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('≥150 cases; every layer meets its threshold; 0 failures', async () => {
    const s = await runFinalAcceptance()
    // eslint-disable-next-line no-console
    console.log(`[FINAL-ACC] total=${s.total} ${s.pct}%\n` + s.byLayer.map(l => `  ${l.layer}: ${l.pct}% (${l.passed}/${l.total}) need ${l.threshold} ${l.ok ? '✓' : '✗'}`).join('\n'))
    if (s.failures.length) {
      // eslint-disable-next-line no-console
      console.error('[FINAL-ACC] failures:\n' + s.failures.map(f => `  ${f.id} [${f.layer}] ${f.detail}`).join('\n'))
    }
    expect(s.total).toBeGreaterThanOrEqual(150)
    expect(s.byLayer.filter(l => !l.ok).map(l => `${l.layer}:${l.pct}%`)).toEqual([])
    expect(s.failures.map(f => f.id)).toEqual([])
  }, 120000)
})
