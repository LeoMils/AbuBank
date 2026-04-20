import { useState } from 'react'
import { type Appointment } from './service'
import { GOLD, TEAL, CREAM, type ApptTimeState, isFamily } from './constants'

export function ApptCard({ appt, onDelete, onEdit, timeState = 'upcoming' }: {
  appt: Appointment
  onDelete?: () => void
  onEdit?: () => void
  timeState?: ApptTimeState
}) {
  const [hovered, setHovered] = useState(false)
  const isPast = timeState === 'past'
  const isNow = timeState === 'now'
  const isToday = timeState === 'today'
  const family = isFamily(appt)
  const showDelete = !family

  const textColor = isPast ? 'rgba(245,240,232,0.50)' : isNow ? CREAM : isToday ? 'rgba(245,240,232,0.92)' : 'rgba(245,240,232,0.88)'
  const timeColor = isPast ? 'rgba(201,168,76,0.30)' : isNow ? TEAL : GOLD
  const timeWeight = isNow || isToday ? 700 : 400
  const notesColor = isPast ? 'rgba(245,240,232,0.30)' : 'rgba(245,240,232,0.55)'
  const stripeColor = isPast ? 'rgba(255,255,255,0.12)' : isNow ? TEAL : isToday ? GOLD : 'rgba(201,168,76,0.45)'
  const stripeWidth = isNow ? 5 : isPast ? 3 : 4
  const deleteOpacity = isPast ? 0.25 : 0.40

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={!family && onEdit ? onEdit : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: isPast ? 'rgba(255,255,255,0.02)'
          : isNow ? 'rgba(20,184,166,0.10)'
          : isToday ? 'rgba(201,168,76,0.06)'
          : 'rgba(255,250,240,0.04)',
        border: isNow ? '1.5px solid rgba(20,184,166,0.40)'
          : isToday ? '1px solid rgba(201,168,76,0.20)'
          : isPast ? '1px solid rgba(255,255,255,0.05)'
          : hovered ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '10px 12px 10px 0',
        position: 'relative', marginBottom: 8, overflow: 'hidden',
        transition: 'border-color 0.15s',
        boxShadow: isNow ? '0 2px 12px rgba(20,184,166,0.15)' : 'none',
        animation: 'fadeSlideUp 0.35s ease both',
        cursor: !family && onEdit ? 'pointer' : 'default',
      } as React.CSSProperties}
    >
      <div style={{
        width: stripeWidth, alignSelf: 'stretch', background: stripeColor,
        borderRadius: '0 3px 3px 0', flexShrink: 0,
      }} />

      {isNow && (
        <div style={{
          position: 'absolute', top: 8, left: 10,
          fontSize: 14, fontWeight: 700, color: 'white',
          background: TEAL, padding: '2px 10px', borderRadius: 8,
          fontFamily: "'Heebo',sans-serif",
        }}>עכשיו</div>
      )}

      <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, filter: isPast ? 'grayscale(0.6)' : 'none' }}>{appt.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 600, color: textColor,
          fontFamily: "'DM Sans','Heebo',sans-serif", marginBottom: 3,
          textDecoration: isPast ? 'line-through' : 'none',
          textDecorationColor: 'rgba(245,240,232,0.25)',
        }}>{appt.title}</div>
        <div style={{
          fontSize: 16, fontWeight: timeWeight, color: timeColor,
          fontFamily: "'DM Sans',sans-serif",
        }}>{appt.time}</div>
        {appt.notes && (
          <div style={{ fontSize: 16, color: notesColor, fontFamily: "'Heebo',sans-serif", marginTop: 4 }}>{appt.notes}</div>
        )}
      </div>
      {showDelete && onDelete && (
        <button type="button" onClick={e => { e.stopPropagation(); onDelete() }} aria-label="מחקי אירוע"
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            color: `rgba(255,255,255,${deleteOpacity})`, fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >×</button>
      )}
    </div>
  )
}
