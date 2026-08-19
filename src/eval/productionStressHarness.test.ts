/*
 * Production stress/fuzz gate — randomized mixed-domain conversations through the
 * REAL controller must never violate a production invariant (0 loops, 0 false
 * cancellations, 0 stuck confirmations, 0 lost pending on non-request interruptions,
 * always finalized, never empty, no gratuitous greetings).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runStress } from './productionStressHarness'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

describe('Production Stress / Fuzz Gate', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('400 randomized mixed-domain conversations produce ZERO invariant violations', async () => {
    const { turns, violations } = await runStress(400, 8)
    if (violations.length) {
      // eslint-disable-next-line no-console
      console.error(`[STRESS] ${violations.length} violations over ${turns} turns:\n` +
        violations.slice(0, 20).map(v => `  seed${v.seed}#${v.turnIndex} [${v.input.slice(0, 30)}] ${v.detail}`).join('\n'))
    }
    expect(turns).toBeGreaterThan(800)
    expect(violations.map(v => `${v.seed}#${v.turnIndex}:${v.detail}`)).toEqual([])
  }, 120000)
})
