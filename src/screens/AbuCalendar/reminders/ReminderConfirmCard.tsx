import React, { useState } from 'react'
import type { ReminderDraft } from './types'
import { categoryIcon } from './reminderFormat'

const GOLD = '#C9A84C'
const BRIGHT_GOLD = '#E0C060'
const BG = '#050A18'
const CREAM = '#F5F0E8'

interface Props {
  draft: ReminderDraft
  onConfirm: (draft: ReminderDraft) => void
  onCancel: () => void
  onCorrect: () => void
  onResolvePerson?: (name: string) => void
  onKeepPhrase?: () => void
  onResolveTime?: (time: string) => void
}

export function ReminderConfirmCard({
  draft,
  onConfirm,
  onCancel,
  onCorrect,
  onResolvePerson,
  onKeepPhrase,
  onResolveTime,
}: Props) {
  const [correcting, setCorrecting] = useState(false)
  const [editTitle, setEditTitle] = useState(draft.title ?? '')
  const [editTime, setEditTime] = useState(draft.displayTimeLabel ?? '')
  const [editDate, setEditDate] = useState(draft.displayDateLabel ?? '')

  const icon = categoryIcon(draft.category)
  const hasAmbiguousTime = draft.ambiguity?.type === 'time' && draft.missingFields.includes('time')
  const hasAmbiguousPerson = draft.ambiguity?.type === 'person'
  const hasAmbiguousTimeOnly = draft.ambiguity?.type === 'time' && !draft.missingFields.includes('time')

  // Save is blocked until all ambiguities resolved and required fields present.
  // Correction mode overrides: user is explicitly fixing the draft, so allow
  // save once the corrected time is in editTime (and title isn't missing).
  const canSaveBase =
    !draft.ambiguity &&
    !draft.missingFields.includes('title') &&
    !!draft.dueAt &&
    draft.familyResolution?.status !== 'ambiguous'
  const canSaveCorrecting =
    correcting &&
    !!editTime.trim() &&
    !!(editTitle.trim() || draft.title)
  const canSave = canSaveBase || canSaveCorrecting

  function handleSave() {
    if (!canSave) return
    if (correcting) {
      const corrected: ReminderDraft = { ...draft }
      const t = editTitle.trim()
      const tm = editTime.trim()
      const dt = editDate.trim()
      if (t) corrected.title = t
      if (tm) {
        const [hStr, mStr] = tm.split(':')
        const h = Number(hStr)
        const m = Number(mStr ?? '0')
        if (Number.isFinite(h) && Number.isFinite(m)) {
          const now = new Date()
          const d = new Date(now)
          d.setHours(h, m, 0, 0)
          if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
          corrected.dueAt = d.toISOString().slice(0, 19)
          corrected.displayTimeLabel = tm
          const isToday = d.toDateString() === now.toDateString()
          corrected.displayDateLabel = dt || (isToday ? 'היום' : 'מחר')
          corrected.missingFields = (corrected.missingFields ?? []).filter(
            f => f !== 'time' && f !== 'date',
          )
        }
      }
      if (dt && !tm) corrected.displayDateLabel = dt
      delete corrected.ambiguity
      onConfirm(corrected)
    } else {
      onConfirm(draft)
    }
  }

  // "לבחור שעה" is handled locally — switch to correcting mode where the user
  // can pick a time via the time input. All other values bubble up.
  function handleTimeChoice(val: string) {
    if (val === 'manual') {
      setCorrecting(true)
      return
    }
    onResolveTime?.(val)
  }

  return (
    <div
      data-testid="reminder-confirm-card"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(3,6,16,0.88)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          width: '100%', maxWidth: 480,
          background: `linear-gradient(180deg, rgba(14,18,38,0.99) 0%, ${BG} 100%)`,
          borderRadius: '24px 24px 0 0',
          border: `1px solid rgba(201,168,76,0.28)`,
          borderBottom: 'none',
          padding: '24px 20px 32px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.60), 0 -2px 0 rgba(201,168,76,0.18)',
          direction: 'rtl',
          fontFamily: "'Heebo',sans-serif",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="אישור תזכורת"
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>{icon}</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: CREAM,
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            letterSpacing: '0.01em',
          }}>הבנתי</div>
          <div style={{ fontSize: 16, color: `rgba(201,168,76,0.70)`, marginTop: 4 }}>
            אני אזכור בשבילך
          </div>
        </div>

        {/* Ambiguous person — candidate chips */}
        {hasAmbiguousPerson && draft.ambiguity && (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: CREAM, marginBottom: 12 }}>
              {draft.ambiguity.question}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {draft.ambiguity.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onResolvePerson?.(opt.value)}
                  style={{
                    minHeight: 56, padding: '0 20px', borderRadius: 16,
                    background: 'rgba(201,168,76,0.12)', border: `1.5px solid ${GOLD}`,
                    color: GOLD, fontSize: 18, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Heebo',sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              ))}
              {onKeepPhrase && (
                <button
                  type="button"
                  onClick={onKeepPhrase}
                  style={{
                    minHeight: 48, padding: '0 16px', borderRadius: 12,
                    background: 'transparent', border: '1px solid rgba(201,168,76,0.25)',
                    color: 'rgba(201,168,76,0.55)', fontSize: 15, cursor: 'pointer',
                    fontFamily: "'Heebo',sans-serif",
                  }}
                >לשמור כך בלי שם</button>
              )}
            </div>
          </div>
        )}

        {/* Ambiguous time — AM/PM choice */}
        {hasAmbiguousTimeOnly && draft.ambiguity && (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: CREAM, marginBottom: 12 }}>
              {draft.ambiguity.question}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {draft.ambiguity.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleTimeChoice(opt.value)}
                  style={{
                    minHeight: 60, padding: '0 24px', borderRadius: 16,
                    background: 'rgba(201,168,76,0.10)', border: `1.5px solid ${GOLD}`,
                    color: GOLD, fontSize: 20, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Heebo',sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Missing time — predefined options */}
        {hasAmbiguousTime && draft.ambiguity && (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: CREAM, marginBottom: 12 }}>
              {draft.ambiguity.question}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {draft.ambiguity.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`reminder-time-suggestion-${opt.value}`}
                  onClick={() => handleTimeChoice(opt.value)}
                  style={{
                    minHeight: 56, padding: '0 18px', borderRadius: 14,
                    background: 'rgba(201,168,76,0.10)', border: `1px solid rgba(201,168,76,0.35)`,
                    color: GOLD, fontSize: 16, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Heebo',sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main content — what / when */}
        {!correcting ? (
          <div style={{
            background: 'rgba(201,168,76,0.05)', borderRadius: 16,
            border: '1px solid rgba(201,168,76,0.14)',
            padding: '16px 18px', marginBottom: 16,
          }}>
            {/* What */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(201,168,76,0.55)', marginBottom: 4 }}>
                מה
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: CREAM }}>
                {draft.title ?? <span style={{ color: 'rgba(201,168,76,0.40)' }}>חסר</span>}
              </div>
              {/* Secondary: resolved family relation */}
              {draft.familyResolution?.status === 'resolved' && draft.familyResolution.originalPhrase && (
                <div style={{ fontSize: 15, color: 'rgba(201,168,76,0.55)', marginTop: 3 }}>
                  {draft.familyResolution.originalPhrase}
                </div>
              )}
              {/* Missing family relation */}
              {draft.familyResolution?.status === 'missing' && (
                <div
                  data-testid="relation-missing"
                  style={{ fontSize: 15, color: 'rgba(245,180,100,0.65)', marginTop: 4 }}
                >
                  לא מצאתי בוודאות מי {draft.familyResolution.originalPhrase}. לשמור כך?
                </div>
              )}
            </div>

            {/* When */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(201,168,76,0.55)', marginBottom: 4 }}>
                מתי
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CREAM }}>
                {draft.recurrence
                  ? `${draft.displayDateLabel ?? 'כל יום'} · ${draft.displayTimeLabel ?? ''}`
                  : draft.dueAt
                  ? `${draft.displayDateLabel ?? ''} · ${draft.displayTimeLabel ?? ''}`
                  : <span style={{ color: 'rgba(201,168,76,0.40)' }}>חסר</span>
                }
              </div>
              {draft.recurrence && (
                <div style={{ fontSize: 14, color: 'rgba(201,168,76,0.50)', marginTop: 2 }}>חוזרת</div>
              )}
            </div>
          </div>
        ) : (
          /* Correction fields */
          <div style={{
            background: 'rgba(201,168,76,0.05)', borderRadius: 16,
            border: '1px solid rgba(201,168,76,0.22)',
            padding: '16px 18px', marginBottom: 16,
          }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'rgba(201,168,76,0.65)', display: 'block', marginBottom: 6 }}>
                מה להזכיר
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.30)',
                  color: CREAM, fontSize: 17, fontFamily: "'Heebo',sans-serif",
                  outline: 'none', boxSizing: 'border-box', direction: 'rtl',
                }}
                placeholder="מה להזכיר לך?"
              />
            </div>
            <div>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'rgba(201,168,76,0.65)', display: 'block', marginBottom: 6 }}>
                שעה
              </label>
              <input
                type="time"
                value={editTime}
                onChange={e => setEditTime(e.target.value)}
                style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.30)',
                  color: CREAM, fontSize: 17, fontFamily: "'Heebo',sans-serif",
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Alert info — honest about delivery limitation */}
        <div data-testid="reminder-delivery-notice" style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '10px 14px', borderRadius: 12,
          background: 'rgba(201,168,76,0.06)', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <span style={{ fontSize: 14, color: 'rgba(201,168,76,0.55)' }}>
              צליל + הודעה על המסך
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(251,191,36,0.55)', lineHeight: 1.5, paddingRight: 24 }}>
            התזכורת תופיע כשהאפליקציה פתוחה על המסך.
            כשהטלפון נעול או האפליקציה סגורה — עדיין לא זמין.
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(201,168,76,0.60)', textAlign: 'center', marginBottom: 14 }}>
          לשמור?
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Save button — appears when no ambiguity, OR when the user is in
              correction mode (they're explicitly fixing the missing field). */}
          {((!hasAmbiguousPerson && !hasAmbiguousTime) || correcting) && (
            <button
              type="button"
              data-testid="reminder-confirm-save-btn"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                minHeight: 60, borderRadius: 16, border: 'none',
                background: canSave
                  ? `linear-gradient(135deg, #D4A853 0%, #C9A84C 50%, #B8912A 100%)`
                  : 'rgba(201,168,76,0.12)',
                color: canSave ? '#0a0c1a' : 'rgba(201,168,76,0.30)',
                fontSize: 20, fontWeight: 800,
                cursor: canSave ? 'pointer' : 'not-allowed',
                fontFamily: "'Heebo',sans-serif",
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              כן, לשמור
            </button>
          )}

          {/* Second row: correct + cancel */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              data-testid="reminder-confirm-correct-btn"
              onClick={() => { setCorrecting(c => !c) }}
              style={{
                flex: 1, minHeight: 56, borderRadius: 14,
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)',
                color: GOLD, fontSize: 17, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Heebo',sans-serif",
              }}
            >
              {correcting ? 'חזור' : 'לא, לתקן'}
            </button>
            <button
              type="button"
              data-testid="reminder-confirm-cancel-btn"
              onClick={onCancel}
              style={{
                flex: 1, minHeight: 56, borderRadius: 14,
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)',
                color: GOLD, fontSize: 17, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Heebo',sans-serif",
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
