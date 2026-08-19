import { describe, it, expect } from 'vitest'
import { EvidenceQueue } from './evidenceQueue'
import { MemoryBackend } from '../services/durableStore'
import { buildEnvelope, type TurnFacts } from './traceEnvelope'
import { DEFAULT_EVOLUTION_CONFIG } from './config'

const Q = DEFAULT_EVOLUTION_CONFIG.queue
function facts(over: Partial<TurnFacts> = {}): TurnFacts {
  return { ts: 1_700_000_000_000, sessionId: 's1', turnId: 't1', input: 'מה מחר ביומן',
    intent: 'calendar_read', source: 'deterministic', finalAnswer: 'מחר אין כלום', ...over }
}

describe('evidence queue — idempotent append', () => {
  it('dedupes the same envelope', () => {
    const q = new EvidenceQueue(new MemoryBackend(), Q)
    const e = buildEnvelope(facts())
    const a = q.enqueue(e, 1000)
    const b = q.enqueue(e, 2000)
    expect(a.ok && !a.deduped).toBe(true)
    expect(b.ok && b.deduped).toBe(true)
    expect(q.size()).toBe(1)
  })
  it('rejects oversized payloads', () => {
    const q = new EvidenceQueue(new MemoryBackend(), { ...Q, maxPayloadBytes: 50 })
    const r = q.enqueue(buildEnvelope(facts()), 1000)
    expect(r.ok).toBe(false)
  })
})

describe('evidence queue — Scenario D: offline close then reopen, upload once', () => {
  it('survives an app close before upload and does not duplicate', async () => {
    const backend = new MemoryBackend()
    const q1 = new EvidenceQueue(backend, Q)
    await q1.init()
    q1.enqueue(buildEnvelope(facts({ turnId: 'a' })), 1000)
    q1.enqueue(buildEnvelope(facts({ turnId: 'b', input: 'מזג אוויר' })), 1001)

    // "App closes" → a brand-new queue hydrates from the SAME durable backend.
    const q2 = new EvidenceQueue(backend, Q)
    await q2.init()
    expect(q2.size()).toBe(2)
    expect(q2.pending(2000)).toHaveLength(2)

    // Connectivity returns → upload. A duplicated retry ack does not double-count.
    const first = q2.pending(2000)[0]!
    q2.markUploaded(first.idempotencyKey)
    q2.markUploaded(first.idempotencyKey) // duplicate ack — idempotent
    expect(q2.pending(2000)).toHaveLength(1)
  })
})

describe('evidence queue — retry, backoff, dead-letter', () => {
  it('dead-letters after maxRetries and preserves it under ring cap', () => {
    const q = new EvidenceQueue(new MemoryBackend(), { ...Q, maxRetries: 3 })
    const e = buildEnvelope(facts())
    q.enqueue(e, 0)
    const key = e.integrity.idempotencyKey
    q.markFailed(key, 100); expect(q.get(key)!.status).toBe('pending')
    q.markFailed(key, 200); expect(q.get(key)!.nextRetryAt).toBeGreaterThan(200)
    q.markFailed(key, 300)
    expect(q.get(key)!.status).toBe('dead_letter')
    expect(q.deadLetters()).toHaveLength(1)
  })
})

describe('evidence queue — corruption recovery + retention', () => {
  it('skips a corrupt record on init without throwing', async () => {
    const backend = new MemoryBackend({ 'evt:bad': '{not json', 'other': 'x' })
    const q = new EvidenceQueue(backend, Q)
    await expect(q.init()).resolves.toBeUndefined()
    expect(q.size()).toBe(0)
  })
  it('purges events older than retention but keeps dead-letters', () => {
    const q = new EvidenceQueue(new MemoryBackend(), { ...Q, maxRetries: 1 })
    const old = buildEnvelope(facts({ turnId: 'old' }))
    q.enqueue(old, 0)
    const dead = buildEnvelope(facts({ turnId: 'dead', input: 'x' }))
    q.enqueue(dead, 0); q.markFailed(dead.integrity.idempotencyKey, 0) // → dead_letter
    const now = 40 * 24 * 60 * 60 * 1000
    const removed = q.purgeOlderThan(now, 30)
    expect(removed).toBe(1)
    expect(q.deadLetters()).toHaveLength(1) // dead-letter exempt
  })
})
