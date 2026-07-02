/*
 * Intelligence acceptance — behavior-first quality gate (per layer). Every case is
 * a Leo-failure behavior with an expected + forbidden answer, driven through the one
 * ExecutiveCognitiveController. Must be 100% (each layer at its full count).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runIntelligenceAcceptance, acceptanceScore } from './abuaiIntelligenceAcceptance'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

describe('AbuAI Intelligence Acceptance (behavior-first)', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('every behavior case passes (100%), per layer', async () => {
    const rows = await runIntelligenceAcceptance()
    const s = acceptanceScore(rows)
    // eslint-disable-next-line no-console
    console.log(`[INTEL-ACC] ${s.pct}% (${s.passed}/${s.total}) — ` + s.byLayer.map(l => `${l.layer}:${l.passed}/${l.total}`).join(' '))
    if (s.failures.length) {
      // eslint-disable-next-line no-console
      console.error('[INTEL-ACC] failures:\n' + s.failures.map(f => `  ${f.id} [${f.layer}] ${f.detail}`).join('\n'))
    }
    expect(s.failures.map(f => f.id)).toEqual([])
    expect(s.pct).toBe(100)
  }, 60000)
})
