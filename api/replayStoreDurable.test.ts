/*
 * replayStoreDurable.test.ts — DISTRIBUTED single-use is auth-correctness. (Item 1)
 *
 * Proves the KV-backed store gives a GLOBAL guarantee (cross-instance / restart),
 * the production fail-closed gate, and the required negative controls:
 *   • cross-instance single-use (a shared KV denies a replay from another instance)
 *   • durable counter baseline (survives an instance restart)
 *   • production without a distributed store → replay protection NOT satisfied
 *   • NEGATIVE: if SET-NX atomicity is removed → single-use breaks (detector would pass a replay)
 *   • NEGATIVE: if the counter store is reset/rolled back → baseline drops (rollback becomes possible)
 * The mock is a shared in-memory Upstash-REST simulator: two "instances" that share
 * it model horizontal scaling; clearing the per-process store models a cold start.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  consumeNonce, serverCounterBaseline, recordCounter, distributedStoreAvailable,
  replayProtectionSatisfied, replayStoreKind, _resetReplayStore,
} from './_replayStore'

// ── shared "distributed" KV simulator (survives per-process resets) ──
let SHARED = new Map<string, { v: string; exp: number }>()
let honorNX = true // flip to model a NON-atomic store (negative control)
let counterDurable = true // flip to model a counter store that loses state (negative control)

function kvSimulator(cmd: (string | number)[]): unknown {
  const parts = cmd.map(String)
  const op = parts[0] ?? ''
  const key = parts[1] ?? ''
  const val = parts[2] ?? ''
  const rest = parts.slice(3)
  const now = Date.now()
  if (op === 'SET') {
    const nx = rest.includes('NX')
    const exIdx = rest.indexOf('EX')
    const ttl = exIdx >= 0 ? Number(rest[exIdx + 1]) * 1000 : 3600_000
    const existing = SHARED.get(key)
    const alive = existing && existing.exp > now
    if (nx && honorNX && alive) return null // key exists → NX fails
    if (key.startsWith('ctr:') && !counterDurable) return 'OK' // pretend to write but do not persist
    SHARED.set(key, { v: val, exp: now + ttl })
    return 'OK'
  }
  if (op === 'GET') {
    const e = SHARED.get(key)
    return e && e.exp > now ? e.v : null
  }
  return null
}

beforeEach(() => {
  SHARED = new Map()
  honorNX = true
  counterDurable = true
  _resetReplayStore()
  process.env.KV_REST_API_URL = 'https://kv.example'
  process.env.KV_REST_API_TOKEN = 'tok'
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const cmd = JSON.parse(String((init as RequestInit).body)) as (string | number)[]
    return new Response(JSON.stringify({ result: kvSimulator(cmd) }), { status: 200 })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
})

describe('distributed single-use (KV) — GLOBAL guarantee', () => {
  it('replayStore reports kv and distributedStoreAvailable', () => {
    expect(replayStoreKind()).toBe('kv')
    expect(distributedStoreAvailable()).toBe(true)
  })

  it('a nonce consumed on one instance CANNOT be consumed on another (or after a cold start)', async () => {
    expect(await consumeNonce('n1', 120_000)).toBe(true) // instance A
    _resetReplayStore() // instance B / cold start — per-process memory is empty
    expect(await consumeNonce('n1', 120_000)).toBe(false) // KV remembers → DENIED
    expect(await consumeNonce('n2', 120_000)).toBe(true) // a fresh nonce still works
  })

  it('the counter baseline survives an instance restart (durable, non-rollback)', async () => {
    await recordCounter('cred', 7)
    _resetReplayStore() // restart: memory gone
    expect(await serverCounterBaseline('cred')).toBe(7) // KV persisted it
    await recordCounter('cred', 3) // stale
    expect(await serverCounterBaseline('cred')).toBe(7)
  })
})

describe('production fail-closed gate', () => {
  it('with a distributed store → satisfied; without one in production → NOT satisfied', () => {
    expect(replayProtectionSatisfied(true)).toBe(true)
    delete process.env.KV_REST_API_URL // no distributed store
    expect(distributedStoreAvailable()).toBe(false)
    expect(replayProtectionSatisfied(true)).toBe(false) // production
    expect(replayProtectionSatisfied(false)).toBe(true) // non-production may use memory
  })
})

describe('NEGATIVE CONTROLS — the detector must fail if protection is weakened', () => {
  it('if SET-NX atomicity is removed, single-use BREAKS (a replay would be accepted)', async () => {
    honorNX = false // model a non-atomic store
    expect(await consumeNonce('nX', 120_000)).toBe(true)
    // Without NX the second consume is NOT denied — proving the guarantee DEPENDS on atomic NX.
    expect(await consumeNonce('nX', 120_000)).toBe(true)
  })

  it('if the counter store loses state, the baseline ROLLS BACK (durability is required)', async () => {
    counterDurable = false // model a store that does not persist the counter
    await recordCounter('cred', 9)
    _resetReplayStore()
    expect(await serverCounterBaseline('cred')).toBe(0) // rolled back to 0 — the rollback the durable store prevents
  })
})
