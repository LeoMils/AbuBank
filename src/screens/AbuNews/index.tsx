/*
 * AbuNews — the news app (PART 1: hub entry + honest shell).
 * ════════════════════════════════════════════════════════════════════════════
 * PART 1 gives Abu News its place in the hub and an always-visible way back. The
 * real retrieval (Israel-primary Hebrew headlines with source + time, read from a
 * grounded provider — never model memory) is PART 3. Until that lands this screen
 * tells the truth: it does NOT show invented or stale stories. An 80-year-old must
 * never be shown fabricated news — an empty honest state is correct, fake is not.
 *
 * Senior-first: large type, generous spacing, high contrast, 56px+ back target.
 */
import { BackButton } from '../../components/BackButton'
import { TEXT_STRONG, TEXT_MEDIUM, GOLD } from '../../design/colors'

export function AbuNews() {
  return (
    <div dir="rtl" style={{
      height: '100%', width: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #070D1E 0%, #050A18 40%, #050A18 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Heebo','DM Sans',sans-serif", userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 8px' }}>
        <BackButton />
        <h1 style={{
          margin: 0, fontSize: 24, fontWeight: 800, color: TEXT_STRONG, letterSpacing: '0.3px',
          display: 'flex', alignItems: 'baseline', gap: 7,
        }}>
          <span style={{ color: GOLD, fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic', fontSize: 27 }}>Abu</span>
          <span>News</span>
        </h1>
      </header>

      {/* Honest not-ready state — never fabricated headlines. */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: '0 28px', textAlign: 'center',
      }}>
        <div aria-hidden="true" style={{ fontSize: 56, lineHeight: 1 }}>📰</div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT_STRONG, lineHeight: 1.5 }}>
          החדשות עוד רגע כאן.
        </p>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: TEXT_MEDIUM, lineHeight: 1.6, maxWidth: 340 }}>
          אני עדיין מתחברת למקורות החדשות. ברגע שאתחבר תראי כאן כותרות אמיתיות עם המקור והשעה — לעולם לא משהו מומצא.
        </p>
      </div>
    </div>
  )
}
