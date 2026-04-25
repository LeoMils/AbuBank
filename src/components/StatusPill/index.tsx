import { FONT_BODY } from '../../design/typography'

type PillVariant = 'gold' | 'teal' | 'red' | 'muted'

interface StatusPillProps {
  label: string
  variant?: PillVariant
  icon?: string
}

const PILL_COLORS: Record<PillVariant, { bg: string; border: string; text: string }> = {
  gold: { bg: 'rgba(201,168,76,0.12)', border: 'rgba(201,168,76,0.30)', text: '#C9A84C' },
  teal: { bg: 'rgba(20,184,166,0.10)', border: 'rgba(20,184,166,0.30)', text: '#14b8a6' },
  red: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)', text: '#EF4444' },
  muted: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', text: 'rgba(245,240,232,0.55)' },
}

export function StatusPill({ label, variant = 'gold', icon }: StatusPillProps) {
  const c = PILL_COLORS[variant]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 12px',
      borderRadius: 12,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      fontSize: 14,
      fontWeight: 600,
      fontFamily: FONT_BODY,
      whiteSpace: 'nowrap',
    }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {label}
    </span>
  )
}
