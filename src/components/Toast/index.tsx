import { useEffect, useState } from 'react'
import { GOLD_BORDER, TEXT_MEDIUM, TEXT_STRONG, SUCCESS } from '../../design/colors'

interface ToastProps {
  message: string
  visible: boolean
  onDismiss: () => void
  duration?: number
  undoLabel?: string
  onUndo?: () => void
  variant?: 'info' | 'success' | 'undo'
}

export function Toast({ message, visible, onDismiss, duration = 3000, undoLabel, onUndo, variant = 'info' }: ToastProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!visible) { setShow(false); return }
    setShow(true)
    const timer = setTimeout(() => {
      setShow(false)
      setTimeout(onDismiss, 200)
    }, duration)
    return () => clearTimeout(timer)
  }, [visible, duration, onDismiss])

  if (!visible && !show) return null

  const borderColor = variant === 'success' ? `rgba(52,211,153,0.35)` : GOLD_BORDER

  return (
    <div style={{
      position: 'fixed',
      bottom: 100,
      left: '50%',
      transform: `translateX(-50%) translateY(${show ? '0' : '16px'})`,
      opacity: show ? 1 : 0,
      transition: 'opacity 0.2s ease, transform 0.25s ease',
      zIndex: 9999,
      maxWidth: 340,
      width: 'calc(100% - 32px)',
      padding: '14px 18px',
      borderRadius: 14,
      background: 'rgba(255,250,240,0.08)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${borderColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      direction: 'rtl' as const,
      pointerEvents: 'auto' as const,
    }}>
      <span style={{
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "'Heebo', sans-serif",
        color: variant === 'success' ? SUCCESS : TEXT_STRONG,
        flex: 1,
      }}>{message}</span>
      {variant === 'undo' && onUndo && (
        <button
          type="button"
          onClick={() => { onUndo(); onDismiss() }}
          style={{
            padding: '6px 14px',
            borderRadius: 10,
            border: `1px solid ${GOLD_BORDER}`,
            background: 'rgba(201,168,76,0.10)',
            color: TEXT_MEDIUM,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Heebo', sans-serif",
            cursor: 'pointer',
            flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >{undoLabel ?? 'ביטול'}</button>
      )}
    </div>
  )
}
