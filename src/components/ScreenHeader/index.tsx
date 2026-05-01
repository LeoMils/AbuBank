import type { ReactNode } from 'react'
import { GOLD_BORDER } from '../../design/colors'

interface ScreenHeaderProps {
  title?: string
  left?: ReactNode
  right?: ReactNode
  glowColor?: string
}

export function ScreenHeader({ title, left, right, glowColor = 'rgba(201,168,76,0.35)' }: ScreenHeaderProps) {
  return (
    <header style={{
      height: 76,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 18px',
      background: 'rgba(10,8,6,0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${GOLD_BORDER}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      position: 'relative',
      zIndex: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {left}
      </div>

      {title && (
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 19, fontWeight: 700, letterSpacing: '1.2px',
            background: 'linear-gradient(135deg, #e8d5a0 0%, #D4A853 35%, #f0e0a0 60%, #C9A84C 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          } as React.CSSProperties}>{title}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {right}
      </div>

      <div aria-hidden="true" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${glowColor} 30%, ${glowColor} 70%, transparent)`,
        pointerEvents: 'none',
      }} />
    </header>
  )
}
