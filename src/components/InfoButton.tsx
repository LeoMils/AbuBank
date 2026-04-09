// InfoButton — ℹ icon + full-screen modal with close button
// Teal/green theme matching AbuWhatsApp. Visible enough for 80+ user, prominent close.
import { useState, useEffect } from 'react'
import { speak, stopSpeaking } from '../services/voice'
import { soundTap } from '../services/sounds'

// Inject pulse animation once
const INFO_PULSE_ID = 'abu-info-pulse-anim'
function injectInfoPulse() {
  if (document.getElementById(INFO_PULSE_ID)) return
  const style = document.createElement('style')
  style.id = INFO_PULSE_ID
  style.textContent = `
    @keyframes infoButtonPulse {
      0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
      50% { box-shadow: 0 0 0 6px rgba(20,184,166,0.15), 0 2px 8px rgba(0,0,0,0.25); }
    }
  `
  document.head.appendChild(style)
}

interface InfoButtonProps {
  title: string
  lines: string[]
  howTo: string[]
  position?: 'top-left' | 'top-right' | 'bottom-right'
}

const TEAL = '#14b8a6'

export function InfoButton({ title, lines, howTo, position = 'top-right' }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  const [isReading, setIsReading] = useState(false)

  const fullText = `${title}. ${lines.join(' ')} איך להשתמש: ${howTo.join(' ')}`

  const handleListen = async () => {
    if (isReading) { stopSpeaking(); setIsReading(false); return }
    setIsReading(true)
    try { await speak(fullText) } finally { setIsReading(false) }
  }

  const closeModal = () => { stopSpeaking(); setIsReading(false); setOpen(false) }

  // Inject pulse keyframe on mount
  useEffect(() => { injectInfoPulse() }, [])

  // Position: bottom-right by default to avoid covering Martita photo
  const posStyle: React.CSSProperties = position === 'top-right'
    ? { position: 'absolute', top: 14, right: 14, zIndex: 30 }
    : position === 'top-left'
    ? { position: 'absolute', top: 14, left: 14, zIndex: 30 }
    : { position: 'absolute', bottom: 80, right: 14, zIndex: 30 }

  return (
    <>
      {/* ℹ Button — visible for 80+ user, with discovery pulse */}
      <button
        type="button"
        onClick={() => { soundTap(); setOpen(true) }}
        style={{
          ...posStyle,
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.55)',
          fontSize: 16, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          fontFamily: "'DM Sans',sans-serif",
          transition: 'opacity 0.2s ease, box-shadow 0.3s ease',
          WebkitTapHighlightColor: 'transparent',
          animation: 'infoButtonPulse 2.5s ease-in-out 1.5s 3',
        }}
        aria-label={`מידע על ${title}`}
      >ℹ</button>

      {/* Modal */}
      {open && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.80)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 20px',
          }}
        >
          <div
            dir="rtl"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360,
              background: 'linear-gradient(180deg, rgba(8,18,28,0.98) 0%, rgba(5,10,24,0.99) 100%)',
              border: `1px solid rgba(20,184,166,0.25)`,
              borderRadius: 22,
              padding: '22px 20px 18px',
              boxShadow: `0 24px 64px rgba(0,0,0,0.60), 0 0 40px rgba(20,184,166,0.08)`,
              fontFamily: "'Heebo','DM Sans',sans-serif",
              position: 'relative',
            }}
          >
            {/* BIG close button — unmissable */}
            <button
              onClick={closeModal}
              style={{
                position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: `linear-gradient(135deg, ${TEAL}, #0D9488)`,
                border: '2px solid rgba(5,10,24,0.90)',
                color: '#fff',
                fontSize: 22, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: `0 4px 16px rgba(20,184,166,0.35), 0 2px 6px rgba(0,0,0,0.40)`,
                WebkitTapHighlightColor: 'transparent',
                zIndex: 1,
              }}
              aria-label="סגור"
            >✕</button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, marginTop: 12 }}>
              <h2 style={{
                margin: 0, fontSize: 21, fontWeight: 700,
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                background: `linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 40%, #14B8A6 70%, #0D9488 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                filter: 'drop-shadow(0 0 8px rgba(20,184,166,0.30))',
              } as React.CSSProperties}>{title}</h2>
            </div>

            {/* Description lines */}
            <div style={{ marginBottom: 14 }}>
              {lines.map((line, i) => (
                <p key={i} style={{ margin: '0 0 8px', fontSize: 16, color: 'rgba(240,253,244,0.90)', lineHeight: 1.7 }}>{line}</p>
              ))}
            </div>

            {/* How to use */}
            <div style={{
              background: 'rgba(20,184,166,0.06)',
              border: `1px solid rgba(20,184,166,0.18)`,
              borderRadius: 12, padding: '12px 14px', marginBottom: 16,
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: `rgba(20,184,166,0.70)`, fontWeight: 700, letterSpacing: '1px' }}>איך להשתמש</p>
              {howTo.map((step, i) => (
                <p key={i} style={{ margin: '0 0 6px', fontSize: 15, color: 'rgba(240,253,244,0.80)', lineHeight: 1.6 }}>{'· ' + step}</p>
              ))}
            </div>

            {/* Listen button */}
            <button
              type="button"
              onClick={handleListen}
              style={{
                width: '100%', height: 48, borderRadius: 14,
                background: isReading ? 'rgba(20,184,166,0.20)' : 'rgba(20,184,166,0.10)',
                border: `1.5px solid rgba(20,184,166,${isReading ? '0.60' : '0.30'})`,
                color: isReading ? '#2DD4BF' : 'rgba(240,253,244,0.85)',
                fontSize: 16, fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {isReading ? '⏹ עוצרת...' : '🔊 האזיני להסבר'}
            </button>

            {/* Bottom close text — extra escape route */}
            <button
              onClick={closeModal}
              style={{
                display: 'block', width: '100%', marginTop: 12,
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.40)', fontSize: 15, fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer', textAlign: 'center',
                padding: '8px 0',
                WebkitTapHighlightColor: 'transparent',
              }}
            >סגור ✕</button>
          </div>
        </div>
      )}
    </>
  )
}
