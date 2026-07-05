/*
 * Online completion — retry-once + honest failure. The runtime retries a transient
 * provider failure exactly once; a persistent failure yields a CLEAR reason (never a
 * generic "אין לי אפשרות"); a definitive "no such data" is not retried; success is
 * used verbatim (no hallucination).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { callOnlineWithRetry } from '../screens/AbuAI/runtimeFullTurn'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME } from '../screens/AbuAI/cognitiveRuntime'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}
const NOW = new Date(2026, 6, 4, 9, 0, 0)

describe('Online retry-once + honest failure', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('retries a transient failure exactly once, then succeeds', async () => {
    let n = 0
    const provider = async () => { n++; return n === 1 ? { ok: false, answer: '', reason: 'timeout' } : { ok: true, answer: 'הקרנה ב-19:30' } }
    const r = await callOnlineWithRetry(provider, 'סרטים')
    expect(r.ok).toBe(true); expect(r.attempts).toBe(2); expect(r.answer).toBe('הקרנה ב-19:30')
  })

  it('a persistent transient failure retries once then reports the reason', async () => {
    let n = 0
    const provider = async () => { n++; return { ok: false, answer: '', reason: 'provider_failed' } }
    const r = await callOnlineWithRetry(provider, 'סרטים')
    expect(r.ok).toBe(false); expect(r.attempts).toBe(2); expect(r.reason).toBe('provider_failed'); expect(n).toBe(2)
  })

  it('a definitive failure is NOT retried', async () => {
    let n = 0
    const provider = async () => { n++; return { ok: false, answer: '', reason: 'no_such_data' } }
    const r = await callOnlineWithRetry(provider, 'x')
    expect(r.attempts).toBe(1); expect(n).toBe(1)
  })

  it('success on the first attempt is used verbatim (no retry, no hallucination)', async () => {
    let n = 0
    const provider = async () => { n++; return { ok: true, answer: 'אוטובוס 47 בשעה 10:05' } }
    const r = await callOnlineWithRetry(provider, 'אוטובוס')
    expect(r.attempts).toBe(1); expect(r.answer).toBe('אוטובוס 47 בשעה 10:05')
  })

  it('through the controller: transient-then-success delivers the online answer, not a failure', async () => {
    let n = 0
    const tools: FullTurnTools = { llm: async () => 'x', online: async () => { n++; return n === 1 ? { ok: false, answer: '', reason: 'timeout' } : { ok: true, answer: 'יש הקרנה ב-20:00' } } }
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מה הסרטים בכפר סבא', { messages: [], now: NOW }, tools)
    expect(r.source).toBe('online')
    expect(r.display).toContain('20:00')
    expect(r.display).not.toMatch(/נפל|לא הצלחתי/)
  })

  it('through the controller: persistent failure gives a clear reason (never generic)', async () => {
    const tools: FullTurnTools = { llm: async () => 'x', online: async () => ({ ok: false, answer: '', reason: 'provider_failed' }) }
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מי ניצח במונדיאל אתמול', { messages: [], now: NOW }, tools)
    expect(r.display).toMatch(/נפל|לא הצלחתי|ננסה/)
    expect(r.display).not.toMatch(/אין לי אפשרות/)
  })
})
