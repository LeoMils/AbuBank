/*
 * _replayStore.ts — the MINIMUM server state that the stateless WebAuthn design
 * needs for real replay protection. (Answers the replay/counter-integrity review.)
 * ════════════════════════════════════════════════════════════════════════════
 * A client-held, server-signed device cert + a signed challenge cookie CANNOT by
 * themselves enforce one-time challenge consumption or monotonic counters: a
 * stateless server cannot know a token was already spent, and a client-held
 * counter can be rolled back. So we keep a tiny server-side record of:
 *   • CONSUMED challenge nonces  (single-use; TTL = challenge TTL)
 *   • the max signCount per credential  (counter-rollback defence)
 *
 * Backends (auto-selected, no code change):
 *   • Upstash / Vercel KV REST  — when KV_REST_API_URL+KV_REST_API_TOKEN (or the
 *     UPSTASH_REDIS_REST_* pair) are configured → DISTRIBUTED single-use across
 *     all serverless instances. This is the standards-correct production backend.
 *   • in-memory (per instance)  — default. Denies the exact replay (an immediate
 *     resubmit hits the same warm instance) and is what unit tests exercise; it
 *     is NOT a cross-instance guarantee (documented; closed by provisioning KV).
 * No custom crypto. `SET key val NX EX ttl` (atomic) is the whole mechanism.
 */

function env(): Record<string, string | undefined> {
  return (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>
}

function kv(): { url: string; token: string } | null {
  const e = env()
  const url = e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL
  const token = e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

/** 'kv' = distributed single-use; 'memory' = per-instance best-effort. Surfaced in /api/health. */
export function replayStoreKind(): 'kv' | 'memory' {
  return kv() ? 'kv' : 'memory'
}

// ── in-memory fallback ────────────────────────────────────────────────────────
const consumed = new Map<string, number>() // nonce → expiry ms
const counters = new Map<string, number>() // credId → max signCount
function prune(now: number): void {
  if (consumed.size > 4096) for (const [k, exp] of consumed) if (exp < now) consumed.delete(k)
}

// ── Upstash/Vercel KV REST (command-array POST; result:"OK"|null) ─────────────
async function kvCmd(cmd: (string | number)[]): Promise<unknown> {
  const c = kv()
  if (!c) return null
  const r = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  if (!r.ok) throw new Error(`kv ${r.status}`)
  const j = (await r.json()) as { result?: unknown }
  return j.result ?? null
}

/**
 * Atomically consume a one-time nonce. Returns true the FIRST time only; false on
 * any replay (already consumed) — the caller must then DENY. Fail-closed: if the
 * KV backend errors, returns false (deny) rather than allow a possible replay.
 */
export async function consumeNonce(nonce: string, ttlMs: number, now = Date.now()): Promise<boolean> {
  if (kv()) {
    try {
      const res = await kvCmd(['SET', `chal:${nonce}`, '1', 'NX', 'EX', Math.max(1, Math.ceil(ttlMs / 1000))])
      return res === 'OK'
    } catch {
      return false // fail-closed: cannot prove single-use ⇒ deny
    }
  }
  prune(now)
  if (consumed.has(nonce)) return false
  consumed.set(nonce, now + ttlMs)
  return true
}

/**
 * Monotonic-counter check keyed by credential id. Returns true if acceptable and
 * records the new max. signCount===0 ⇒ the authenticator does not use a counter
 * (typical for platform passkeys) — accepted per WebAuthn §"signature counter":
 * replay protection for these comes from single-use challenges, not the counter.
 * Uses the SERVER's stored max as the baseline, so rolling back to an older
 * client-held device cert cannot lower it.
 */
export async function serverCounterBaseline(credId: string): Promise<number> {
  if (kv()) {
    try {
      const v = await kvCmd(['GET', `ctr:${credId}`])
      return typeof v === 'string' ? Number(v) || 0 : 0
    } catch {
      return 0
    }
  }
  return counters.get(credId) ?? 0
}

export async function recordCounter(credId: string, newCounter: number): Promise<void> {
  if (newCounter <= 0) return
  if (kv()) {
    try {
      await kvCmd(['SET', `ctr:${credId}`, String(newCounter), 'EX', 400 * 24 * 3600])
    } catch {
      /* best-effort */
    }
    return
  }
  const prev = counters.get(credId) ?? 0
  if (newCounter > prev) counters.set(credId, newCounter)
}

/** Test-only reset. */
export function _resetReplayStore(): void {
  consumed.clear()
  counters.clear()
}
