/*
 * ActionCard — the generic action-card surface for the Abu live overlay.
 * ════════════════════════════════════════════════════════════════════════════
 * Part B governing rule: every action Abu prepares produces a VISIBLE card that IS
 * the receipt. One card at a time: a title, the body (recipient / message / event
 * fields), ONE large primary button, and a dismiss. Designed for an 80-year-old —
 * large type, high contrast, Hebrew RTL, ≥ 56px touch targets. No color-only state.
 *
 * The primary button is EITHER an external deep link (wa.me / tel: — a real <a> so
 * the OS handles it and the send/dial happens only on her tap) OR an in-session
 * confirm (calendar draft). It never claims the action happened.
 */
import type { LiveCard } from '../../services/liveActionCards'

const GOLD = '#C9A84C'
const WA_GREEN = '#25D366'
const CALL_RED = '#D83A3A'
const INK = '#0c1f33'
const CARD_BG = '#0e1830'
const TEXT = '#F5F3EC'

function primaryColor(kind: LiveCard['kind']): string {
  if (kind === 'whatsapp') return WA_GREEN
  if (kind === 'call') return CALL_RED
  return GOLD
}

export function ActionCard({
  card, onDismiss, onConfirm,
}: {
  card: LiveCard
  onDismiss: () => void
  onConfirm?: () => void
}) {
  const accent = primaryColor(card.kind)
  const btnStyle: React.CSSProperties = {
    display: 'block', width: '100%', minHeight: 68, borderRadius: 18, border: 'none',
    background: accent, color: card.kind === 'calendar-draft' || card.kind === 'calendar-receipt' ? '#1a1200' : '#04210f',
    fontSize: 24, fontWeight: 800, cursor: 'pointer', textDecoration: 'none',
    lineHeight: '68px', textAlign: 'center', boxShadow: `0 6px 20px ${accent}55`,
  }
  return (
    <div
      dir="rtl"
      role="dialog"
      aria-label={card.title}
      data-testid="live-action-card"
      data-card-kind={card.kind}
      style={{
        width: 'min(92vw, 460px)', background: CARD_BG, color: TEXT,
        border: `1px solid ${accent}66`, borderRadius: 24, padding: 24,
        boxShadow: '0 18px 60px rgba(0,0,0,0.55)', textAlign: 'right',
        fontFamily: "'DM Sans','Heebo',system-ui,sans-serif",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginBottom: 14 }}>{card.title}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {card.lines.filter(Boolean).map((line, i) => (
          <div key={i} style={{ fontSize: i === 1 && card.kind === 'whatsapp' ? 22 : 20, lineHeight: 1.5, color: TEXT, wordBreak: 'break-word' }}>
            {line}
          </div>
        ))}
      </div>

      {card.disabledReason ? (
        <div
          data-testid="live-action-card-disabled"
          style={{ minHeight: 68, borderRadius: 18, border: `1px solid ${INK}`, background: 'rgba(255,255,255,0.05)', color: '#FCA5A5', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', textAlign: 'center' }}
        >
          {card.disabledReason}
        </div>
      ) : card.primaryHref ? (
        <a
          href={card.primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="live-action-card-primary"
          style={btnStyle}
        >
          {card.primaryLabel}
        </a>
      ) : card.primaryAction === 'confirm-calendar' ? (
        <button data-testid="live-action-card-primary" onClick={onConfirm} style={{ ...btnStyle, lineHeight: 'normal' }}>
          {card.primaryLabel}
        </button>
      ) : null}

      <button
        onClick={onDismiss}
        data-testid="live-action-card-dismiss"
        style={{
          display: 'block', width: '100%', minHeight: 56, marginTop: 12, borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: TEXT,
          fontSize: 20, fontWeight: 700, cursor: 'pointer',
        }}
      >
        סגירה
      </button>
    </div>
  )
}
