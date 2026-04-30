import { useState, useEffect } from 'react'
import { type Appointment, detectEmoji } from './service'
import { GOLD, BRIGHT_GOLD, CREAM, getTodayStr, isDuplicate } from './constants'
import { speak, stopSpeaking } from '../../services/voice'

interface VoiceCardProps {
  parsed: { title: string; date: string | null; time: string | null; emoji: string; location?: string | null; notes?: string | null }
  existingAppts: Appointment[]
  onConfirm: (final: { title: string; date: string; time: string; emoji: string; location?: string; notes?: string }) => void
  onCancel: () => void
  confirmationText?: string
  onCorrection?: () => void
  isCorrecting?: boolean
}

export function VoiceCard({ parsed, existingAppts, onConfirm, onCancel, confirmationText, onCorrection, isCorrecting }: VoiceCardProps) {
  const [title, setTitle] = useState(parsed.title)
  const [date, setDate] = useState(parsed.date ?? '')
  const [time, setTime] = useState(parsed.time ?? '')
  const location = parsed.location ?? null
  const notes = parsed.notes ?? null
  const emoji = parsed.emoji || detectEmoji(`${title} ${notes ?? ''}`)
  const today = getTodayStr()

  const canSave = title.trim() && date && time
  const isPastDate = date && date < today

  const hasDuplicate = canSave && isDuplicate(title, date, time, existingAppts)

  useEffect(() => { setTitle(parsed.title) }, [parsed.title])
  useEffect(() => { setDate(parsed.date ?? '') }, [parsed.date])
  useEffect(() => { setTime(parsed.time ?? '') }, [parsed.time])

  useEffect(() => {
    if (!confirmationText) return
    speak(confirmationText).catch(() => {})
    return () => { stopSpeaking() }
  }, [confirmationText])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 12,
    background: 'rgba(255,250,240,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    color: CREAM, fontSize: 16, fontFamily: "'Heebo',sans-serif",
    outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'],
  }

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
        padding: 'calc(28px + env(safe-area-inset-bottom, 0px)) 20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 -8px 40px rgba(201,168,76,0.12)',
        animation: 'sheetUp 0.32s cubic-bezier(0.34,1.3,0.64,1) both',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
          🎤 שמעתי נכון?
        </div>

        {confirmationText && (
          <div data-testid="voice-confirmation-text" style={{
            fontSize: 18, lineHeight: 1.55, color: CREAM,
            fontFamily: "'Heebo',sans-serif", textAlign: 'center',
            whiteSpace: 'pre-line', padding: '4px 6px',
          }}>
            {confirmationText}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 38, flexShrink: 0 }}>{emoji}</span>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            style={{ ...inputStyle, fontSize: 19, fontWeight: 700 }} dir="rtl" />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'rgba(201,168,76,0.70)', fontFamily: "'Heebo',sans-serif" }}>תאריך</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              placeholder={!date ? 'תאריך לא זוהה' : undefined}
              style={{ ...inputStyle, padding: '10px 10px', border: !date ? '1px solid rgba(251,146,60,0.40)' : '1px solid rgba(255,255,255,0.10)' }} />
            {!date && <span style={{ fontSize: 14, color: 'rgba(251,146,60,0.85)', fontFamily: "'Heebo',sans-serif" }}>תאריך לא זוהה</span>}
            {isPastDate && <span style={{ fontSize: 14, color: 'rgba(251,146,60,0.85)', fontFamily: "'Heebo',sans-serif" }}>⚠️ התאריך עבר</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'rgba(201,168,76,0.70)', fontFamily: "'Heebo',sans-serif" }}>שעה</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ ...inputStyle, padding: '10px 10px', direction: 'ltr', border: !time ? '1px solid rgba(251,146,60,0.40)' : '1px solid rgba(255,255,255,0.10)' }} />
            {!time && <span style={{ fontSize: 14, color: 'rgba(251,146,60,0.85)', fontFamily: "'Heebo',sans-serif" }}>זמן לא זוהה</span>}
          </div>
        </div>

        {(location || notes) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
            {location && (
              <div data-testid="voice-location" style={{ fontSize: 16, color: 'rgba(255,250,240,0.78)', fontFamily: "'Heebo',sans-serif" }}>
                📍 {location}
              </div>
            )}
            {notes && (
              <div data-testid="voice-notes" style={{ fontSize: 16, color: 'rgba(255,250,240,0.78)', fontFamily: "'Heebo',sans-serif" }}>
                📝 {notes}
              </div>
            )}
          </div>
        )}

        {hasDuplicate && (
          <div style={{ fontSize: 14, color: 'rgba(201,168,76,0.50)', fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
            אירוע דומה כבר קיים
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
            <span style={{ fontSize: 20 }}>🎤</span>
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
              title: title.trim(), date, time, emoji,
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
