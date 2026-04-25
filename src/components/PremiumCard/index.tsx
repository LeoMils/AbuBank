import type { ReactNode } from 'react'
import { GLASS_SURFACE } from '../../design/glass'
import { GOLD_BORDER } from '../../design/colors'

interface PremiumCardProps {
  children: ReactNode
  elevated?: boolean
  accentTop?: boolean
  onClick?: () => void
  ariaLabel?: string
}

export function PremiumCard({ children, elevated = false, accentTop = false, onClick, ariaLabel }: PremiumCardProps) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        ...GLASS_SURFACE,
        borderRadius: 20,
        padding: '18px 20px',
        direction: 'rtl' as const,
        width: '100%',
        textAlign: 'right' as const,
        cursor: onClick ? 'pointer' : 'default',
        borderTop: accentTop ? `3px solid ${GOLD_BORDER}` : undefined,
        boxShadow: elevated ? '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,250,240,0.04)' : GLASS_SURFACE.boxShadow,
        WebkitTapHighlightColor: 'transparent',
        ...(onClick ? { background: GLASS_SURFACE.background, border: GLASS_SURFACE.border } : {}),
      } as React.CSSProperties}
    >
      {children}
    </Component>
  )
}
