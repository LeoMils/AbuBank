// InfoButton — ℹ button + modal for every screen
// Shows page description, how-to, with listen button
import { useState } from 'react'
import { speak, stopSpeaking } from '../services/voice'
import { soundTap } from '../services/sounds'

interface InfoButtonProps {
  title: string        // page title shown in modal header
  lines: string[]      // description lines (shown as a list)
  howTo: string[]      // "how to use" steps
  position?: 'top-left' | 'top-right' | 'bottom-right'
}

export function InfoButton({ title, lines, howTo, position = 'top-right' }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  const [isReading, setIsReading] = useState(false)

  const fullText = `${title}. ${lines.join(' ')} איך להשתמש: ${howTo.join(' ')}`

  const handleListen = async () => {
    if (isReading) { stopSpeaking(); setIsReading(false); return }
    setIsReading(true)
    try { await speak(fullText) } finally { setIsReading(false) }
  }

  const posStyle: React.CSSProperties = position === 'top-right'
    ? { position: 'absolute', top: 14, right: 14, zIndex: 30 }
    : position === 'top-left'
    ? { position: 'absolute', top: 14, left: 14, zIndex: 30 }
    : { position: 'absolute', bottom: 80, right: 14, zIndex: 30 }

  return (
    <>
      {/* ℹ Button */}
      <button
        type="button"
        onClick={() => { soundTap(); setOpen(true) }}
        style={{
          ...posStyle,
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(201,168,76,0.10)',
          border: '1.5px solid rgba(201,168,76,0.40)',
          color: 'rgba(201,168,76,0.85)',
          fontSize: 16, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
          fontFamily: "'DM Sans',sans-serif",
          transition: 'background 0.2s ease',
        }}
        aria-label={`מידע על ${title}`}
      >ℹ</button>

      {/* Modal */}
      {open && (
        <div
          onClick={() => { stopSpeaking(); setIsReading(false); setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 20px',
          }}
        >
          <div
            dir="rtl"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 380,
              background: 'linear-gradient(180deg, #141008 0%, #0C0A08 100%)',
              border: '1px solid rgba(201,168,76,0.28)',
              borderRadius: 20,
              padding: '24px 22px 20px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,250,240,0.06)',
              fontFamily: "'Heebo','DM Sans',sans-serif",
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{
                margin: 0, fontSize: 22, fontWeight: 700,
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                background: `linear-gradient(135deg, #FFF0C0 0%, #D4A853 50%, #C9A84C 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>{title}</h2>
              <button onClick={() => { stopSpeaking(); setIsReading(false); setOpen(false) }}
                style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.50)', fontSize: 22, cursor: 'pointer', padding: 4 }}>×</button>
            </div>

            {/* Description lines */}
            <div style={{ marginBottom: 16 }}>
              {lines.map((line, i) => (
                <p key={i} style={{ margin: '0 0 8px', fontSize: 16, color: '#F5F0E8', lineHeight: 1.7 }}>{line}</p>
              ))}
            </div>

            {/* How to use */}
            <div style={{
              background: 'rgba(201,168,76,0.06)',
              border: '1px solid rgba(201,168,76,0.18)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 18,
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(201,168,76,0.70)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>איך להשתמש</p>
              {howTo.map((step, i) => (
                <p key={i} style={{ margin: '0 0 6px', fontSize: 15, color: 'rgba(245,240,232,0.80)', lineHeight: 1.6 }}>{'· ' + step}</p>
              ))}
            </div>

            {/* Listen button */}
            <button
              type="button"
              onClick={handleListen}
              style={{
                width: '100%', height: 50, borderRadius: 14,
                background: isReading ? 'rgba(201,168,76,0.18)' : 'rgba(201,168,76,0.10)',
                border: `1.5px solid rgba(201,168,76,${isReading ? '0.60' : '0.35'})`,
                color: isReading ? '#D4A853' : 'rgba(245,240,232,0.85)',
                fontSize: 16, fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {isReading ? '⏹ עוצרת...' : '🔊 האזיני להסבר'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
