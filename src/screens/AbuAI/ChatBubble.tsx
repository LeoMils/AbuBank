import React from 'react'
import type { ChatMessage } from './types'
import type { MediatedError } from '../../services/errorMediation'
import { ErrorCard } from '../../components/ErrorCard'
import { SURFACE, TEXT } from './constants'

interface ChatBubbleProps {
  msg: ChatMessage & { error?: MediatedError }
  isLast: boolean
  onRetry: () => void
  onHome: () => void
  onDismiss: () => void
}

export function ChatBubble({ msg, isLast, onRetry, onHome, onDismiss }: ChatBubbleProps) {
  const isUser = msg.role === 'user'
  const ts = new Date(msg.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

  if (msg.error) {
    return (
      <div style={{ marginBottom: 16, animation: isLast ? 'msgIn 0.3s ease both' : 'none' }}>
        <ErrorCard
          error={msg.error}
          onRetry={onRetry}
          onHome={onHome}
          onDismiss={onDismiss}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-start' : 'flex-end',
        marginBottom: 16,
        animation: isLast ? 'msgIn 0.3s ease both' : 'none',
      }}
    >
      <div style={{
        fontSize: 12,
        fontFamily: "'DM Sans',sans-serif",
        fontWeight: 600,
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: isUser ? 'rgba(245,240,232,0.42)' : 'rgba(20,184,166,0.55)',
        marginBottom: 5,
        direction: 'ltr',
        paddingInline: 4,
      }}>
        {isUser ? 'את' : 'אבו AI'}
      </div>

      <div style={{
        maxWidth: '82%',
        ...(isUser ? {
          padding: '14px 18px',
          borderRadius: '18px 4px 18px 18px',
          background: 'rgba(20,184,166,0.13)',
          border: '1px solid rgba(20,184,166,0.35)',
        } : {
          padding: '14px 18px',
          borderRadius: '4px 18px 18px 18px',
          background: SURFACE,
          border: '1px solid rgba(20,184,166,0.20)',
          borderRight: '3px solid rgba(20,184,166,0.50)',
        }),
      }}>
        <div style={{
          fontSize: 16,
          lineHeight: isUser ? 1.85 : 1.9,
          color: TEXT,
          direction: 'rtl',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: "'Heebo',sans-serif",
          animation: 'msgIn 0.3s ease',
        }}>
          {msg.content}
        </div>
      </div>

      <div style={{
        fontSize: 12,
        color: 'rgba(245,240,232,0.30)',
        marginTop: 5,
        textAlign: isUser ? 'right' : 'left',
        fontFamily: "'DM Sans',sans-serif",
        direction: 'ltr',
        paddingInline: 4,
      }}>
        {ts}
      </div>
    </div>
  )
}
