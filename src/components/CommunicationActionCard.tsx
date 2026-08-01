import { useState, useRef, useEffect } from 'react'
import type { CommunicationAction } from '../screens/AbuAI/communication/types'

/**
 * Generic renderer for a CommunicationAction handoff. Channel-agnostic:
 *  - CALL (mode 'call'): a single primary action ("התקשרי") — no message body.
 *  - MESSAGE default: a single primary action that opens the conversation; the
 *    message is reviewed/edited/sent inside the target app (WhatsApp is the
 *    review surface). No editable card is forced.
 *  - MESSAGE with review: the editable draft is shown (explicit review request),
 *    plus a subtle reveal so any user can open the draft to tweak if they want.
 * Pressing the primary action calls `onOpen(text)`; the parent performs the
 * adapter handoff (open conversation/dialer + prefill, never send/dial).
 * WhatsApp is never named here — this component works for any channel.
 */
interface Props {
  action: CommunicationAction
  onOpen: (draftText: string) => boolean
}

const WA_GREEN = '#25D366'
const CALL_GREEN = '#2ee67a'

export function CommunicationActionCard({ action, onOpen }: Props) {
  const isCall = action.mode === 'call'
  const [text, setText] = useState(action.draft.text)
  const [showDraft, setShowDraft] = useState(!!action.review)
  const [note, setNote] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  // FAILURE C fix: a claimed action ("לחצי על התקשרי") must be REACHABLE. Scroll
  // the new action card fully into view so its primary button is never left
  // below the fold / behind the composer on a small iPhone viewport.
  useEffect(() => {
    if (action.action !== 'handoff') return
    const id = requestAnimationFrame(() => {
      try { cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch { /* older Safari */ }
    })
    return () => cancelAnimationFrame(id)
  }, [action.action])

  const factLost = !isCall && !action.verification.ok && action.verification.missingFacts.length > 0

  const press = () => {
    // Call → no body. Message → the reviewed text if shown, else the verified draft.
    const payload = isCall ? '' : (showDraft ? text : action.draft.text)
    const ok = onOpen(payload)
    if (!ok) {
      setNote(isCall
        ? `אין מספר טלפון שמור ל${action.recipient.name}.`
        : `אין מספר שמור ל${action.recipient.name}. העתקתי לך את ההודעה — אפשר לפתוח את אבו וואטסאפ ולהדביק.`)
    }
  }

  return (
    <div
      ref={cardRef}
      data-testid="communication-action-card"
      data-channel={action.channel}
      data-adapter={action.adapter}
      data-mode={action.mode}
      style={{ width: '100%', maxWidth: 420, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10, direction: 'rtl' }}
    >
      {/* Editable draft — MESSAGE + review only (explicit or revealed). */}
      {!isCall && showDraft && (
        <textarea
          data-testid="communication-draft"
          value={text}
          onChange={(e) => setText(e.target.value)}
          dir="rtl"
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 104,
            padding: '14px 16px', borderRadius: 16, background: 'rgba(10,18,36,0.72)',
            border: '1.5px solid rgba(37,211,102,0.28)', borderTop: `3px solid ${WA_GREEN}`,
            color: 'rgba(255,255,255,0.94)', fontSize: 17, lineHeight: 1.8,
            fontFamily: "'Heebo',sans-serif", outline: 'none', whiteSpace: 'pre-wrap',
          }}
        />
      )}

      {factLost && showDraft && (
        <div data-testid="communication-verify-warn" style={{ fontSize: 13, color: 'rgba(251,191,36,0.9)', fontFamily: "'Heebo',sans-serif" }}>
          שווה לבדוק שהפרטים ({action.verification.missingFacts.join(', ')}) נכונים.
        </div>
      )}

      {/* Single primary action, labeled by the adapter (call or message). */}
      <button
        type="button"
        data-testid="communication-primary-action"
        onClick={press}
        style={{
          width: '100%', height: 54, borderRadius: 16, border: 'none',
          background: `linear-gradient(145deg, ${CALL_GREEN}, ${WA_GREEN}, #128C7E)`,
          color: 'white', fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {isCall ? '📞' : '📱'} {action.primaryActionLabel}
      </button>

      {/* Optional review for a MESSAGE — WhatsApp is the review surface, so this
          is a quiet secondary affordance, not a forced card. */}
      {!isCall && !showDraft && (
        <button
          type="button"
          data-testid="communication-reveal"
          onClick={() => setShowDraft(true)}
          style={{
            alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: "'Heebo',sans-serif", padding: '2px 0',
          }}
        >✎ לראות ולערוך לפני</button>
      )}

      {note && (
        <div data-testid="communication-note" style={{
          fontSize: 14, color: 'rgba(255,220,220,0.9)', fontFamily: "'Heebo',sans-serif",
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '10px 12px', lineHeight: 1.5,
        }}>{note}</div>
      )}

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: "'DM Sans',sans-serif", direction: 'ltr' }}>
        {action.channel} · {isCall ? 'לא מתקשר אוטומטית' : 'לא נשלח אוטומטית'}
      </div>
    </div>
  )
}
