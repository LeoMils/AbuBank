import { useEffect } from 'react'
import { type Appointment, detectEmoji } from './service'
import { GOLD, BRIGHT_GOLD, CREAM, getTodayStr, isDuplicate } from './constants'
import { speak, stopSpeaking } from '../../services/voice'

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export function formatHebrewDateSlot(dateStr: string | null, todayStr: string): string {
  if (!dateStr) return 'חסר'
  if (dateStr === todayStr) return 'היום'
  const [yStr, mStr, dStr] = dateStr.split('-')
  const y = Number(yStr); const m = Number(mStr); const d = Number(dStr)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return 'חסר'
  const target = new Date(y, m - 1, d)
  const [tyStr, tmStr, tdStr] = todayStr.split('-')
  const today = new Date(Number(tyStr), Number(tmStr) - 1, Number(tdStr))
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 1) return 'מחר'
  if (diff === 2) return 'מחרתיים'
  return `${d} ב${HEBREW_MONTHS[m - 1] ?? ''} ${y}`
}

function formatTimeSlot(time: string | null): string {
  if (!time) return 'חסר'
  return time
}

interface VoiceCardProps {
  parsed: { title: string; date: string | null; time: string | null; emoji: string; location?: string | null; notes?: string | null; confidence?: number }
  existingAppts: Appointment[]
  onConfirm: (final: { title: string; date: string; time: string; emoji: string; location?: string; notes?: string }) => void
  onCancel: () => void
  confirmationText?: string
  onCorrection?: () => void
  isCorrecting?: boolean
  rawTranscript?: string
}

const SLOT_LABEL: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'rgba(201,168,76,0.70)',
  fontFamily: "'Heebo',sans-serif", letterSpacing: 0.4,
}

const SLOT_VALUE: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, color: CREAM,
  fontFamily: "'Heebo',sans-serif", lineHeight: 1.4,
}

const SLOT_MISSING: React.CSSProperties = {
  ...SLOT_VALUE,
  color: 'rgba(251,146,60,0.85)', fontWeight: 700,
}

