import { useState } from 'react'
import { type Appointment, detectEmoji } from './service'
import { GOLD, BRIGHT_GOLD, CREAM } from './constants'

interface ManualModalProps {
  onClose: () => void
  onSave: (appt: Omit<Appointment, 'id' | 'color'>) => void
  defaultDate: string
  editing?: Appointment | null
}

export function ManualModal({ onClose, onSave, defaultDate, editing }: ManualModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? defaultDate)
  const [time, setTime] = useState(editing?.time ?? '09:00')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [titleFocused, setTitleFocused] = useState(false)
  const [dateFocused, setDateFocused] = useState(false)
  const [timeFocused, setTimeFocused] = useState(false)
  const [notesFocused, setNotesFocused] = useState(false)
  const modalTitle = editing ? 'עריכת אירוע' : 'אירוע חדש'

  function handleSave() {
    if (!title.trim()) return
    const trimmedNotes = notes.trim()
    const appt: Omit<Appointment, 'id' | 'color'> = {
      title: title.trim(),
      date,
      time,
      emoji: detectEmoji(title.trim()),
      notes: trimmedNotes || '',
    }
    onSave(appt)
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    background: 'rgba(255,250,240,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: CREAM,
    fontSize: 16,
    fontFamily: "'Heebo',sans-serif",
    colorScheme: 'dark' as React.CSSProperties['colorScheme'],
    boxSizing: 'border-box',
    outline: 'none',
    direction: 'rtl',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '0 16px',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        dir="rtl"
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'linear-gradient(160deg, rgba(14,12,10,0.99) 0%, rgba(10,8,6,0.99) 100%)',
          border: '1px solid rgba(201,168,76,0.22)',
          borderRadius: 28,
          padding: '28px 22px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,250,240,0.03)',
          animation: 'modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: CREAM,
          fontFamily: "'Heebo',sans-serif",
          textAlign: 'center',
          marginBottom: 4,
        }}>
          <span style={{
            background: `linear-gradient(135deg, ${BRIGHT_GOLD}, #e8c76a, ${GOLD})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          } as React.CSSProperties}>{modalTitle}</span>
        </div>

        <input
          type="text"
          placeholder="שם האירוע..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          style={{
            ...inputBase,
            border: titleFocused ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.10)',
            fontSize: 18,
            boxShadow: titleFocused ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
          }}
          autoFocus
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 16, fontWeight: 600, color: 'rgba(201,168,76,0.70)',
              fontFamily: "'Heebo',sans-serif",
            }}>תאריך</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              onFocus={() => setDateFocused(true)}
              onBlur={() => setDateFocused(false)}
              style={{
                ...inputBase, padding: '12px 10px',
                border: dateFocused ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.10)',
                boxShadow: dateFocused ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 16, fontWeight: 600, color: 'rgba(201,168,76,0.70)',
              fontFamily: "'Heebo',sans-serif",
            }}>שעה</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              onFocus={() => setTimeFocused(true)}
              onBlur={() => setTimeFocused(false)}
              style={{
                ...inputBase, padding: '12px 10px', direction: 'ltr',
                border: timeFocused ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.10)',
                boxShadow: timeFocused ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
              }}
            />
          </div>
        </div>

        <input
          type="text"
          placeholder="הערות (אופציונלי)..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onFocus={() => setNotesFocused(true)}
          onBlur={() => setNotesFocused(false)}
          style={{
            ...inputBase,
            border: notesFocused ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.10)',
            boxShadow: notesFocused ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: '15px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 16, fontWeight: 600, fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer', minHeight: 56,
            }}
          >ביטול</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              flex: 2, padding: '15px', borderRadius: 14, border: 'none',
              background: title.trim()
                ? `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`
                : 'rgba(255,255,255,0.06)',
              color: title.trim() ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
              fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: title.trim() ? '0 4px 20px rgba(201,168,76,0.40)' : 'none',
              minHeight: 56,
            }}
          >שמירה</button>
        </div>
      </div>
    </div>
  )
}
