/*
 * DiagnosticOverlay — full-screen wrapper around DiagnosticPanel.
 *
 * Renders as a fixed dark overlay so the diagnostic surface is
 * impossible to miss from any entry point (Settings top button,
 * Home pill, or ?diagnostics=1 URL).
 *
 * The panel inside renders title/version/buttons immediately and
 * never depends on /api/health resolving.
 */

import { DiagnosticPanel } from './DiagnosticPanel'

interface DiagnosticOverlayProps {
  onClose: () => void
}

export function DiagnosticOverlay({ onClose }: DiagnosticOverlayProps) {
  return (
    <div
      data-testid="diagnostic-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0,0,0,0.86)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
      } as React.CSSProperties}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          background: 'linear-gradient(160deg, rgba(14,18,28,0.99) 0%, rgba(8,12,20,0.99) 100%)',
          border: '1px solid rgba(201,168,76,0.32)',
          borderRadius: 22,
          padding: 'calc(20px + env(safe-area-inset-top, 0px)) 18px calc(20px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          fontFamily: "'Heebo','DM Sans',sans-serif",
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>אבחון מערכת</span>
          <button
            type="button"
            data-testid="diag-overlay-close"
            onClick={onClose}
            aria-label="סגירה"
            style={{
              minWidth: 44, minHeight: 44,
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: 'white', fontSize: 18, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Heebo','DM Sans',sans-serif",
            }}
          >✕</button>
        </div>
        <DiagnosticPanel />
      </div>
    </div>
  )
}
