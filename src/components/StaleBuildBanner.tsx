/*
 * Stale-build banner — the staleness guard finally surfaced to the user.
 * ═════════════════════════════════════════════════════════════════════
 * Leo ran a whole verification round on a 49-versions-stale cached build with no
 * warning. The detection mechanism (services/versionSync) existed but was wired
 * NOWHERE. This mounts it: on load it fetches /api/health and, if the served build
 * differs from this bundle's baked APP_VERSION, shows a calm, senior-first banner that
 * reloads to the fresh build. Complementary to useSWUpdate (which only fires on a real
 * service-worker controllerchange — it cannot catch a SW stuck on a stale cache).
 */
import { useEffect, useState } from 'react'
import { APP_VERSION } from '../version'
import { detectStaleBuild, fetchServerVersion, type StaleBuildResult } from '../services/versionSync'

export interface StaleBuildBannerProps {
  /** Test seam: skip the network fetch and render from this result. */
  initialResult?: StaleBuildResult
  fetchImpl?: typeof fetch
}

export function StaleBuildBanner({ initialResult, fetchImpl }: StaleBuildBannerProps) {
  const [result, setResult] = useState<StaleBuildResult | null>(initialResult ?? null)

  useEffect(() => {
    if (initialResult) return
    let alive = true
    void fetchServerVersion(fetchImpl).then((server) => {
      if (!alive || !server) return
      setResult(detectStaleBuild(APP_VERSION.version, server))
    })
    return () => { alive = false }
  }, [initialResult, fetchImpl])

  if (!result || !result.stale) return null

  return (
    <div
      data-testid="stale-build-banner"
      role="alert"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: 'linear-gradient(135deg, #C9A84C, #b5923a)', color: '#1a1400',
        fontFamily: "'Heebo',sans-serif", direction: 'rtl', boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>יש גרסה חדשה של האפליקציה</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>את משתמשת בגרסה ישנה. לחצי לרענון.</div>
      </div>
      <button
        type="button"
        data-testid="stale-build-refresh"
        onClick={() => {
          try {
            // Best-effort: drop caches + waiting SW so the reload lands on the fresh build.
            if ('caches' in window) void caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)))
            void navigator.serviceWorker?.getRegistration().then((r) => r?.waiting?.postMessage({ type: 'SKIP_WAITING' }))
          } catch { /* reload regardless */ }
          window.location.reload()
        }}
        style={{
          flexShrink: 0, minHeight: 44, padding: '10px 18px', borderRadius: 12,
          background: '#1a1400', color: '#F5E6B8', border: 'none', fontSize: 15,
          fontWeight: 700, fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
        }}
      >
        רענון
      </button>
    </div>
  )
}
