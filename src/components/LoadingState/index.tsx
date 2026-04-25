import { GOLD } from '../../design/colors'
import { FONT_BODY } from '../../design/typography'

interface LoadingStateProps {
  message?: string
  color?: string
}

export function LoadingState({ message = 'רגע...', color = GOLD }: LoadingStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: '40px 20px',
      direction: 'rtl',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 12, height: 12, borderRadius: '50%',
            background: color, opacity: 0.6,
            animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <span style={{
        fontSize: 17, color: 'rgba(245,240,232,0.50)',
        fontFamily: FONT_BODY,
      }}>{message}</span>
    </div>
  )
}
