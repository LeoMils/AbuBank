/*
 * AbuCalendar P0.6 — visible voice trace card.
 *
 * Renders whenever there's something to say about the voice pipeline:
 *   • a stage message ("מקליטה..." / "מתמללת..." / "יוצרת...")
 *   • an explicit error ("תמלול קולי לא מוגדר באפליקציה.")
 *   • a transcribed phrase ("הבנתי: ...")
 *
 * The card is ALWAYS visible while the trace is active. No timer
 * auto-dismiss for errors — they stay until the user taps the close
 * button or records again. A "העתק אבחון קול" button copies the trace
 * JSON for operator paste-back.
 *
 * No secrets. No layout impact on Home (component is rendered only
 * inside AbuCalendar's voice action area).
 */

import type { VoiceTrace } from './voiceTrace'
import { serializeTrace } from './voiceTrace'

interface VoiceTraceCardProps {
  trace: VoiceTrace
  onDismiss: () => void
  onCopied: () => void
  copied: boolean
}

export function VoiceTraceCard({ trace, onDismiss, onCopied, copied }: VoiceTraceCardProps) {
  const isError = trace.finalVoiceStage === 'error' && (trace.error || trace.visibleMessage)
  const isIdle = trace.finalVoiceStage === 'idle' && !trace.visibleMessage

  if (isIdle) return null

  const borderColor = isError ? 'rgba(251,113,133,0.45)' : 'rgba(201,168,76,0.40)'
  const titleColor = isError ? '#FECDD3' : '#FFE9B3'

  async function copy() {
    const json = serializeTrace(trace)
    let ok = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json)
        ok = true
      }
    } catch { /* clipboard blocked */ }
    if (!ok && typeof window !== 'undefined') {
      try { window.prompt('העתיקי את אבחון הקול:', json) } catch { /* nothing */ }
    }
    onCopied()
  }

  return (
    <div
      data-testid="voice-trace-card"
      dir="rtl"
      style={{
        width: '100%', maxWidth: 480,
        margin: '12px auto 0',
        padding: 14, borderRadius: 14,
        background: 'rgba(14,18,28,0.92)',
        border: `1px solid ${borderColor}`,
        display: 'flex', flexDirection: 'column', gap: 8,
        fontFamily: "'Heebo','DM Sans',sans-serif",
        color: 'rgba(255,255,255,0.95)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: titleColor }}>
          {isError ? 'בעיה בהקלטה' : 'מצב הקלטה'}
        </div>
        <button
          type="button"
          data-testid="voice-trace-dismiss"
          onClick={onDismiss}
          aria-label="סגירה"
          style={{
            minWidth: 36, minHeight: 36, borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.06)',
            color: 'white', fontSize: 16, fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Heebo','DM Sans',sans-serif",
          }}
        >✕</button>
      </div>

      {trace.visibleMessage && (
        <div
          data-testid="voice-trace-message"
          style={{
            fontSize: 15, fontWeight: 600, lineHeight: 1.45,
            color: isError ? '#FECDD3' : 'rgba(255,255,255,0.90)',
          }}
        >{trace.visibleMessage}</div>
      )}

      {trace.transcript && (
        <div data-testid="voice-trace-transcript" style={{
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,250,240,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 13, lineHeight: 1.5,
          color: 'rgba(255,255,255,0.85)',
        }}>הבנתי: {trace.transcript}</div>
      )}

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', direction: 'ltr', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span data-testid="voice-trace-stage">stage: {trace.finalVoiceStage}</span>
        {trace.blobSize !== null && <span>blob: {trace.blobSize}B</span>}
        {trace.chunksCount !== null && <span>chunks: {trace.chunksCount}</span>}
        {trace.mimeType && <span>mime: {trace.mimeType}</span>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          data-testid="voice-trace-copy"
          onClick={() => void copy()}
          style={{
            flex: 1, minHeight: 44, padding: '10px 14px', borderRadius: 10,
            border: '1px solid rgba(201,168,76,0.32)',
            background: 'rgba(201,168,76,0.10)',
            color: '#E8C76A', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Heebo','DM Sans',sans-serif",
          }}
        >{copied ? 'הועתק ✓' : 'העתק אבחון קול'}</button>
      </div>
    </div>
  )
}
