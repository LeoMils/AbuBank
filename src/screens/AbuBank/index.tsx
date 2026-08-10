/*
 * AbuBank — the services app, now living INSIDE the hub (no longer the front door).
 * ════════════════════════════════════════════════════════════════════════════
 * This is the former Home services grid moved verbatim into its own app: the same
 * nine Kfar-Saba services (מזרחי, דואר, MAX, מים, חשמל, ארנונה, HOT, פרטנר, yes),
 * the same water-drop orbs, the same same-tab external navigation. The ONLY change
 * is framing: an always-visible BackButton returns to the Abu-ela hub, and a title
 * says where she is. Data + icons are reused from Home (single source), not copied.
 */
import { useState, useEffect } from 'react'
import { SERVICES, type Service } from '../Home/data'
import { ICONS } from '../Home/icons'
import { BackButton } from '../../components/BackButton'
import { injectSharedKeyframes } from '../../design/animations'
import { GOLD, TEXT_STRONG } from '../../design/colors'

// Module-level navigation guard (same pattern as the old Home).
let isNavigating = false
let navTimer: ReturnType<typeof setTimeout> | null = null
function handleTap(url: string): void {
  if (isNavigating) return
  isNavigating = true
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(() => { isNavigating = false }, 800)
  window.location.href = url
}

const DARK_BG = ['#1a1a2e', '#0a4a45']
const isDarkService = (svc: Service): boolean => DARK_BG.includes(svc.bgColor.toLowerCase())

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}

function ServiceLogo({ svc }: { svc: Service }) {
  const [imgFailed, setImgFailed] = useState(false)
  if (imgFailed || !svc.logo) {
    const iconFn = ICONS[svc.id]
    return iconFn ? (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '70%', height: '70%', opacity: 0.95, position: 'relative', zIndex: 1 }}>
        {iconFn(svc.color)}
      </div>
    ) : null
  }
  return (
    <img
      src={svc.logo} alt={svc.label} loading="eager" decoding="async"
      style={{ width: '84%', height: '84%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
      onError={() => setImgFailed(true)}
    />
  )
}

const ORB_GRADIENT: Record<string, string> = {
  mizrahi: 'radial-gradient(circle at 38% 32%, rgba(255,220,180,0.95) 0%, #f97316 42%, #92380a 72%, #1e0800 100%)',
  postal:  'radial-gradient(circle at 38% 32%, rgba(180,210,255,0.95) 0%, #3b82f6 42%, #1240a0 72%, #040f2a 100%)',
  max:     'radial-gradient(circle at 38% 32%, rgba(220,180,255,0.95) 0%, #a855f7 42%, #5b1fa8 72%, #110520 100%)',
  water:   'radial-gradient(circle at 38% 32%, rgba(180,248,255,0.95) 0%, #06b6d4 42%, #036b7e 72%, #001519 100%)',
  iec:     'radial-gradient(circle at 38% 32%, rgba(255,248,160,0.95) 0%, #eab308 42%, #8a6200 72%, #1a1000 100%)',
  arnona:  'radial-gradient(circle at 38% 32%, rgba(180,255,200,0.95) 0%, #22c55e 42%, #0d6b30 72%, #011508 100%)',
  hot:     'radial-gradient(circle at 38% 32%, rgba(255,180,180,0.95) 0%, #ef4444 42%, #8a0f0f 72%, #1a0000 100%)',
  partner: 'radial-gradient(circle at 38% 32%, rgba(210,185,255,0.95) 0%, #8b5cf6 42%, #4a1fa0 72%, #0c0420 100%)',
  yes:     'radial-gradient(circle at 38% 32%, rgba(175,225,255,0.95) 0%, #0ea5e9 42%, #065d88 72%, #010e1a 100%)',
}

export function AbuBank() {
  const [pressed, setPressed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    injectSharedKeyframes()
    const t = setTimeout(() => setLoaded(true), 60)
    const onVisibility = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  return (
    <div dir="rtl" style={{
      height: '100%', width: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #070D1E 0%, #050A18 40%, #050A18 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Heebo','DM Sans',sans-serif", userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      {/* Header: always-visible way back to the hub + title */}
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 8px' }}>
        <BackButton />
        <h1 style={{
          margin: 0, fontSize: 24, fontWeight: 800, color: TEXT_STRONG, letterSpacing: '0.3px',
          display: 'flex', alignItems: 'baseline', gap: 7,
        }}>
          <span style={{ color: GOLD, fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic', fontSize: 27 }}>Abu</span>
          <span>Bank</span>
        </h1>
      </header>

      {/* The nine services — unchanged 3×3 grid of water-drop orbs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '4px 16px 12px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)',
          height: '100%', width: '100%', alignItems: 'center', justifyItems: 'center',
        }}>
          {SERVICES.map((svc, i) => {
            const rgb = hexToRgb(svc.color)
            void isDarkService(svc)
            return (
              <div
                key={svc.id} role="button" aria-label={`פתח ${svc.label}`} tabIndex={0}
                onClick={() => handleTap(svc.url)}
                onPointerDown={() => setPressed(svc.id)}
                onPointerUp={() => setPressed(null)}
                onPointerLeave={() => setPressed(null)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(svc.url) } }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer', width: '100%',
                  opacity: loaded ? 1 : 0, transform: loaded ? 'scale(1)' : 'scale(0.75)',
                  transition: `opacity 0.35s ease-out ${0.05 + i * 0.04}s, transform 0.3s ease-out ${0.05 + i * 0.04}s`,
                }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', position: 'relative', overflow: 'hidden',
                  background: ORB_GRADIENT[svc.id] ?? `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.90) 0%, ${svc.color} 42%, #111 100%)`,
                  boxShadow: pressed === svc.id
                    ? '0 0 18px rgba(201,168,76,0.35), 0 2px 8px rgba(0,0,0,0.5)'
                    : `0 0 22px rgba(${rgb},0.62), 0 20px 40px rgba(0,0,0,0.50), inset 0 2px 10px rgba(255,255,255,0.10)`,
                  transform: pressed === svc.id ? 'scale(0.93)' : 'scale(1)',
                  transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
                }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 1 }}>
                    <ServiceLogo svc={svc} />
                  </div>
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse at 28% 22%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.35) 22%, transparent 55%)', zIndex: 2, pointerEvents: 'none' }} />
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 -14px 28px rgba(0,0,0,0.55), inset 0 6px 12px rgba(255,255,255,0.12)', pointerEvents: 'none', zIndex: 5 }} />
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', pointerEvents: 'none', zIndex: 6 }} />
                </div>
                <span style={{
                  fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontFamily: "'Heebo',sans-serif",
                  textAlign: 'center', lineHeight: 1.25, direction: 'rtl', maxWidth: 110, wordBreak: 'break-word',
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                }}>{svc.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
