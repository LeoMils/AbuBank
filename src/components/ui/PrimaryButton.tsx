/*
 * PrimaryButton — the shared senior-first button for the Abu-ela system.
 * ════════════════════════════════════════════════════════════════════════════
 * ≥56px target, large high-contrast type, soft radius, per-app accent. One button
 * so every app's primary action looks and feels the same.
 */
import { useState, type ReactNode } from 'react'
import { GOLD, TEXT_STRONG } from '../../design/colors'
import { FONT_BODY } from '../../design/typography'
import { radius, space, MIN_TOUCH } from '../../design/space'

function accentRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}

export function PrimaryButton({ children, onClick, accent = GOLD, disabled = false, ariaLabel }: {
  children: ReactNode
  onClick?: () => void
  accent?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const [pressed, setPressed] = useState(false)
  const rgb = accentRgb(accent)
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{
        minHeight: MIN_TOUCH, padding: `${space.md}px ${space.xl}px`, borderRadius: radius.md,
        border: `1px solid rgba(${rgb},0.45)`,
        background: `linear-gradient(150deg, rgba(${rgb},${pressed ? 0.28 : 0.16}) 0%, rgba(${rgb},0.06) 100%)`,
        color: TEXT_STRONG, fontFamily: FONT_BODY, fontSize: 19, fontWeight: 800, letterSpacing: '0.2px',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        transform: pressed ? 'scale(0.98)' : 'scale(1)', transition: 'transform 0.1s ease, background 0.12s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  )
}
