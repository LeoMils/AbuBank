// v27: ErrorCard — renders mediated errors as warm, actionable chat bubbles
// Never shows raw English. Always has at least one clear action button.

import type { MediatedError } from '../../services/errorMediation'
import { executeErrorAction } from '../../services/errorMediation'

interface ErrorCardProps {
  error: MediatedError
  onRetry?: () => void
  onHome?: () => void
  onDismiss?: () => void
}

const GOLD = '#C9A84C'
const BRIGHT_GOLD = '#D4A853'
const CREAM = '#F5F0E8'

export function ErrorCard({ error, onRetry, onHome, onDismiss }: ErrorCardProps) {
  const ctx = { onRetry, onHome, onDismiss }

  return (
    <div
      role="alert"
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '18px 20px',
        margin: '8px 0',
        background: 'linear-gradient(135deg, rgba(201,168,76,0.10) 0%, rgba(201,168,76,0.04) 100%)',
        border: '1px solid rgba(201,168,76,0.28)',
        borderRadius: 16,
        fontFamily: "'Heebo',sans-serif",
        boxShadow: '0 4px 20px rgba(201,168,76,0.10), inset 0 1px 0 rgba(255,250,240,0.04)',
        animation: 'fadeSlideUp 0.35s ease both',
      }}
    >
      {/* Emoji + message row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{error.emoji}</span>
        <div style={{
          fontSize: 18,
          fontWeight: 500,
          color: CREAM,
          lineHeight: 1.5,
          flex: 1,
          paddingTop: 2,
        }}>
          {error.message}
        </div>
      </div>

      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => executeErrorAction(error.primaryAction, ctx)}
          style={{
            flex: error.secondaryLabel ? 2 : 1,
            padding: '14px 18px',
            minHeight: 56,
            borderRadius: 14,
            border: 'none',
            background: `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`,
            color: 'rgba(0,0,0,0.85)',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(201,168,76,0.35)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {error.primaryLabel}
        </button>

        {error.secondaryLabel && (
          <button
            type="button"
            onClick={() => executeErrorAction(error.secondaryAction!, ctx)}
            style={{
              flex: 1,
              padding: '14px 16px',
              minHeight: 56,
              borderRadius: 14,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(245,240,232,0.75)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {error.secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
