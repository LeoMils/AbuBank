import { useState } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { GOLD_BORDER, GOLD_BORDER_HOVER, TEXT_MEDIUM } from '../../design/colors'

interface BackButtonProps {
  onPress?: () => void
}

export function BackButton({ onPress }: BackButtonProps) {
  const setScreen = useAppStore(s => s.setScreen)
  const [pressed, setPressed] = useState(false)

  const handleClick = () => {
    if (onPress) {
      onPress()
    } else {
      setScreen(Screen.Home)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      aria-label="חזרה למסך הבית"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        minHeight: 48,
        minWidth: 52,
        borderRadius: 22,
        background: 'rgba(255,250,240,0.04)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${pressed ? GOLD_BORDER_HOVER : GOLD_BORDER}`,
        color: TEXT_MEDIUM,
        cursor: 'pointer',
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.1s ease, border-color 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      } as React.CSSProperties}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "'Heebo', sans-serif",
        lineHeight: 1,
      }}>חזרה</span>
    </button>
  )
}
