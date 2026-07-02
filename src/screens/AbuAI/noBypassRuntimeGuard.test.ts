/*
 * No-Bypass Guard — proves every runFullTurn answer carries a RUNTIME_FINALIZED
 * trace, and that a non-finalized object is rejected.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runFullTurn, type FullTurnTools } from './runtimeFullTurn'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import { isEmittable, assertNoBypass } from './noBypassRuntimeGuard'
import { isFinalized } from './runtimeTrace'

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
const ctx = { messages: [] as Array<{ role: string; content: string }>, now: NOW }
const T: FullTurnTools = { llm: async () => 'תשובה כללית קצרה.', online: async () => ({ ok: true, answer: 'תוצאה' }) }

const INPUTS = [
  'איזה יום היום', 'מה יש לי מחר', 'מתי יש לי פגישה עם מוטי',
  'תקבעי פגישה עם דני מחר בעשר', 'מה הקשר בין לאו לאנאבל',
  'מה יש בקולנוע היום', 'מה זה קוונטים', 'את לא מבינה אותי',
  'אני לא שומע אותך', 'תמשיכי', '...',
]

describe('no-bypass: every runFullTurn answer is RUNTIME_FINALIZED', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  })

  it('every input carries a valid finalized trace and is emittable', async () => {
    for (const input of INPUTS) {
      const r = await runFullTurn(IDLE_RUNTIME, input, ctx, T)
      expect(isFinalized(r.trace), `trace missing for "${input}"`).toBe(true)
      expect(isEmittable(r), `not emittable for "${input}"`).toBe(true)
      expect(() => assertNoBypass(r, input)).not.toThrow()
    }
  })

  it('rejects an answer with no trace (a legacy-style emit)', () => {
    expect(isEmittable({ display: 'טקסט מדומה', speak: 'טקסט' })).toBe(false)
    expect(() => assertNoBypass({ display: 'x', speak: 'x' }, 'legacy')).toThrow(/no-bypass/)
  })
})
