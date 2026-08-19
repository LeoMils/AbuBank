import { describe, it, expect, beforeEach } from 'vitest'
import { runBehavioralGauntlet, type Cat } from './abuaiBehavioralProductionGauntlet'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

const THRESH: Partial<Record<Cat, number>> = {
  calendar: 97, family: 98, online: 96, hebrew: 96, speech: 96, supervisor: 96,
  general: 96, frustration: 96, continuation: 96, audio: 96,
}

describe('AbuAI Behavioral Production Gauntlet (Phase 14)', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('≥750 behavior scenarios; every category meets its threshold', async () => {
    const { rows, scores } = await runBehavioralGauntlet()
    // eslint-disable-next-line no-console
    console.log(`[BEHAVIOR] total=${rows.length}\n` + scores.map(s => `  ${s.cat}: ${s.pct}% (${s.passed}/${s.total}) [need ${THRESH[s.cat]}]`).join('\n'))
    expect(rows.length).toBeGreaterThanOrEqual(750)
    const below = scores.filter(s => s.pct < (THRESH[s.cat] ?? 96))
    expect(below.map(s => `${s.cat}:${s.pct}%`)).toEqual([])
  }, 60000)
})
