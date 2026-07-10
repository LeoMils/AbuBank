/*
 * Version sync — detect a stale cached PWA build (iPhone) (§ service worker control)
 * ═════════════════════════════════════════════════════════════════════════════════
 * On iOS the PWA can run stale cached JS, so Leo may be testing an OLD voice bundle.
 * This compares the client's bundled version to the server's `/api/health`
 * buildVersion and decides whether a fresh reload is warranted. Pure + testable;
 * the caller wires it to the SW update / reload.
 */

export interface StaleBuildResult {
  stale: boolean
  clientVersion: string
  serverVersion: string
  reason: 'match' | 'mismatch' | 'unknown'
}

export function detectStaleBuild(clientVersion: string | undefined, serverVersion: string | undefined): StaleBuildResult {
  const c = (clientVersion ?? '').trim()
  const s = (serverVersion ?? '').trim()
  if (!c || !s) return { stale: false, clientVersion: c, serverVersion: s, reason: 'unknown' }
  const stale = c !== s
  return { stale, clientVersion: c, serverVersion: s, reason: stale ? 'mismatch' : 'match' }
}

/** Fetch the server build version from /api/health (null on any failure). */
export async function fetchServerVersion(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchImpl('/api/health', { cache: 'no-store' })
    if (!res.ok) return null
    const body = await res.json() as { buildVersion?: string }
    return body.buildVersion ?? null
  } catch { return null }
}
