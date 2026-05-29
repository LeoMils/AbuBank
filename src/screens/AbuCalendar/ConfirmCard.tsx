import { type ReactNode } from 'react'
import { GOLD, BRIGHT_GOLD, CREAM, TEXT_SECONDARY, getTodayStr } from './constants'
import { formatHebrewDateSlot } from './voiceDateUtils'

// Shared senior-first confirmation. Same calm UX for voice AND manual add:
// a clean, normalized-Hebrew summary (מה / מתי) and three large actions.
// NEVER shows a raw transcript and never renders private notes/location.
// For a family relationship phrase ("הבת של מור") it shows the verified name
// (resolved), a short clarification (ambiguous), or preserves the phrase
// honestly (missing) — never invents.
export interface ConfirmDraft {
  title: string
  date: string | null
  time: string | null
  personName?: string | null
}

export interface ConfirmRelation {
  status: 'resolved' | 'ambiguous' | 'missing'
  phrase: string
  candidates?: string[]
}

export function confirmCanSave(d: { title?: string | null; date?: string | null; time?: string | null }): boolean {
  return Boolean((d.title ?? '').trim() && d.date && d.time)
}

function Row({ label, value, missing }: { label: string; value: ReactNode; missing?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(201,168,76,0.85)', fontFamily: "'Heebo',sans-serif", minWidth: 56 }}>{label}</span>
      <span style={{
        fontSize: 19, fontWeight: 700, color: missing ? 'rgba(251,146,60,0.95)' : CREAM,
        fontFamily: "'Heebo',sans-serif", lineHeight: 1.4,
      }}>{missing ? 'חסר' : value}</span>
    </div>
  )
}

export function ConfirmCard({
  draft, relation, onConfirm, onCorrect, onCancel, onPickPerson, onKeepPhrase, extraTopContent,
}: {
  draft: ConfirmDraft
  relation?: ConfirmRelation
  confirmationText?: string
  onConfirm: () => void
  onCorrect: () => void
  onCancel: () => void
  onPickPerson?: (name: string) => void
  onKeepPhrase?: () => void
  extraTopContent?: ReactNode
}) {
  const today = getTodayStr()
  const canSave = confirmCanSave(draft)
  const dateLabel = draft.date ? formatHebrewDateSlot(draft.date, today) : null
  const isPast = !!draft.date && draft.date < today
  const ambiguous = relation?.status === 'ambiguous' && (relation.candidates?.length ?? 0) > 0
  const whatPerson = (draft.title ?? '').trim() || (draft.personName ? `פגישה עם ${draft.personName}` : '')

  return (
    <div data-testid="confirm-card" dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {extraTopContent}

      <div data-testid="confirm-heading" style={{ fontSize: 18, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif" }}>הבנתי</div>

      <div data-testid="confirm-summary" style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)',
        borderRadius: 14, padding: '14px 16px',
      }}>
        <Row label="מה" value={whatPerson} missing={!whatPerson} />
        {relation?.status === 'resolved' && (
          <div data-testid="relation-secondary" style={{ fontSize: 14, color: TEXT_SECONDARY, fontFamily: "'Heebo',sans-serif", paddingInlineStart: 66 }}>{relation.phrase}</div>
        )}
        {relation?.status === 'missing' && (
          <div data-testid="relation-missing" style={{ fontSize: 14, color: 'rgba(251,146,60,0.95)', fontFamily: "'Heebo',sans-serif", lineHeight: 1.5, paddingInlineStart: 66 }}>
            לא מצאתי בוודאות מי {relation.phrase}. לשמור כך?
          </div>
        )}
        <Row label="מתי" value={`${dateLabel ?? ''}${draft.time ? ` · ${draft.time}` : ''}`.trim()} missing={!draft.date || !draft.time} />
        {isPast && (
          <div style={{ fontSize: 14, color: 'rgba(251,146,60,0.95)', fontFamily: "'Heebo',sans-serif" }}>⚠️ התאריך עבר</div>
        )}
      </div>

      {ambiguous ? (
        <div data-testid="relation-clarify" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif" }}>למי התכוונת?</div>
          {relation!.candidates!.map(c => (
            <button
              key={c}
              type="button"
              data-testid="relation-candidate"
              onClick={() => onPickPerson?.(c)}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                border: '1px solid rgba(201,168,76,0.32)', background: 'rgba(201,168,76,0.10)',
                color: CREAM, fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer', minHeight: 56,
              }}
            >{c}</button>
          ))}
          <button
            type="button"
            data-testid="relation-keep"
            onClick={() => onKeepPhrase?.()}
            style={{
              width: '100%', padding: '12px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
              color: TEXT_SECONDARY, fontSize: 16, fontWeight: 600, fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer', minHeight: 52,
            }}
            title={relation!.phrase}
          >להשאיר כמו שאמרתי</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div data-testid="confirm-question" style={{ fontSize: 17, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>לשמור ביומן?</div>
          <button
            type="button"
            data-testid="confirm-save-btn"
            disabled={!canSave}
            onClick={() => canSave && onConfirm()}
            style={{
              width: '100%', padding: '16px', borderRadius: 16, border: 'none',
              background: canSave ? `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)` : 'rgba(255,255,255,0.06)',
              color: canSave ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
              fontSize: 20, fontWeight: 800, fontFamily: "'Heebo',sans-serif",
              cursor: canSave ? 'pointer' : 'not-allowed', minHeight: 60,
            }}
          >כן, לשמור</button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              data-testid="confirm-correct-btn"
              onClick={onCorrect}
              style={{
                flex: 1, padding: '14px', borderRadius: 14,
                border: '1px solid rgba(201,168,76,0.32)', background: 'rgba(201,168,76,0.10)',
                color: CREAM, fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer', minHeight: 56,
              }}
            >לא, לתקן</button>
            <button
              type="button"
              data-testid="confirm-cancel-btn"
              onClick={onCancel}
              style={{
                flex: 1, padding: '14px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.60)', fontSize: 17, fontWeight: 600, fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer', minHeight: 56,
              }}
            >ביטול</button>
          </div>
        </div>
      )}
    </div>
  )
}
