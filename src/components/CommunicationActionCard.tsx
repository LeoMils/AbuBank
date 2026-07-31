import { useState } from 'react'
import type { CommunicationAction } from '../screens/AbuAI/communication/types'

/**
 * Generic renderer for a CommunicationAction handoff. Channel-agnostic: it shows
 * the reviewed (editable) draft, a verification note, and ONE primary action
 * labeled by the adapter. Pressing it calls `onOpen(currentDraftText)` — the
 * parent performs the adapter handoff (open conversation + prefill, never send).
 * WhatsApp is just the first channel; this component never mentions it.
 */
interface Props {
  action: CommunicationAction
  /** Perform the handoff for the given (reviewed) text. Returns false if it
   *  could not open (e.g. no number) so the card can show a fallback note. */
  onOpen: (draftText: string) => boolean
}

const TEAL = '#14b8a6'
const WA_GREEN = '#25D366'

export function CommunicationActionCard({ action, onOpen }: Props) {
  const [text, setText] = useState(action.draft.text)
  const [note, setNote] = useState('')

  const canHandoff = action.recipient.canHandoff
  const factLost = !action.verification.ok && action.verification.missingFacts.length > 0

  const press = () => {
    const ok = onOpen(text)
    if (!ok) setNote(`אין מספר שמור ל${action.recipient.name}. העתקתי לך את ההודעה — אפשר לפתוח את אבו וואטסאפ ולהדביק.`)
  }

  return (
    <div
      data-testid="communication-action-card"
      data-channel={action.channel}
      data-adapter={action.adapter}
      style={{
        width: '100%', maxWidth: 420, marginTop: 8,
        display: 'flex', flexDirection: 'column', gap: 12,
        direction: 'rtl',
      }}
    >
      {/* Reviewed, editable draft — what the primary action will prefill. */}
      <textarea
        data-testid="communication-draft"
        value={text}
        onChange={(e) => setText(e.target.value)}
        dir="rtl"
        rows={4}
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 104,
          padding: '14px 16px', borderRadius: 16,
          background: 'rgba(10,18,36,0.72)',
          border: '1.5px solid rgba(37,211,102,0.28)', borderTop: `3px solid ${WA_GREEN}`,
          color: 'rgba(255,255,255,0.94)', fontSize: 17, lineHeight: 1.8,
          fontFamily: "'Heebo',sans-serif", outline: 'none', whiteSpace: 'pre-wrap',
        }}
      />

      {factLost && (
        <div data-testid="communication-verify-warn" style={{
          fontSize: 13, color: 'rgba(251,191,36,0.9)', fontFamily: "'Heebo',sans-serif",
        }}>
          שימי לב: כדאי לבדוק שהפרטים ({action.verification.missingFacts.join(', ')}) נכונים.
        </div>
      )}

      {/* Single primary action — labeled by the adapter, not hard-coded. */}
      <button
        type="button"
        data-testid="communication-primary-action"
        onClick={press}
        style={{
          width: '100%', height: 54, borderRadius: 16, border: 'none',
          background: canHandoff
            ? `linear-gradient(145deg,#2ee67a,${WA_GREEN},#128C7E)`
            : 'rgba(255,255,255,0.08)',
          color: canHandoff ? 'white' : 'rgba(255,255,255,0.6)',
          fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        📱 {action.primaryActionLabel}
      </button>

      {note && (
        <div data-testid="communication-note" style={{
          fontSize: 14, color: 'rgba(255,220,220,0.9)', fontFamily: "'Heebo',sans-serif",
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '10px 12px', lineHeight: 1.5,
        }}>{note}</div>
      )}

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: "'DM Sans',sans-serif", direction: 'ltr' }}>
        {action.channel} · לא נשלח אוטומטית
      </div>
    </div>
  )
}
