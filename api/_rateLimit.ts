/*
 * _rateLimit.ts — machine-closable abuse/cost protection for the billable edge proxies. (A7 / challenge B)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A no-login PWA makes AUTHENTICATION a product decision, but it does NOT make abuse/rate limiting one.
 * These are the throttles available WITHOUT auth and WITHOUT new infra:
 *   • per-IP sliding-window rate limit (burst control)
 *   • a global provider-cost circuit breaker (flood control)
 * HONEST LIMIT: serverless instances do not share memory, so an in-memory counter bounds per-INSTANCE
 * burst/flood, not a globally-perfect rate. A fully distributed limit needs a shared store (Vercel KV /
 * Upstash) — that is infra provisioning (an owner/ops step), recorded as such. This meaningfully raises
 * the cost of single-source flooding through a warm instance and is the strongest limit reachable now.
 */

const windows = new Map<string, number[]>()
const MAX_KEYS = 5000 // bound memory — evict oldest key when exceeded

/** True when `key` has already made `limit` requests within `windowMs` (i.e. this request is over the
 *  limit and should be rejected). Sliding window; prunes expired timestamps. `now` injectable for tests. */
export function rateLimited(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
  const arr = (windows.get(key) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= limit) { windows.set(key, arr); return true }
  arr.push(now)
  windows.set(key, arr)
  if (windows.size > MAX_KEYS) { const first = windows.keys().next().value; if (first !== undefined) windows.delete(first) }
  return false
}

/** A global provider-cost circuit breaker: trips when total billable calls of a class exceed `limit`
 *  within `windowMs` (per instance), so a flood cannot amplify provider cost unbounded. */
export function circuitTripped(costClass: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
  return rateLimited(`__circuit__:${costClass}`, limit, windowMs, now)
}

/** The client key for throttling: the first x-forwarded-for / x-real-ip hop, or 'unknown'. Never a value. */
export function clientKey(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  const ip = xff.split(',')[0]?.trim()
  return ip && ip.length > 0 ? ip : 'unknown'
}

/** Test-only reset. */
export function _resetRateLimit(): void { windows.clear() }
