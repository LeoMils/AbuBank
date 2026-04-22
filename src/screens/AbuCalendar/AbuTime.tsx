import { useState, useCallback, useEffect } from 'react'
import { type Appointment } from './service'
import { narrateDay, narrateRange, classifyPriority } from './narration'
import { GOLD, CREAM } from './constants'
import { speak, stopSpeaking } from '../../services/voice'

interface AbuTimeProps {
  appointments: Appointment[]
  today: string
  forceOpen?: boolean
  onToggle?: (open: boolean) => void
}

export function AbuTime({ appointments, today, forceOpen, onToggle }: AbuTimeProps) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = forceOpen ?? expanded

  useEffect(() => {
    if (forceOpen && !expanded) setExpanded(true)
  }, [forceOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  const [scope, setScope] = useState<'today' | 'week'>('today')
  const [isSpeaking, setIsSpeaking] = useState(false)

  const narration = scope === 'today'
    ? narrateDay(appointments.filter(a => a.date === today), today, today)
    : narrateRange(appointments, today, 7)

  const todayAppts = appointments.filter(a => a.date === today)
  const nextAppt = appointments
    .filter(a => a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0]

  const handleSpeak = useCallback(async () => {
    if (isSpeaking) { stopSpeaking(); setIsSpeaking(false); return }
    setIsSpeaking(true)
    try { await speak(narration) } finally { setIsSpeaking(false) }
  }, [narration, isSpeaking])

  const handleTap = useCallback(() => {
    const next = !isOpen
    setExpanded(next)
    onToggle?.(next)
    if (next) handleSpeak()
  }, [isOpen, handleSpeak, onToggle])

  const criticalToday = todayAppts.filter(a => classifyPriority(a) === 'critical')

  return (
    <div style={{
      margin: '0 10px 8px',
      borderRadius: 18,
      background: 'rgba(255,250,240,0.04)',
      border: criticalToday.length > 0
        ? '1.5px solid rgba(239,68,68,0.35)'
        : '1px solid rgba(201,168,76,0.18)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={handleTap}
        style={{
          width: '100%',
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          direction: 'rtl',
          minHeight: 56,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>
            {criticalToday.length > 0 ? '⚠️' : todayAppts.length > 0 ? '📋' : '☀️'}
          </span>
          <span style={{
            fontSize: 18,
            fontWeight: 700,
            color: CREAM,
            fontFamily: "'Heebo',sans-serif",
          }}>
            מה קורה לי?
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {todayAppts.length > 0 && (
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: GOLD,
              fontFamily: "'DM Sans',sans-serif",
              background: 'rgba(201,168,76,0.12)',
              padding: '2px 10px',
              borderRadius: 10,
            }}>
              {todayAppts.length}
            </span>
          )}
          <span style={{
            fontSize: 16,
            color: 'rgba(245,240,232,0.40)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}>▾</span>
        </div>
      </button>

      {isOpen && (
        <div style={{
          padding: '0 18px 16px',
          direction: 'rtl',
          animation: 'fadeSlideUp 0.2s ease both',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['today', 'week'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 12,
                  border: scope === s ? '1px solid rgba(201,168,76,0.40)' : '1px solid rgba(255,255,255,0.08)',
                  background: scope === s ? 'rgba(201,168,76,0.12)' : 'transparent',
                  color: scope === s ? GOLD : 'rgba(245,240,232,0.50)',
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                {s === 'today' ? 'היום' : 'השבוע'}
              </button>
            ))}
            <button
              type="button"
              onClick={handleSpeak}
              aria-label={isSpeaking ? 'עצרי' : 'הקריאי'}
              style={{
                marginRight: 'auto',
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: isSpeaking ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
                border: isSpeaking ? '1px solid rgba(201,168,76,0.40)' : '1px solid rgba(255,255,255,0.08)',
                color: isSpeaking ? GOLD : 'rgba(245,240,232,0.50)',
                fontSize: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSpeaking ? '⏹' : '🔊'}
            </button>
          </div>

          <div style={{
            fontSize: 17,
            lineHeight: 1.8,
            color: 'rgba(245,240,232,0.85)',
            fontFamily: "'Heebo',sans-serif",
            whiteSpace: 'pre-wrap',
          }}>
            {narration}
          </div>

          {nextAppt && nextAppt.date !== today && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(201,168,76,0.06)',
              border: '1px solid rgba(201,168,76,0.15)',
              fontSize: 15,
              color: 'rgba(245,240,232,0.65)',
              fontFamily: "'Heebo',sans-serif",
            }}>
              <span style={{ color: GOLD, fontWeight: 600 }}>הדבר הבא: </span>
              {nextAppt.title} — {nextAppt.date.split('-').reverse().join('/')}
              {nextAppt.time ? ` ב-${nextAppt.time}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
