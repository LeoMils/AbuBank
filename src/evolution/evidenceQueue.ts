/*
 * Evolution OS — durable append-only evidence queue (Section 18)
 * ══════════════════════════════════════════════════════════════
 * Survives app close / background / offline. Built on the SAME KVBackend contract
 * as the production `durableStore` (dependency-injected → provable in node tests
 * with MemoryBackend; IndexedDB-backed in the browser via a SEPARATE database so
 * it can never collide with safety-critical user data).
 *
 * Guarantees:
 *  - Append-only + idempotent: the same envelope (same idempotencyKey) enqueued
 *    twice is stored ONCE. Duplicate delivery never creates duplicate evidence.
 *  - Retry with exponential backoff + jitter; dead-letter after maxRetries.
 *  - Ring cap: oldest *uploaded* then oldest *pending* events drop past maxEvents;
 *    dead-letter events are preserved longest (they are the ones needing a human).
 *  - Corruption recovery: a bad record is quarantined, never throws to the caller.
 *  - Payload cap: an oversized envelope is rejected (returned, not stored raw).
 */
import type { KVBackend } from '../services/durableStore'
import { MemoryBackend } from '../services/durableStore'
import type { AbuTraceEnvelope } from './traceEnvelope'
import type { EvolutionConfig } from './config'

export type UploadStatus = 'pending' | 'uploaded' | 'dead_letter'

export interface EvidenceRecord {
  idempotencyKey: string
  payloadHash: string
  schemaVersion: string
  envelope: AbuTraceEnvelope
  status: UploadStatus
  retryCount: number
  createdAt: number
  nextRetryAt: number
  lastError?: string
}

export type EnqueueResult =
  | { ok: true; deduped: boolean; record: EvidenceRecord }
  | { ok: false; reason: 'oversized' | 'invalid' }

const KEY_PREFIX = 'evt:'

/** IndexedDB backend for Evolution evidence — a DISTINCT database from user data. */
export class EvolutionIDBBackend implements KVBackend {
  private dbName = 'abu-evolution'
  private store = 'evidence'
  private version = 1
  private dbPromise: Promise<unknown> | null = null
  private async db(): Promise<Record<string, (...a: unknown[]) => unknown>> {
    if (!this.dbPromise) {
      const { openDB } = await import('idb')
      const store = this.store
      this.dbPromise = openDB(this.dbName, this.version, {
        upgrade(db) { if (!db.objectStoreNames.contains(store)) db.createObjectStore(store) },
      })
    }
    return this.dbPromise as never
  }
  async getAll(): Promise<Record<string, string>> {
    const db = await this.db() as never as { getAllKeys(s: string): Promise<string[]>; getAll(s: string): Promise<string[]> }
    const keys = await db.getAllKeys(this.store)
    const vals = await db.getAll(this.store)
    const out: Record<string, string> = {}
    keys.forEach((k, i) => { out[k] = vals[i]! })
    return out
  }
  async set(key: string, value: string): Promise<void> {
    const db = await this.db() as never as { put(s: string, v: string, k: string): Promise<void> }
    await db.put(this.store, value, key)
  }
  async remove(key: string): Promise<void> {
    const db = await this.db() as never as { delete(s: string, k: string): Promise<void> }
    await db.delete(this.store, key)
  }
}

export class EvidenceQueue {
  private cache = new Map<string, EvidenceRecord>()
  private ready = false
  constructor(private backend: KVBackend, private cfg: EvolutionConfig['queue']) {}

  /** Hydrate from the durable backend. Corrupt records are skipped, not fatal. */
  async init(): Promise<void> {
    let all: Record<string, string> = {}
    try { all = await this.backend.getAll() } catch { all = {} }
    for (const [k, v] of Object.entries(all)) {
      if (!k.startsWith(KEY_PREFIX)) continue
      try {
        const rec = JSON.parse(v) as EvidenceRecord
        if (rec && rec.idempotencyKey && rec.envelope) this.cache.set(rec.idempotencyKey, rec)
      } catch { /* corrupt record — quarantine by ignoring; never throw */ }
    }
    this.ready = true
  }

  isReady(): boolean { return this.ready }

