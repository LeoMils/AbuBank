/**
 * VoiceAddFlow — single-state-machine overlay for voice-driven calendar ADD.
 *
 * Exactly ONE panel is visible at a time. States in priority order:
 *   saved → ampm → error → confirm → correcting → processing → recording → hidden
 *
 * No diagnostic UI anywhere in this file — the voice trace card and all
 * developer-only debug strings are intentionally absent.
 * Raw transcript is never rendered.
 */

import { useState, useEffect } from 'react'
import { ConfirmCard } from './ConfirmCard'
import { formatHebrewDateSlot } from './voiceDateUtils'
import { type Appointment, detectEmoji } from './service'
import { GOLD, BRIGHT_GOLD, CREAM, TEXT_SECONDARY, getTodayStr, isDuplicate } from './constants'
import { sanitizeTitleForSave } from './localParser'

type VoiceRelation = { status: 'resolved' | 'ambiguous' | 'missing'; phrase: string; candidates?: string[] }

export interface VoiceDraft {
  title: string
  date: string | null
  time: string | null
  emoji: string
  location?: string | null
  notes?: string | null
  personName?: string | null
  relation?: VoiceRelation
}

type SaveFinal = { title: string; date: string; time: string; emoji: string; location?: string; notes?: string }
type AmPmDraft = { title: string; date: string | null; time: string; emoji: string; location: string | null; notes: string | null }
type SavedData = { title: string; date: string; time: string }

type FlowState = 'hidden' | 'recording' | 'processing' | 'confirm' | 'ampm' | 'correcting' | 'saved' | 'error'

function deriveFlowState(
  isRecording: boolean,
  isProcessing: boolean,
  parsed: VoiceDraft | null,
  voiceError: string | null,
  ampm: AmPmDraft | null,
  saved: SavedData | null,
  editing: boolean,
): FlowState {
  if (saved) return 'saved'
  if (ampm) return 'ampm'
  if (voiceError) return 'error'
  if (parsed) return editing ? 'correcting' : 'confirm'
  if (isProcessing) return 'processing'
  if (isRecording) return 'recording'
  return 'hidden'
}

function extractWithWhom(title: string): string {
  const m = title.match(/עם\s+([^\s].+?)$/)
  return m ? (m[1] ?? '') : ''
}

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'rgba(201,168,76,0.75)',
  fontFamily: "'Heebo',sans-serif", letterSpacing: 0.4, marginBottom: 4,
}
const FIELD_INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,250,240,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  color: CREAM, fontSize: 17, fontFamily: "'Heebo',sans-serif",
  outline: 'none', boxSizing: 'border-box',
}
const FIELD_INPUT_MISSING: React.CSSProperties = {
  ...FIELD_INPUT, border: '1px solid rgba(251,146,60,0.45)',
}

const SHEET_PANEL: React.CSSProperties = {
  width: '100%', maxWidth: 480,
  background: 'linear-gradient(160deg, rgba(14,12,10,0.99) 0%, rgba(10,8,6,0.99) 100%)',
  border: '1px solid rgba(201,168,76,0.32)', borderBottom: 'none',
  borderRadius: '24px 24px 0 0',
  padding: 'calc(24px + env(safe-area-inset-bottom, 0px)) 20px 24px',
  display: 'flex', flexDirection: 'column', gap: 16,
  boxShadow: '0 -8px 40px rgba(201,168,76,0.12)',
  animation: 'sheetUp 0.28s cubic-bezier(0.34,1.3,0.64,1) both',
  maxHeight: '92vh', overflowY: 'auto',
}

const BTN_BASE: React.CSSProperties = {
  padding: '14px', borderRadius: 14, fontSize: 17, fontWeight: 600,
  fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56, border: 'none',
}
const BTN_GHOST: React.CSSProperties = {
  ...BTN_BASE,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.60)',
}
const BTN_GOLD = (active: boolean): React.CSSProperties => ({
  ...BTN_BASE, fontWeight: 700,
  background: active ? `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)` : 'rgba(255,255,255,0.06)',
  color: active ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
  cursor: active ? 'pointer' : 'not-allowed',
})

