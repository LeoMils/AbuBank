/*
 * ACTIVE ACTION CARD (ADR-0001 §13) — the canonical live-session card.
 * ────────────────────────────────────────────────────────────────────
 * A PURE projection of a single `ActiveActionViewModel` committed revision. It
 * owns NO state and NO truth: it shows the safe recipient label, the committed
 * status, and the ONE primary control the view-model permits — while the
 * conversation stays live. The card and any spoken confirmation read the SAME
 * revision (law 9). It can never render a completion (the view-model has no such
 * status) and never shows a phone number (the label is scrubbed upstream).
 */
import type { ActiveActionViewModel } from '../screens/AbuAI/realtime/sessionOrchestrator'

const WA_GREEN = '#25D366'
const CALL_GREEN = '#2ee67a'

interface Props {
  vm: ActiveActionViewModel
  /** Perform the handoff for the visible committed card (open conversation/dialer,
   *  prefill, NEVER send/dial). No-op when there is no primary control. */
  onPrimary?: (vm: ActiveActionViewModel) => void
}

export function ActiveActionCard({ vm, onPrimary }: Props) {
  if (!vm.visible || !vm.cardId) return null
  const isCall = vm.kind === 'call'

  return (
    <div
      data-testid="active-action-card"
      data-card-id={vm.cardId}
      data-revision={vm.revision}
      data-kind={vm.kind}
      data-status={vm.status}
      role="group"
      aria-label={vm.a11y}
      style={{
        width: '100%', maxWidth: 420, marginTop: 8, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10, direction: 'rtl',
        borderRadius: 18, background: 'rgba(10,18,36,0.72)',
        border: `1.5px solid ${isCall ? 'rgba(46,230,122,0.30)' : 'rgba(37,211,102,0.28)'}`,
        borderTop: `3px solid ${isCall ? CALL_GREEN : WA_GREEN}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>{isCall ? '📞' : '📱'}</span>
        <span data-testid="active-action-recipient" style={{
          fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.94)', fontFamily: "'Heebo',sans-serif",
        }}>
          {vm.recipientLabel ?? (isCall ? 'למי להתקשר?' : 'למי לשלוח?')}
        </span>
      </div>

      {/* Status line — the a11y announcement, visible (never a completion claim). */}
      <div data-testid="active-action-status" style={{
        fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)', fontFamily: "'Heebo',sans-serif",
      }}>
        {vm.a11y}
      </div>

      {vm.primaryControl && (
        <button
          type="button"
          data-testid="active-action-primary"
          onClick={() => onPrimary?.(vm)}
          style={{
            width: '100%', height: 54, borderRadius: 16, border: 'none',
            background: `linear-gradient(145deg, ${CALL_GREEN}, ${WA_GREEN}, #128C7E)`,
            color: 'white', fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {isCall ? '📞' : '📱'} {vm.primaryControl}
        </button>
      )}

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: "'DM Sans',sans-serif", direction: 'ltr' }}>
        rev {vm.revision} · {isCall ? 'לא מתקשר אוטומטית' : 'לא נשלח אוטומטית'}
      </div>
    </div>
  )
}
