/*
 * familyHydration.ts — load the private family knowledge into familyData.ts.
 * ════════════════════════════════════════════════════════════════════════════
 * Two sources, both device-private (never a public/cacheable asset):
 *   • cache   — a device-local IndexedDB copy (durableStore) for INSTANT offline
 *     hydration at boot. Written only after a successful authenticated fetch.
 *   • server  — the authenticated /api/family endpoint (Cache-Control private,
 *     no-store), fetched after the session is established; refreshes the cache.
 */
import { durable } from './durableStore'
import { hydrateFamily, isFamilyHydrated, type FamilyRaw } from './familyData'

const CACHE_KEY = 'abu-family-cache-v1'

/** Instant, synchronous hydration from the device-local cache (offline-first). */
export function hydrateFamilyFromCache(): boolean {
  try {
    const cached = durable.getJSON<FamilyRaw | null>(CACHE_KEY, null)
    if (cached && cached.family) {
      hydrateFamily(cached)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/** Authenticated fetch → hydrate + refresh the device-local cache. Never throws. */
export async function hydrateFamilyFromServer(): Promise<boolean> {
  try {
    const r = await fetch('/api/family', { credentials: 'same-origin' })
    if (!r.ok) return false
    const data = (await r.json()) as FamilyRaw
    if (!data || !data.family) return false
    hydrateFamily(data)
    try {
      durable.setJSON(CACHE_KEY, data)
    } catch {
      /* quota — hydration still succeeded in memory */
    }
    return true
  } catch {
    return false
  }
}

/** Boot helper: cache first (instant/offline), then refresh from the server. */
export async function ensureFamilyHydrated(): Promise<void> {
  hydrateFamilyFromCache()
  const ok = await hydrateFamilyFromServer()
  // If the server refused (not yet authed / offline) and we had no cache, stay
  // unhydrated — family consumers return safe-empty until a later successful pass.
  void ok
  void isFamilyHydrated
}
