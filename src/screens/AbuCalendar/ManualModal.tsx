import { useState } from 'react'
import { type Appointment, detectEmoji } from './service'
import { GOLD, BRIGHT_GOLD, CREAM } from './constants'
import { ConfirmCard } from './ConfirmCard'

interface ManualModalProps {
  onClose: () => void
  onSave: (appt: Omit<Appointment, 'id' | 'color'>) => void
  defaultDate: string
  editing?: Appointment | null
}

export function ManualModal({ onClose, onSave, defaultDate, editing }: ManualModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  // P0 patch — date prefills to defaultDate (the day Martita tapped on
  // the calendar; that's user-initiated, not a hidden default). Time
  // starts EMPTY for new events so the modal never silently saves at
  // a hidden 09:00. Editing an existing event still preloads its time.
  const [date, setDate] = useState(editing?.date ?? defaultDate)
  const [time, setTime] = useState(editing?.time ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [titleFocused, setTitleFocused] = useState(false)
  const [dateFocused, setDateFocused] = useState(false)
  const [timeFocused, setTimeFocused] = useState(false)
  const [notesFocused, setNotesFocused] = useState(false)
  // P0 — surface the missing field so Martita can fix it instead of
  // staring at a disabled Save button with no explanation.
  const [missingHint, setMissingHint] = useState<string>('')
  const [confirming, setConfirming] = useState(false)
  const modalTitle = editing ? 'עריכת אירוע' : 'אירוע חדש'

  // Required-field gate for the Save button (P0). No hidden defaults —
  // title, date, and time all must be present and valid.
  const trimmedTitle = title.trim()
  const isDateValid = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const isTimeValid = /^\d{2}:\d{2}$/.test(time)
  const canSave = Boolean(trimmedTitle && isDateValid && isTimeValid)

  // Step 1 — gate then move to the shared confirmation (no silent save).
  function handleSave() {
    if (!trimmedTitle) { setMissingHint('חסר לי פרט כדי לשמור את הפגישה.'); return }
    if (!isDateValid) { setMissingHint('חסר לי פרט כדי לשמור את הפגישה.'); return }
    if (!isTimeValid) { setMissingHint('חסר לי פרט כדי לשמור את הפגישה.'); return }
    setConfirming(true)
  }

  // Step 2 — the user confirmed on the shared ConfirmCard.
  function doManualSave() {
    const trimmedNotes = notes.trim()
    const appt: Omit<Appointment, 'id' | 'color'> = {
      title: trimmedTitle,
      date,
      time,
      emoji: detectEmoji(trimmedTitle),
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
          maxHeight: 'calc(100dvh - 32px)',
          background: 'linear-gradient(160deg, rgba(14,12,10,0.99) 0%, rgba(10,8,6,0.99) 100%)',
          border: '1px solid rgba(201,168,76,0.22)',
          borderRadius: 28,
          padding: '28px 22px 0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,250,240,0.03)',
          animation: 'modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
          overflow: 'hidden',
        }}
      >
        {!confirming && (<>
        {/* Scrollable form area — ensures save button stays reachable on 360×740 with keyboard */}
        <div data-testid="manual-form-scroll" style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingBottom: 8,
          minHeight: 0,
        }}>
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
        </div>

        {/* Sticky action bar — always visible at bottom of modal */}
        <div data-testid="manual-action-bar" style={{
          flex: '0 0 auto',
          padding: '12px 0 calc(20px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
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
              disabled={!canSave}
              data-testid="manual-save"
              style={{
                flex: 2, padding: '15px', borderRadius: 14, border: 'none',
                background: canSave
                  ? `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`
                  : 'rgba(255,255,255,0.06)',
                color: canSave ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
                fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
                cursor: canSave ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s, color 0.2s',
                boxShadow: canSave ? '0 4px 20px rgba(201,168,76,0.40)' : 'none',
                minHeight: 56,
              }}
            >המשך</button>
          </div>
          {(missingHint || !canSave) && (
            <div data-testid="manual-missing-hint" style={{
              fontSize: 14,
              color: 'rgba(251,146,60,0.85)',
              fontFamily: "'Heebo',sans-serif",
              textAlign: 'center',
            }}>
              {!trimmedTitle ? 'חסר שם לאירוע.' : !isDateValid ? 'חסר תאריך.' : !isTimeValid ? 'חסרה שעה.' : missingHint}
            </div>
          )}
        </div>
        </>)}

        {confirming && (
          <div style={{ padding: '28px 22px calc(24px + env(safe-area-inset-bottom))' }}>
            <ConfirmCard
              draft={{ title: trimmedTitle, date: isDateValid ? date : null, time: isTimeValid ? time : null }}
              onConfirm={doManualSave}
              onCorrect={() => setConfirming(false)}
              onCancel={onClose}
            />
          </div>
        )}
      </div>
    </div>
  )
}
