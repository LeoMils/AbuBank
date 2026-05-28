/*
 * AbuCalendar — VoiceTraceCard
 *
 * Renders in the DayDetailSheet footer to surface voice pipeline problems.
 *
 * NORMAL FLOW: only shows for genuine errors ("בעיה בהקלטה").
 * DIAGNOSTIC MODE: set localStorage key "abu-voice-debug"="true" to see
 *   all stage/blob/chunks/mime/asr fields + the copy-diagnostic button.
 *   Never enabled in production or standard dev QA.
 *
 * This component must NEVER show developer/diagnostic text (stage, blob,
 * chunks, mime, asr, whisper, "העתק אבחון קול") in the normal user flow.
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

  // Diagnostic mode: requires BOTH (a) Vite dev build AND (b) explicit
  // localStorage flag. Production builds can NEVER show diagnostic UI.
  // Enable in dev only: localStorage.setItem('abu-voice-debug', 'true')
  const isDevBuild = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true
  const isDiagMode = isDevBuild
    && typeof localStorage !== 'undefined'
    && localStorage.getItem('abu-voice-debug') === 'true'

  // Normal flow: show only on errors.
  // Diagnostic mode: show all non-idle stages.
  if (isIdle) return null
  if (!isError && !isDiagMode) return null

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

      {/* ── DIAGNOSTIC MODE ONLY — never shown in normal flow ─────────── */}
      {isDiagMode && trace.transcript && (
        <div data-testid="voice-trace-transcript" style={{
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,250,240,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 13, lineHeight: 1.5,
          color: 'rgba(255,255,255,0.85)',
        }}>הבנתי: {trace.transcript}</div>
      )}

      {isDiagMode && trace.rawTranscript && trace.correctionsApplied && trace.correctionsApplied.length > 0
          && trace.rawTranscript !== trace.correctedTranscript && (
        <div data-testid="voice-trace-raw-transcript" style={{
          fontSize: 11, lineHeight: 1.5,
          color: 'rgba(255,255,255,0.45)',
        }}>לפני תיקון: {trace.rawTranscript}</div>
      )}

      {isDiagMode && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', direction: 'ltr', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span data-testid="voice-trace-stage">stage: {trace.finalVoiceStage}</span>
          {trace.blobSize !== null && <span>blob: {trace.blobSize}B</span>}
          {trace.chunksCount !== null && <span>chunks: {trace.chunksCount}</span>}
          {trace.mimeType && <span>mime: {trace.mimeType}</span>}
          {trace.asrModel && <span>asr: {trace.asrModel}{trace.asrFallbackUsed ? ' (fallback)' : ''}</span>}
          {trace.correctionsApplied && trace.correctionsApplied.length > 0 && (
            <span>fixes: {trace.correctionsApplied.length}</span>
          )}
        </div>
      )}

      {isDiagMode && (
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
      )}
    </div>
  )
}
