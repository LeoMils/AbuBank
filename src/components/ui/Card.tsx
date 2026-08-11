/*
 * Card — the shared glass surface for the Abu-ela system.
 * ════════════════════════════════════════════════════════════════════════════
 * One warm glass card, optionally pressable, with a per-app accent. Generous
 * padding and a soft radius (never sharp/clinical). When `onClick` is given it
 * renders as a real button with a ≥56px target and press feedback.
 */
import { useState, type ReactNode, type CSSProperties } from 'react'
import { GOLD_BORDER, SURFACE, SURFACE_HOVER } from '../../design/colors'
import { radius, space, MIN_TOUCH } from '../../design/space'

function accentRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}

export function Card({ children, onClick, ariaLabel, accent, style }: {
  children: ReactNode
  onClick?: () => void
  ariaLabel?: string
  accent?: string
  style?: CSSProperties
}) {
  const [pressed, setPressed] = useState(false)
  const rgb = accent ? accentRgb(accent) : null
  const base: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: space.sm,
    padding: `${space.lg}px ${space.lg}px`, borderRadius: radius.lg,
    background: pressed ? SURFACE_HOVER : (rgb ? `linear-gradient(150deg, rgba(${rgb},0.10) 0%, ${SURFACE} 60%)` : SURFACE),
    border: `1px solid ${rgb ? `rgba(${rgb},${pressed ? 0.5 : 0.28})` : GOLD_BORDER}`,
    ...style,
  }
  if (!onClick) return <div style={base}>{children}</div>
  return (
    <button
      type="button" onClick={onClick} aria-label={ariaLabel}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{
        ...base, width: '100%', minHeight: MIN_TOUCH, textAlign: 'right', cursor: 'pointer',
        transition: 'background 0.12s ease, border-color 0.12s ease', WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  )
}