const HEBREW_HOUR_WORDS = ['שתים עשרה','אחת','שתיים','שלוש','ארבע','חמש','שש','שבע','שמונה','תשע','עשר','אחת עשרה']
const HEBREW_MONTHS_S = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function savedDateLabel(d: string, today: string): string {
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return d
  if (d === today) return 'היום'
  const diff = Math.round((new Date(y, m - 1, day).getTime() - new Date(today).getTime()) / 86400000)
  if (diff === 1) return 'מחר'
  if (diff === 2) return 'מחרתיים'
  return `${day} ב${HEBREW_MONTHS_S[m - 1] ?? ''} ${y}`
}

export interface VoiceAddFlowProps {
  isRecording: boolean
  isProcessing: boolean
  parsed: VoiceDraft | null
  voiceError: string | null
  ambiguousDraft: AmPmDraft | null
  savedConfirmation: SavedData | null
  existingAppts: Appointment[]

  onToggleRecord: () => void
  onConfirm: (final: SaveFinal) => void
  onCancel: () => void
  onRetry: () => void
  onManualAdd: () => void
  onResolveAmPm: (period: 'am' | 'pm') => void
  onSavedClose: () => void
  onSavedShowDay: () => void
  onPickPerson?: (name: string) => void
  onKeepPhrase?: () => void
}

