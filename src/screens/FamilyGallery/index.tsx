import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { BackButton } from '../../components/BackButton'
import { FAMILY_GALLERY_ITEMS, handleFamilyImgError } from '../../services/familyPhotos'
import type { FamilyMediaItem } from '../../services/familyPhotos'

const GOLD = '#C9A84C'

// ── Keyframes (injected once) ──────────────────────────────────────
const KEYFRAME_ID = 'family-gallery-anim'
const KEYFRAMES = `
@keyframes fgHeaderSlide { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
@keyframes fgCardIn { from { opacity:0; transform:translateY(24px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes fgShimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@keyframes fgPanelUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
@keyframes fgFadeIn { from { opacity:0; } to { opacity:1; } }
@media(prefers-reduced-motion:reduce){
  @keyframes fgHeaderSlide { from{opacity:1;transform:none;} to{opacity:1;transform:none;} }
  @keyframes fgCardIn { from{opacity:1;transform:none;} to{opacity:1;transform:none;} }
  @keyframes fgShimmer { from{background-position:0 center;} to{background-position:0 center;} }
}
`

// ── Photo Card ─────────────────────────────────────────────────────
function PhotoCard({ item, index, onInfo }: { item: FamilyMediaItem; index: number; onInfo: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <div
      style={{
        position: 'relative',
        width: item.layout === 'full' ? '100%' : 'calc(50% - 6px)',
        aspectRatio: item.layout === 'full' ? '4/3' : '3/4',
        borderRadius: 18,
        overflow: 'hidden',
        background: loaded ? '#0a0a14' : item.dominantColor,
        border: '1px solid rgba(201,168,76,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,250,240,0.04)',
        animation: `fgCardIn 0.5s ease both`,
        animationDelay: `${0.15 + index * 0.08}s`,
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.2,0,0,1)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      <img
        src={item.src}
        alt={item.caption}
        loading={index === 0 ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={handleFamilyImgError}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 30%',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Bottom gradient overlay */}
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(transparent 0%, rgba(5,10,24,0.75) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Caption */}
      <div style={{
        position: 'absolute', bottom: 12, right: 14,
        color: 'rgba(255,250,240,0.90)',
        fontSize: item.layout === 'full' ? 17 : 14,
        fontWeight: 600,
        fontFamily: "'Heebo',sans-serif",
        textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        pointerEvents: 'none',
        maxWidth: '70%',
      }}>
        {item.caption}
      </div>

      {/* Info button — top-left corner, away from photo content */}
      <button
        type="button"
        aria-label="מידע על התמונה"
        onClick={(e) => { e.stopPropagation(); onInfo() }}
        style={{
          position: 'absolute', top: 8, left: 8,
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(0,0,0,0.50)',
          border: '1.5px solid rgba(201,168,76,0.50)',
          color: GOLD,
          fontSize: 14, fontWeight: 700,
          fontFamily: "'Cormorant Garamond',Georgia,serif",
          fontStyle: 'italic',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.15s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)' }}
        onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
      >
        i
      </button>
    </div>
  )
}

// ── Info Panel — fixed: stopPropagation, no backdrop-filter, mobile-safe ──
function InfoPanel({ item, onClose }: { item: FamilyMediaItem; onClose: () => void }) {
  const close = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100 }}
      onClick={close}
      onTouchEnd={close}
    >
      {/* Backdrop — no backdrop-filter (blocks touch on mobile Safari) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.70)',
          animation: 'fgFadeIn 0.2s ease both',
          pointerEvents: 'none',
        }}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="פרטי תמונה"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 101,
          maxHeight: '60vh',
          borderRadius: '20px 20px 0 0',
          background: 'linear-gradient(180deg, #141008 0%, #0C0A08 100%)',
          borderTop: '1px solid rgba(201,168,76,0.28)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
          padding: '16px 24px 28px',
          animation: 'fgPanelUp 0.3s ease-out both',
          overflowY: 'auto',
        }}
      >
        {/* Close X — top right */}
        <button
          type="button"
          aria-label="סגור"
          onClick={close}
          onTouchEnd={close}
          className="btn-focus"
          style={{
            position: 'absolute', top: 12, left: 14,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.10)',
            border: '1.5px solid rgba(255,255,255,0.20)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 22, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* Thumbnail */}
        <div style={{
          width: 100, height: 100, borderRadius: 16,
          overflow: 'hidden', margin: '6px auto 14px',
          border: '2px solid rgba(201,168,76,0.40)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <img
            src={item.src}
            alt={item.caption}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={handleFamilyImgError}
          />
        </div>

        {/* Caption */}
        <h2 style={{
          color: GOLD,
          fontSize: 20, fontWeight: 600,
          fontFamily: "'Heebo',sans-serif",
          textAlign: 'center',
          margin: '0 0 8px',
        }}>
          {item.caption}
        </h2>

        {/* Description */}
        <p style={{
          color: 'rgba(255,250,240,0.75)',
          fontSize: 16, lineHeight: 1.6,
          fontFamily: "'Heebo',sans-serif",
          textAlign: 'center',
          margin: '0 0 16px',
        }}>
          {item.description}
        </p>

        {/* Back to gallery button — prominent at bottom */}
        <button
          type="button"
          onClick={close}
          onTouchEnd={close}
          className="btn-focus"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            margin: '0 auto',
            padding: '12px 32px',
            borderRadius: 24,
            background: 'rgba(201,168,76,0.18)',
            border: '1.5px solid rgba(201,168,76,0.40)',
            color: GOLD,
            fontSize: 16, fontWeight: 600,
            fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          חזרה לאלבום
        </button>
      </div>
    </div>
  )
}

// ── Main Gallery Screen ────────────────────────────────────────────
export function FamilyGallery() {
  const setScreen = useAppStore(s => s.setScreen)
  const [infoIdx, setInfoIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Inject keyframes once
  useEffect(() => {
    if (document.getElementById(KEYFRAME_ID)) return
    const style = document.createElement('style')
    style.id = KEYFRAME_ID
    style.textContent = KEYFRAMES
    document.head.appendChild(style)
  }, [])

  const handleBack = useCallback(() => setScreen(Screen.Home), [setScreen])

  // Build rows: full items solo, half items paired
  const rows: (FamilyMediaItem | [FamilyMediaItem, FamilyMediaItem])[] = []
  let halfBuffer: FamilyMediaItem | null = null
  for (const item of FAMILY_GALLERY_ITEMS) {
    if (item.layout === 'full') {
      rows.push(item)
    } else {
      if (halfBuffer) {
        rows.push([halfBuffer, item])
        halfBuffer = null
      } else {
        halfBuffer = item
      }
    }
  }
  if (halfBuffer) rows.push(halfBuffer) // leftover half → solo

  let cardIndex = 0

  return (
    <div dir="rtl" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#050A18',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Ambient gold glow */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '120%', height: 200,
        background: 'radial-gradient(ellipse at center top, rgba(201,168,76,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', filter: 'blur(20px)',
        animation: 'fgFadeIn 1.5s ease both',
      }} />

      {/* ══ HEADER ══ */}
      <header style={{
        flexShrink: 0, position: 'relative',
        background: 'linear-gradient(180deg, rgba(5,10,24,1) 0%, rgba(5,10,24,0.95) 100%)',
        borderBottom: '1px solid rgba(201,168,76,0.10)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
        zIndex: 20,
        animation: 'fgHeaderSlide 0.4s ease both',
      }}>
        <div style={{
          height: 72,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px', position: 'relative',
        }}>
          {/* Title with gold shimmer */}
          <h1 style={{
            margin: 0,
            fontFamily: "'Heebo','DM Sans',sans-serif",
            fontSize: 24, fontWeight: 700, letterSpacing: '0.5px',
            background: 'linear-gradient(90deg, #C9A84C 0%, #E8D5A0 25%, #C9A84C 50%, #E8D5A0 75%, #C9A84C 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'fgShimmer 4s linear infinite',
          }}>
            אלבום המשפחה
          </h1>

          {/* Back button */}
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <BackButton />
          </div>
        </div>
      </header>

      {/* ══ SCROLLABLE GALLERY ══ */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 12px 40px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((row, rowIdx) => {
            if (Array.isArray(row)) {
              // Pair row
              const idx1 = cardIndex++
              const idx2 = cardIndex++
              return (
                <div key={rowIdx} style={{ display: 'flex', gap: 12, width: '100%' }}>
                  <PhotoCard item={row[0]} index={idx1} onInfo={() => setInfoIdx(idx1)} />
                  <PhotoCard item={row[1]} index={idx2} onInfo={() => setInfoIdx(idx2)} />
                </div>
              )
            } else {
              // Full row
              const idx = cardIndex++
              return (
                <PhotoCard key={rowIdx} item={row} index={idx} onInfo={() => setInfoIdx(idx)} />
              )
            }
          })}
        </div>
      </div>

      {/* ══ INFO PANEL ══ */}
      {infoIdx !== null && FAMILY_GALLERY_ITEMS[infoIdx] && (
        <InfoPanel
          item={FAMILY_GALLERY_ITEMS[infoIdx]!}
          onClose={() => setInfoIdx(null)}
        />
      )}
    </div>
  )
}
