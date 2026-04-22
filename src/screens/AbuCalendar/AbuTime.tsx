import { useState, useCallback, useEffect, useMemo } from 'react'
import { type Appointment } from './service'
import { narrateDay, narrateRange, classifyPriority, getPreEventHint, getSuggestion, getPostEventFollowUp, shouldSpeak, sortByPriority } from './narration'
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

  const now = useMemo(() => new Date(), [])
  const todayAppts = useMemo(() => appointments.filter(a => a.date === today), [appointments, today])
  const sorted = useMemo(() => sortByPriority(todayAppts), [todayAppts])
  const criticalToday = useMemo(() => todayAppts.filter(a => classifyPriority(a) === 'critical'), [todayAppts])

  const narration = scope === 'today'
    ? narrateDay(todayAppts, today, today, now)
    : narrateRange(appointments, today, 7)

  const shouldAutoSpeak = shouldSpeak(todayAppts, today, today)

  const nextAppt = useMemo(() =>
    appointments
      .filter(a => a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0],
    [appointments, today]
  )

  const preEventHint = useMemo(() => {
    if (sorted.length === 0) return null
    for (const a of sorted) {
      const hint = getPreEventHint(a, now)
      if (hint) return hint
    }
    return null
  }, [sorted, now])

  const suggestion = useMemo(() => {
    if (sorted.length === 0) return null
    for (const a of sorted) {
      const s = getSuggestion(a)
      if (s) return s
    }
    return null
  }, [sorted])

  const followUp = useMemo(() => {
    for (const a of sorted) {
      const f = getPostEventFollowUp(a, now)
      if (f) return f
    }
    return null
  }, [sorted, now])

  const handleSpeak = useCallback(async () => {
    if (isSpeaking) { stopSpeaking(); setIsSpeaking(false); return }
    if (!shouldAutoSpeak && scope === 'today') return
    setIsSpeaking(true)
    try { await speak(narration) } finally { setIsSpeaking(false) }
  }, [narration, isSpeaking, shouldAutoSpeak, scope])

  const handleTap = useCallback(() => {
    const next = !isOpen
    setExpanded(next)
    onToggle?.(next)
    if (next && shouldAutoSpeak) handleSpeak()
  }, [isOpen, handleSpeak, onToggle, shouldAutoSpeak])

  const buttonLabel = todayAppts.length === 0
    ? 'מה קורה לי?'
    : criticalToday.length > 0
    ? `${criticalToday[0]!.title} — היום`
    : `מה קורה לי? (${todayAppts.length})`

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
            fontSize: 17,
            fontWeight: 700,
            color: CREAM,
            fontFamily: "'Heebo',sans-serif",
          }}>
            {buttonLabel}
          </span>
        </div>
        <span style={{
          fontSize: 16,
          color: 'rgba(245,240,232,0.40)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s ease',
        }}>▾</span>
      </button>

      {/* Pre-event hint shown even when collapsed */}
      {!isOpen && preEventHint && (
        <div style={{
          padding: '0 18px 12px',
          direction: 'rtl',
          fontSize: 15,
          color: 'rgba(239,68,68,0.80)',
          fontFamily: "'Heebo',sans-serif",
          fontWeight: 600,
        }}>
          ⏰ {preEventHint}
        </div>
      )}

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

          {/* Single action — follow-up takes priority over suggestion, never both */}
          {followUp ? (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(20,184,166,0.06)',
              border: '1px solid rgba(20,184,166,0.20)',
              fontSize: 16,
              color: 'rgba(45,212,191,0.90)',
              fontWeight: 600,
              fontFamily: "'Heebo',sans-serif",
            }}>
              📝 {followUp}
            </div>
          ) : suggestion ? (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(201,168,76,0.06)',
              border: '1px solid rgba(201,168,76,0.15)',
              fontSize: 16,
              color: GOLD,
              fontWeight: 600,
              fontFamily: "'Heebo',sans-serif",
            }}>
              💡 {suggestion}
            </div>
          ) : null}

          {nextAppt && nextAppt.date !== today && (
            <div style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(255,250,240,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 15,
              color: 'rgba(245,240,232,0.55)',
              fontFamily: "'Heebo',sans-serif",
            }}>
              <span style={{ color: 'rgba(245,240,232,0.70)', fontWeight: 600 }}>הדבר הבא: </span>
              {nextAppt.title} — {nextAppt.date.split('-').reverse().join('/')}
              {nextAppt.time ? ` ב-${nextAppt.time}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