export function VoiceCard({ parsed, existingAppts, onConfirm, onCancel, confirmationText, onCorrection, isCorrecting, rawTranscript }: VoiceCardProps) {
  const today = getTodayStr()
  const title = parsed.title?.trim() ?? ''
  const date = parsed.date ?? ''
  const time = parsed.time ?? ''
  const location = parsed.location ?? null
  const notes = parsed.notes ?? null
  const emoji = parsed.emoji && parsed.emoji !== '📅'
    ? parsed.emoji
    : detectEmoji(`${title} ${notes ?? ''}`)

  const canSave = Boolean(title && date && time)
  const isPastDate = !!date && date < today
  const hasDuplicate = canSave && isDuplicate(title, date, time, existingAppts)

  useEffect(() => {
    if (!confirmationText) return
    speak(confirmationText).catch(() => {})
    return () => { stopSpeaking() }
  }, [confirmationText])

  const dateSlot = formatHebrewDateSlot(parsed.date, today)
  const timeSlot = formatTimeSlot(parsed.time)
  const whenSlot = (!parsed.date && !parsed.time) ? 'חסר'
    : `${dateSlot}${parsed.time ? ` · ${timeSlot}` : ''}`

  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.84)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    } as React.CSSProperties}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{
        width: '100%', maxWidth: 480,
        background: 'linear-gradient(160deg, rgba(14,12,10,0.99) 0%, rgba(10,8,6,0.99) 100%)',
        border: '1px solid rgba(201,168,76,0.32)', borderBottom: 'none',
        borderRadius: '24px 24px 0 0',
        padding: 'calc(24px + env(safe-area-inset-bottom, 0px)) 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 -8px 40px rgba(201,168,76,0.12)',
        animation: 'sheetUp 0.32s cubic-bezier(0.34,1.3,0.64,1) both',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
          שמעתי נכון?
        </div>

        {confirmationText && (
          <div data-testid="voice-confirmation-text" style={{
            fontSize: 17, lineHeight: 1.55, color: CREAM,
            fontFamily: "'Heebo',sans-serif", textAlign: 'center',
            whiteSpace: 'pre-line', padding: '4px 6px',
          }}>
            {confirmationText}
          </div>
        )}

        <div data-testid="voice-slots" style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '12px 14px', borderRadius: 14,
          background: 'rgba(255,250,240,0.04)',
          border: '1px solid rgba(201,168,76,0.20)',
        }}>
          <div data-testid="slot-what">
            <div style={SLOT_LABEL}>מה</div>
            <div style={title ? SLOT_VALUE : SLOT_MISSING}>{title || 'חסר'}</div>
          </div>
          <div data-testid="slot-when">
            <div style={SLOT_LABEL}>מתי</div>
            <div style={(parsed.date || parsed.time) ? SLOT_VALUE : SLOT_MISSING}>{whenSlot}</div>
            {isPastDate && <div style={{ ...SLOT_MISSING, fontSize: 14, marginTop: 2 }}>⚠️ התאריך עבר</div>}
          </div>
          <div data-testid="slot-where">
            <div style={SLOT_LABEL}>איפה</div>
            <div style={location ? SLOT_VALUE : SLOT_MISSING}>{location || 'חסר'}</div>
          </div>
          <div data-testid="slot-note">
            <div style={SLOT_LABEL}>הערה</div>
            <div style={notes ? SLOT_VALUE : SLOT_MISSING}>{notes || 'חסר'}</div>
          </div>
        </div>

        {hasDuplicate && (
          <div style={{ fontSize: 14, color: 'rgba(201,168,76,0.60)', fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
            אירוע דומה כבר קיים
          </div>
        )}

        {isDev && (
          <div data-testid="voice-debug" style={{
            fontSize: 12, lineHeight: 1.5, color: 'rgba(255,250,240,0.55)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            padding: '8px 10px', borderRadius: 10,
            background: 'rgba(0,0,0,0.40)', border: '1px dashed rgba(255,255,255,0.18)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            <div style={{ fontWeight: 700, color: 'rgba(201,168,76,0.80)', marginBottom: 4 }}>DEBUG</div>
            <div>raw: {rawTranscript ?? '—'}</div>
            <div>title: {parsed.title || '—'}</div>
            <div>date: {parsed.date ?? '—'}</div>
            <div>time: {parsed.time ?? '—'}</div>
            <div>location: {parsed.location ?? '—'}</div>
            <div>notes: {parsed.notes ?? '—'}</div>
            <div>confidence: {parsed.confidence != null ? parsed.confidence.toFixed(2) : '—'}</div>
          </div>
        )}

        {onCorrection && (
          <button type="button" onClick={onCorrection} data-testid="voice-correction-mic" style={{
            padding: '12px 14px', borderRadius: 14,
            border: '1px solid rgba(201,168,76,0.32)',
            background: isCorrecting ? 'rgba(239,68,68,0.18)' : 'rgba(201,168,76,0.10)',
            color: isCorrecting ? '#fca5a5' : CREAM, fontSize: 16, fontWeight: 600,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 20 }} aria-hidden>🎙️</span>
            {isCorrecting ? 'מקשיבה לתיקון…' : 'תקני בדיבור'}
          </button>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={onCancel} style={{
            flex: 1, padding: '15px', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.50)', fontSize: 18, fontWeight: 600,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56,
          }}>ביטול</button>
          <button type="button" disabled={!canSave}
            onClick={() => canSave && onConfirm({
              title, date, time, emoji,
              ...(location ? { location } : {}),
              ...(notes ? { notes } : {}),
            })}
            style={{
              flex: 2, padding: '15px', borderRadius: 14, border: 'none',
              background: canSave ? `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)` : 'rgba(255,255,255,0.06)',
              color: canSave ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
              fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
              cursor: canSave ? 'pointer' : 'not-allowed', minHeight: 56,
            }}
          >כן, שמרי!</button>
        </div>
      </div>
    </div>
  )
}
