import { TEXT_MUTED } from '../../design/colors'
import { FONT_BODY } from '../../design/typography'

interface EmptyStateProps {
  icon?: string
  message: string
  detail?: string
}

export function EmptyState({ icon = '📭', message, detail }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: '40px 20px',
      direction: 'rtl',
    }}>
      <span style={{ fontSize: 40 }}>{icon}</span>
      <span style={{
        fontSize: 18, fontWeight: 600, color: TEXT_MUTED,
        fontFamily: FONT_BODY, textAlign: 'center',
      }}>{message}</span>
      {detail && (
        <span style={{
          fontSize: 15, color: 'rgba(245,240,232,0.35)',
          fontFamily: FONT_BODY, textAlign: 'center', maxWidth: 280,
        }}>{detail}</span>
      )}
    </div>
  )
}