export function VoiceAddFlow({
  isRecording, isProcessing, parsed, voiceError,
  ambiguousDraft, savedConfirmation, existingAppts,
  onToggleRecord, onConfirm, onCancel, onRetry,
  onManualAdd, onResolveAmPm, onSavedClose, onSavedShowDay,
  onPickPerson, onKeepPhrase,
}: VoiceAddFlowProps) {
  const today = getTodayStr()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [withWhom, setWithWhom] = useState('')

  useEffect(() => {
    setEditing(false)
    setTitle(parsed?.title ?? '')
    setDate(parsed?.date ?? '')
    setTime(parsed?.time ?? '')
    setWithWhom(extractWithWhom(parsed?.title ?? '') || (parsed?.personName ?? ''))
  }, [parsed])

  const flowState = deriveFlowState(isRecording, isProcessing, parsed, voiceError, ambiguousDraft, savedConfirmation, editing)
  if (flowState === 'hidden') return null

  const trimTitle = title.trim()
  const canSave = Boolean(trimTitle && date && time)
  const hasDuplicate = canSave && isDuplicate(trimTitle, date, time, existingAppts)
  const dateLabel = formatHebrewDateSlot(date || null, today)

  function doCorrectSave() {
    if (!canSave) return
    const base = title.replace(/\s+עם\s+.*$/, '').trim() || trimTitle
    const finalTitle = withWhom.trim() ? `${base} עם ${withWhom.trim()}` : trimTitle
    const cleanTitle = sanitizeTitleForSave(finalTitle, withWhom.trim() || parsed?.personName)
    const emoji = (parsed?.emoji && parsed.emoji !== '📅')
      ? parsed.emoji : detectEmoji(`${cleanTitle}`)
    onConfirm({
      title: cleanTitle, date, time, emoji,
      ...(parsed?.notes?.trim() ? { notes: parsed.notes.trim() } : {}),
    })
  }

  function doConfirmSave() {
    if (!parsed?.date || !parsed?.time) return
    const cleanTitle = sanitizeTitleForSave(parsed.title, parsed.personName)
    const emoji = (parsed.emoji && parsed.emoji !== '📅') ? parsed.emoji : detectEmoji(cleanTitle)
    onConfirm({
      title: cleanTitle, date: parsed.date, time: parsed.time, emoji,
      ...(parsed.location?.trim() ? { location: parsed.location.trim() } : {}),
      ...(parsed.notes?.trim() ? { notes: parsed.notes.trim() } : {}),
    })
  }

  const onBackdropClick = (flowState === 'recording' || flowState === 'processing') ? undefined : onCancel

  return (
    <div
      data-testid="voice-add-flow"
      onClick={onBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.84)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        overflowY: 'auto',
      } as React.CSSProperties}
    >
      <div onClick={e => e.stopPropagation()} dir="rtl" style={SHEET_PANEL as React.CSSProperties}>

        {/* ── RECORDING ─────────────────────────────────────────────── */}
        {flowState === 'recording' && (
          <div data-testid="vaf-recording" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 0' }}>
            <div style={{ fontSize: 52 }} aria-hidden>🎤</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif" }}>אני מקשיבה…</div>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button type="button" data-testid="vaf-cancel-btn" onClick={onCancel}
                style={{ ...BTN_GHOST, flex: 1 }}>ביטול</button>
              <button type="button" data-testid="vaf-stop-btn" onClick={onToggleRecord}
                style={{ ...BTN_BASE, flex: 2, fontWeight: 700,
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white' }}>
                עצור
              </button>
            </div>
          </div>
        )}

        {/* ── PROCESSING ────────────────────────────────────────────── */}
        {flowState === 'processing' && (
          <div data-testid="vaf-processing" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '28px 0' }}>
            <div style={{ fontSize: 44 }} aria-hidden>⚙️</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif" }}>בודקת את הבקשה…</div>
          </div>
        )}

        {/* ── CONFIRM ───────────────────────────────────────────────── */}
        {flowState === 'confirm' && parsed && (
          <div data-testid="vaf-confirm">
            <ConfirmCard
              draft={{ title: parsed.title, date: parsed.date, time: parsed.time, personName: parsed.personName ?? null }}
              {...(parsed.relation ? { relation: parsed.relation } : {})}
              {...(onPickPerson ? { onPickPerson } : {})}
              {...(onKeepPhrase ? { onKeepPhrase } : {})}
              onConfirm={doConfirmSave}
              onCorrect={() => setEditing(true)}
              onCancel={onCancel}
            />
          </div>
        )}

        {/* ── AM/PM ─────────────────────────────────────────────────── */}
        {flowState === 'ampm' && ambiguousDraft && (() => {
          const [hStr] = ambiguousDraft.time.split(':')
          const h = parseInt(hStr ?? '0', 10)
          const hourWord = HEBREW_HOUR_WORDS[h % 12] ?? String(h)
          return (
            <div data-testid="vaf-ampm" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif", textAlign: 'center', lineHeight: 1.5 }}>
                זה {hourWord} בלילה או {hourWord} בצהריים?
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" data-testid="vaf-ampm-night"
                  onClick={() => onResolveAmPm('am')}
                  style={{ ...BTN_GHOST, flex: 1, fontSize: 18, fontWeight: 700 }}>בלילה</button>
                <button type="button" data-testid="vaf-ampm-noon"
                  onClick={() => onResolveAmPm('pm')}
                  style={{ flex: 1, padding: '15px', borderRadius: 14, border: 'none', fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56,
                    background: `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`,
                    color: 'rgba(0,0,0,0.85)' }}>בצהריים</button>
              </div>
            </div>
          )
        })()}

        {/* ── CORRECTING ────────────────────────────────────────────── */}
        {flowState === 'correcting' && (
          <div data-testid="vaf-correcting" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif" }}>תיקון</div>

            <div data-testid="field-what">
              <div style={FIELD_LABEL}>מה</div>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="חסר"
                style={trimTitle ? FIELD_INPUT : FIELD_INPUT_MISSING} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div data-testid="field-date" style={{ flex: 1 }}>
                <div style={FIELD_LABEL}>מתי</div>
                <input type="text" value={date} onChange={e => setDate(e.target.value)} placeholder="חסר"
                  style={date ? FIELD_INPUT : FIELD_INPUT_MISSING} />
                {date && (
                  <div style={{ fontSize: 13, color: 'rgba(255,250,240,0.55)', fontFamily: "'Heebo',sans-serif", marginTop: 4 }}>
                    {dateLabel}
                  </div>
                )}
              </div>
              <div data-testid="field-time" style={{ flex: 1 }}>
                <div style={FIELD_LABEL}>שעה</div>
                <input type="text" value={time} onChange={e => setTime(e.target.value)} placeholder="חסר" dir="ltr"
                  style={time ? FIELD_INPUT : FIELD_INPUT_MISSING} />
              </div>
            </div>

            <div data-testid="field-with-whom">
              <div style={FIELD_LABEL}>עם מי</div>
              <input type="text" value={withWhom} onChange={e => setWithWhom(e.target.value)} placeholder="לא חובה"
                style={FIELD_INPUT} />
            </div>

            {hasDuplicate && (
              <div style={{ fontSize: 14, color: 'rgba(201,168,76,0.60)', fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
                אירוע דומה כבר קיים
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" data-testid="vaf-correct-back-btn"
                onClick={() => setEditing(false)}
                style={{ ...BTN_GHOST, flex: 1 }}>חזור</button>
              <button type="button" data-testid="vaf-correct-save-btn"
                disabled={!canSave} onClick={doCorrectSave}
                style={{ ...BTN_GOLD(canSave), flex: 2, fontWeight: 700 }}>שמור תיקון</button>
            </div>
          </div>
        )}

        {/* ── SAVED ─────────────────────────────────────────────────── */}
        {flowState === 'saved' && savedConfirmation && (
          <div data-testid="vaf-saved" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#86efac', fontFamily: "'Heebo',sans-serif" }}>
              נשמר ביומן ✓
            </div>
            <div style={{ background: 'rgba(134,239,172,0.06)', border: '1px solid rgba(134,239,172,0.18)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div data-testid="vaf-saved-title" style={{ fontSize: 19, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif" }}>
                {savedConfirmation.title}
              </div>
              <div data-testid="vaf-saved-when" style={{ fontSize: 16, color: TEXT_SECONDARY, fontFamily: "'Heebo',sans-serif" }}>
                {savedDateLabel(savedConfirmation.date, today)} · {savedConfirmation.time}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" data-testid="vaf-saved-show-day" onClick={onSavedShowDay}
                style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid rgba(201,168,76,0.32)', background: 'rgba(201,168,76,0.10)', color: CREAM, fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56 }}>
                הצג ביום
              </button>
              <button type="button" data-testid="vaf-saved-close" onClick={onSavedClose}
                style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: CREAM, fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56 }}>
                סגור
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ─────────────────────────────────────────────────── */}
        {flowState === 'error' && (
          <div data-testid="vaf-error" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FECDD3', fontFamily: "'Heebo',sans-serif" }}>
              בעיה בהקלטה
            </div>
            {voiceError && (
              <div data-testid="vaf-error-message" style={{ fontSize: 15, color: '#fca5a5', fontFamily: "'Heebo',sans-serif", lineHeight: 1.5 }}>
                {voiceError}
              </div>
            )}
            <div style={{ fontSize: 15, color: TEXT_SECONDARY, fontFamily: "'Heebo',sans-serif" }}>
              אפשר לנסות שוב או להוסיף ידנית.
            </div>
            <button type="button" data-testid="vaf-retry-btn" onClick={onRetry}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(201,168,76,0.32)', background: 'rgba(201,168,76,0.10)', color: CREAM, fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56 }}>
              נסה שוב
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" data-testid="vaf-manual-btn" onClick={onManualAdd}
                style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: TEXT_SECONDARY, fontSize: 16, fontWeight: 600, fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 52 }}>
                הוסף ידנית
              </button>
              <button type="button" data-testid="vaf-cancel-error-btn" onClick={onCancel}
                style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.50)', fontSize: 16, fontWeight: 600, fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 52 }}>
                ביטול
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
