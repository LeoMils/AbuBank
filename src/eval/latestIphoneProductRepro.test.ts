import { describe, it, expect, beforeEach } from 'vitest'
import { checkProductExtraction, productScore } from './latestIphoneProductRepro'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

describe('Latest iPhone PRODUCT repro (calendar UI voice-add path)', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('parseAppointmentText matches the strong extraction (no raw title, PM time, resolved venue, details)', async () => {
    const s = productScore(await checkProductExtraction())
    // eslint-disable-next-line no-console
    if (s.failures.length) console.error('[PROD-REPRO] failures:\n' + s.failures.map(f => `  ${f.id} → ${f.detail}`).join('\n'))
    expect(s.failures.map(f => f.id)).toEqual([])
  })
})
