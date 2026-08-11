/*
 * AbuNews — the news app (real, grounded) — built in the Abu-ela design system.
 * ════════════════════════════════════════════════════════════════════════════
 * A screen Martita opens to read what is happening: Israel-primary Hebrew headlines,
 * as many as the day warrants, each a scannable headline + a short plain-Hebrew
 * summary + its SOURCE and its TIME. Nothing appears without both.
 *
 * Honesty: stories come ONLY from the grounded /api/abuai-news retrieval (never model
 * memory). If retrieval fails, the screen says so plainly and shows NO stories.
 *
 * Design-system reference app: uses the shared ScreenHeader / Card / PrimaryButton
 * and the design tokens (space / radius / colours / type) — one system, not seven.
 */
import { useEffect, useState, useCallback } from 'react'
import { ScreenHeader } from '../../components/ui/ScreenHeader'
import { Card } from '../../components/ui/Card'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { fetchNews, type NewsResult } from './newsClient'
import { type NewsStory } from './newsTypes'
import { TEXT_STRONG, TEXT_MEDIUM, TEXT_MUTED, GOLD_BORDER } from '../../design/colors'
import { space } from '../../design/space'
import { PAGE_BG } from '../../design/theme'

const NEWS_ACCENT = '#FDBA74'

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

  const refresh = (
    <button
      type="button" onClick={() => void load()} aria-label="רענון החדשות" disabled={view.phase === 'loading'}
      style={{
        minHeight: 48, minWidth: 56, padding: `${space.sm}px ${space.lg}px`, borderRadius: 22,
        background: 'rgba(255,250,240,0.05)', border: `1px solid ${GOLD_BORDER}`, color: TEXT_MEDIUM,
        fontSize: 16, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
        cursor: view.phase === 'loading' ? 'default' : 'pointer', opacity: view.phase === 'loading' ? 0.5 : 1,
      }}
    >רענון ⟳</button>
  )

  return (
    <div dir="rtl" style={{
      height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
      background: PAGE_BG,
      fontFamily: "'Heebo','DM Sans',sans-serif", userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      <ScreenHeader name="News" accent={NEWS_ACCENT} right={refresh} app="news" />

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `${space.xs}px ${space.lg}px ${space.xl}px` }}>
        {view.phase === 'loading' && <Centered><p style={msg}>מביאה את החדשות של היום…</p></Centered>}

        {view.phase === 'error' && (
          <Centered>
            <div aria-hidden="true" style={{ fontSize: 48 }}>📰</div>
            <p style={{ ...msg, maxWidth: 360 }}>{view.message}</p>
            <PrimaryButton accent={NEWS_ACCENT} onClick={() => void load()}>לנסות שוב</PrimaryButton>
          </Centered>
        )}

        {view.phase === 'ok' && (
          <>
            {view.result.retrievedAt && (
              <p style={{ margin: `${space.xs}px 2px ${space.md}px`, fontSize: 15, fontWeight: 600, color: TEXT_MUTED, textAlign: 'center' }}>
                עודכן בשעה {timeLabel(view.result.retrievedAt)}
              </p>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: space.md }}>
              {view.result.stories.map((s, i) => <StoryCard key={`${s.url}-${i}`} story={s} />)}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function StoryCard({ story }: { story: NewsStory }) {
  return (
    <li>
      <Card accent={NEWS_ACCENT} onClick={() => { if (story.url) window.location.href = story.url }} ariaLabel={`פתיחת הכתבה: ${story.headline}`}>
        <span style={{ fontSize: 21, fontWeight: 800, color: TEXT_STRONG, lineHeight: 1.35 }}>{story.headline}</span>
        <span style={{ fontSize: 18, fontWeight: 500, color: TEXT_MEDIUM, lineHeight: 1.6 }}>{story.summary}</span>
        {/* Source + time — always both, never one without the other */}
        <span style={{ display: 'flex', gap: space.sm, alignItems: 'center', marginTop: 2, fontSize: 15, fontWeight: 700, color: NEWS_ACCENT }}>
          <span>{story.source}</span>
          <span aria-hidden="true" style={{ color: TEXT_MUTED }}>·</span>
          <span style={{ color: TEXT_MUTED, fontWeight: 600 }}>{story.published}</span>
        </span>
      </Card>
    </li>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: space.lg, textAlign: 'center' }}>
      {children}
    </div>
  )
}

const msg: React.CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_MEDIUM, lineHeight: 1.6 }
