import { useEffect, useRef, type ReactNode } from 'react'
import { BG, GOLD, CREAM } from './constants'

// Bottom-sheet day-detail. Owns its own scroll so the event list can never be
// covered by primary chrome (structural fix for PP-1), and hosts the ADD/mic
// controls so the primary view carries no permanent footprint (PP-2).
// Minimum safe accessibility: role=dialog, Escape to close, scrim/close-button
// close, focus moved into the sheet on open and restored on close. (Full Tab
// focus-trap and swipe-down-to-close are documented follow-ups, not built here.)
export function DayDetailSheet({ open, title, onClose, footer, children }: {
  open: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    prevFocus.current = (document.activeElement as HTMLElement | null)
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      prevFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        className="dds-scrim"
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(5,10,24,0.6)', zIndex: 150 }}
      />
      <div
        className="dds-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir="rtl"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 151,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          background: BG,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid rgba(201,168,76,0.25)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ flexShrink: 0, padding: '10px 16px 8px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(245,240,232,0.25)', margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: GOLD, fontFamily: "'Heebo',sans-serif" }}>{title}</span>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                color: CREAM, fontSize: 22, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 8px' } as React.CSSProperties}>
          {children}
        </div>

        {footer && (
          <div style={{
            flexShrink: 0, padding: '10px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            {footer}
          </div>
        )}
      </div>

      <style>{`
        .dds-scrim { animation: ddsScrimIn 0.18s ease both; }
        .dds-panel { animation: ddsSlideUp 0.22s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes ddsScrimIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ddsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .dds-scrim, .dds-panel { animation: none !important; }
        }
      `}</style>
    </>
  )
}
