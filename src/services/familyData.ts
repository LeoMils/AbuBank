/*
 * familyData.ts — the SINGLE runtime source of the private family knowledge.
 * ════════════════════════════════════════════════════════════════════════════
 * This module deliberately does NOT statically import knowledge/family_data.json
 * (nor abu-family.md). That is the whole point: with no static import, the
 * private dataset is NOT compiled into the public client bundle / source maps /
 * static assets. Instead the client hydrates it at boot from the AUTHENTICATED
 * /api/family endpoint (and from an IndexedDB copy for offline), and every
 * family consumer reads it through `getFamilyRaw()` / `getAbuFamilyMd()`.
 *
 * Tests hydrate via src/test/hydrateFamily.ts (a vitest setupFile — not bundled).
 * The server endpoint (api/family.ts) imports the JSON server-side, session-gated.
 */
export interface FamilyRaw {
  family: Record<string, unknown>
  [k: string]: unknown
}

const EMPTY: FamilyRaw = { family: {} }

let RAW: FamilyRaw | null = null
let ABU_FAMILY_MD = ''

/** Install the fetched private family knowledge (called at boot after auth, and by tests). */
export function hydrateFamily(raw: FamilyRaw | null | undefined, abuFamilyMd?: string): void {
  if (raw && typeof raw === 'object' && raw.family) RAW = raw
  if (typeof abuFamilyMd === 'string') ABU_FAMILY_MD = abuFamilyMd
}

/** The raw family JSON. Returns a stable empty shape until hydrated (never throws). */
export function getFamilyRaw(): FamilyRaw {
  return RAW ?? EMPTY
}

/** The canonical family markdown (abu-family.md body), or '' until hydrated. */
export function getAbuFamilyMd(): string {
  return ABU_FAMILY_MD
}

/** True once the private dataset has been hydrated (used to gate caching + UI). */
export function isFamilyHydrated(): boolean {
  return RAW !== null
}

/** Test-only reset. */
export function _resetFamilyData(): void {
  RAW = null
  ABU_FAMILY_MD = ''
}
