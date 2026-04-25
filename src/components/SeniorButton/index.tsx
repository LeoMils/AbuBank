import { useRef, useCallback } from 'react'
import { GOLD, CREAM } from '../../design/colors'
import { GRADIENT_GOLD_BUTTON } from '../../design/gradients'
import { FONT_BODY } from '../../design/typography'
import { PRESS_SCALE, PRESS_DURATION } from '../../design/animation'

type Variant = 'primary' | 'secondary' | 'ghost'

interface SeniorButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: Variant
  disabled?: boolean
  fullWidth?: boolean
  debounceMs?: number
  ariaLabel?: string
}

export function SeniorButton({
  children, onClick, variant = 'primary', disabled = false,
  fullWidth = false, debounceMs = 400, ariaLabel,
}: SeniorButtonProps) {
  const lastClick = useRef(0)

  const handleClick = useCallback(() => {
    if (disabled || !onClick) return
    const now = Date.now()
    if (now - lastClick.current < debounceMs) return
    lastClick.current = now
    onClick()
  }, [disabled, onClick, debounceMs])

  const styles: Record<Variant, React.CSSProperties> = {
    primary: {
      background: GRADIENT_GOLD_BUTTON,
      color: 'rgba(0,0,0,0.85)',
      border: 'none',
      boxShadow: '0 4px 16px rgba(201,168,76,0.35)',
    },
    secondary: {
      background: 'rgba(255,250,240,0.06)',
      color: CREAM,
      border: `1px solid rgba(201,168,76,0.25)`,
      boxShadow: 'none',
    },
    ghost: {
      background: 'transparent',
      color: GOLD,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'none',
    },
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        ...styles[variant],
        minHeight: 56,
        padding: '14px 24px',
        borderRadius: 16,
        fontSize: 17,
        fontWeight: 700,
        fontFamily: FONT_BODY,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        width: fullWidth ? '100%' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: `opacity 0.15s, transform ${PRESS_DURATION}`,
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={e => { if (!disabled) e.currentTarget.style.transform = PRESS_SCALE }}
      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {children}
    </button>
  )
}