  /**
   * Append an envelope. Idempotent by envelope.integrity.idempotencyKey. Returns
   * `deduped: true` (no new write) if already present. Oversized payloads are
   * rejected. `nowMs` is injected for deterministic tests.
   */
  enqueue(envelope: AbuTraceEnvelope, nowMs: number): EnqueueResult {
    const key = envelope?.integrity?.idempotencyKey
    if (!key || !envelope.schemaVersion) return { ok: false, reason: 'invalid' }
    const serialized = JSON.stringify(envelope)
    if (serialized.length > this.cfg.maxPayloadBytes) return { ok: false, reason: 'oversized' }

    const existing = this.cache.get(key)
    if (existing) return { ok: true, deduped: true, record: existing }

    const record: EvidenceRecord = {
      idempotencyKey: key,
      payloadHash: envelope.integrity.payloadHash,
      schemaVersion: envelope.schemaVersion,
      envelope,
      status: 'pending',
      retryCount: 0,
      createdAt: nowMs,
      nextRetryAt: nowMs,
    }
    this.cache.set(key, record)
    this.persist(record)
    this.enforceRingCap()
    return { ok: true, deduped: false, record }
  }

  /** Events due for upload at `nowMs` (pending + nextRetryAt reached). Oldest first. */
  pending(nowMs: number): EvidenceRecord[] {
    return [...this.cache.values()]
      .filter(r => r.status === 'pending' && r.nextRetryAt <= nowMs)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  /** Mark a successful upload. Idempotent. */
  markUploaded(idempotencyKey: string): void {
    const r = this.cache.get(idempotencyKey)
    if (!r) return
    r.status = 'uploaded'
    this.persist(r)
  }

  /**
   * Mark a failed upload → schedule a retry with exponential backoff + jitter,
   * or dead-letter after maxRetries. Jitter avoids a thundering herd on reconnect.
   */
  markFailed(idempotencyKey: string, nowMs: number, error?: string): void {
    const r = this.cache.get(idempotencyKey)
    if (!r) return
    r.retryCount++
    if (error !== undefined) r.lastError = error
    if (r.retryCount >= this.cfg.maxRetries) {
      r.status = 'dead_letter'
    } else {
      const backoff = Math.min(this.cfg.baseBackoffMs * 2 ** (r.retryCount - 1), this.cfg.maxBackoffMs)
      const jitter = Math.floor(Math.random() * Math.min(1000, backoff))
      r.nextRetryAt = nowMs + backoff + jitter
    }
    this.persist(r)
  }

  deadLetters(): EvidenceRecord[] { return [...this.cache.values()].filter(r => r.status === 'dead_letter') }
  all(): EvidenceRecord[] { return [...this.cache.values()] }
  get(idempotencyKey: string): EvidenceRecord | undefined { return this.cache.get(idempotencyKey) }
  size(): number { return this.cache.size }

  /** Delete evidence older than retentionDays (Section 19). Dead-letters exempt
   *  unless force=true. Returns count removed. */
  purgeOlderThan(nowMs: number, retentionDays: number, force = false): number {
    const cutoff = nowMs - retentionDays * 24 * 60 * 60 * 1000
    let n = 0
    for (const r of [...this.cache.values()]) {
      if (r.createdAt < cutoff && (force || r.status !== 'dead_letter')) {
        this.cache.delete(r.idempotencyKey)
        void this.backend.remove(KEY_PREFIX + r.idempotencyKey).catch(() => {})
        n++
      }
    }
    return n
  }

  private persist(r: EvidenceRecord): void {
    try { void this.backend.set(KEY_PREFIX + r.idempotencyKey, JSON.stringify(r)) } catch { /* best-effort */ }
  }

  /** Keep at most maxEvents: drop uploaded (oldest) first, then pending (oldest);
   *  dead-letters are preserved — they are the records that still need a human. */
  private enforceRingCap(): void {
    if (this.cache.size <= this.cfg.maxEvents) return
    const order = (s: UploadStatus) => (s === 'uploaded' ? 0 : s === 'pending' ? 1 : 2)
    const victims = [...this.cache.values()]
      .sort((a, b) => order(a.status) - order(b.status) || a.createdAt - b.createdAt)
    let excess = this.cache.size - this.cfg.maxEvents
    for (const v of victims) {
      if (excess <= 0) break
      if (v.status === 'dead_letter') break // never drop a dead-letter to fit
      this.cache.delete(v.idempotencyKey)
      void this.backend.remove(KEY_PREFIX + v.idempotencyKey).catch(() => {})
      excess--
    }
  }
}

/** Test/SSR factory — in-memory backend. */
export function createMemoryQueue(cfg: EvolutionConfig['queue']): EvidenceQueue {
  return new EvidenceQueue(new MemoryBackend(), cfg)
}

/** Production factory — separate IndexedDB database, falls back to memory. */
export function createDurableQueue(cfg: EvolutionConfig['queue']): EvidenceQueue {
  let backend: KVBackend
  try {
    backend = (typeof indexedDB !== 'undefined' && indexedDB !== null) ? new EvolutionIDBBackend() : new MemoryBackend()
  } catch { backend = new MemoryBackend() }
  return new EvidenceQueue(backend, cfg)
}
