/*
 * AbuNews — the news app (real, grounded).
 * ════════════════════════════════════════════════════════════════════════════
 * A screen Martita opens to read what is happening: Israel-primary Hebrew headlines,
 * as many as the day warrants (dynamic count), each a scannable headline + a short
 * plain-Hebrew summary + its SOURCE and its TIME. Nothing appears without both.
 *
 * Honesty: stories come ONLY from the grounded /api/abuai-news retrieval (never model
 * memory). If retrieval fails, the screen says so plainly and shows NO stories —
 * never stale content dressed as fresh, never a fabricated headline/source.
 *
 * Senior-first: large type, generous spacing, high contrast, 56px+ targets. Reading
 * may scroll (this is a reading screen, not a primary no-scroll hub screen).
 */
import { useEffect, useState, useCallback } from 'react'
import { BackButton } from '../../components/BackButton'
import { fetchNews, type NewsResult } from './newsClient'
import { type NewsStory } from './newsTypes'
import { TEXT_STRONG, TEXT_MEDIUM, TEXT_MUTED, GOLD, GOLD_BORDER } from '../../design/colors'

type View = { phase: 'loading' } | { phase: 'ok'; result: Extract<NewsResult, { ok: true }> } | { phase: 'error'; message: string }

function timeLabel(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

export function AbuNews() {
  const [view, setView] = useState<View>({ phase: 'loading' })

  const load = useCallback(async () => {
    setView({ phase: 'loading' })
    const result = await fetchNews({ lang: 'he' })
    if (result.ok) setView({ phase: 'ok', result })
    else setView({ phase: 'error', message: result.userMessage })
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div dir="rtl" style={{
      height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #070D1E 0%, #050A18 40%, #050A18 100%)',
      fontFamily: "'Heebo','DM Sans',sans-serif", userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 8px' }}>
        <BackButton />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT_STRONG, display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ color: GOLD, fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic', fontSize: 27 }}>Abu</span>
          <span>News</span>
        </h1>
        <button
          type="button" onClick={() => void load()} aria-label="רענון החדשות"
          disabled={view.phase === 'loading'}
          style={{
            marginInlineStart: 'auto', minHeight: 48, minWidth: 56, padding: '8px 16px', borderRadius: 22,
            background: 'rgba(255,250,240,0.05)', border: `1px solid ${GOLD_BORDER}`, color: TEXT_MEDIUM,
            fontSize: 16, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
            cursor: view.phase === 'loading' ? 'default' : 'pointer', opacity: view.phase === 'loading' ? 0.5 : 1,
          }}
        >רענון ⟳</button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px 24px' }}>
        {view.phase === 'loading' && <Centered><p style={msg}>מביאה את החדשות של היום…</p></Centered>}

        {view.phase === 'error' && (
          <Centered>
            <div aria-hidden="true" style={{ fontSize: 48 }}>📰</div>
            <p style={{ ...msg, maxWidth: 360 }}>{view.message}</p>
            <button type="button" onClick={() => void load()} style={retryBtn}>לנסות שוב</button>
          </Centered>
        )}

        {view.phase === 'ok' && (
          <>
            {view.result.retrievedAt && (
              <p style={{ margin: '4px 2px 14px', fontSize: 15, fontWeight: 600, color: TEXT_MUTED, textAlign: 'center' }}>
                עודכן בשעה {timeLabel(view.result.retrievedAt)}
              </p>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {view.result.stories.map((s, i) => <StoryCard key={`${s.url}-${i}`} story={s} />)}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function StoryCard({ story }: { story: NewsStory }) {
  const [pressed, setPressed] = useState(false)
  const open = () => { if (story.url) window.location.href = story.url }
  return (
    <li>
      <button
        type="button" onClick={open}
        onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
        aria-label={`פתיחת הכתבה: ${story.headline}`}
        style={{
          width: '100%', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 8,
          padding: '18px 18px', borderRadius: 18, cursor: 'pointer',
          background: pressed ? 'rgba(255,250,240,0.09)' : 'rgba(255,250,240,0.05)',
          border: `1px solid ${GOLD_BORDER}`, transition: 'background 0.12s ease',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: 21, fontWeight: 800, color: TEXT_STRONG, lineHeight: 1.35 }}>{story.headline}</span>
        <span style={{ fontSize: 18, fontWeight: 500, color: TEXT_MEDIUM, lineHeight: 1.6 }}>{story.summary}</span>
        {/* Source + time — always both, never one without the other */}
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 2, fontSize: 15, fontWeight: 700, color: GOLD }}>
          <span>{story.source}</span>
          <span aria-hidden="true" style={{ color: TEXT_MUTED }}>·</span>
          <span style={{ color: TEXT_MUTED, fontWeight: 600 }}>{story.published}</span>
        </span>
      </button>
    </li>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
      {children}
    </div>
  )
}

const msg: React.CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_MEDIUM, lineHeight: 1.6 }
const retryBtn: React.CSSProperties = {
  minHeight: 56, padding: '14px 28px', borderRadius: 16, border: `1px solid ${GOLD_BORDER}`,
  background: 'rgba(201,168,76,0.10)', color: TEXT_STRONG, fontSize: 19, fontWeight: 800,
  fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
}
