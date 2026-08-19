/*
 * /api/family — the private family knowledge, behind server-verified auth.
 * ════════════════════════════════════════════════════════════════════════════
 * The ~70-person family dataset (names/aliases/relationships/birthdays/city/
 * occupations/notes) used to be compiled into the PUBLIC client bundle. It now
 * lives ONLY here and is served exclusively to an authenticated Abu Ela session:
 *   • unauthenticated (or, in production, misconfigured) → 401/503, NO data,
 *   • authenticated → the dataset, with `Cache-Control: private, no-store` so no
 *     shared/CDN/browser cache retains it and the service worker never stores it
 *     (the SW's runtimeCaching is empty; /api/* is never cached).
 * The client hydrates this at boot after auth and caches it in device-local
 * IndexedDB for offline (durableStore) — never in a public/cacheable asset.
 */
import familyData from '../knowledge/family_data.json'
import { guardBillable } from './_session'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'BAD_REQUEST' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }
  // Same server-verified session the billable endpoints require (401 unauth; 503 if prod-misconfigured).
  const denied = await guardBillable(req)
  if (denied) return denied

  return new Response(JSON.stringify(familyData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Private, per-user, never stored by any shared/browser/SW cache.
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}
