/*
 * ScreenHeader — the shared Abu-ela app header (BackButton + "Abu <name>" title).
 * ════════════════════════════════════════════════════════════════════════════
 * One header for every app inside the hub: an always-visible way back plus the
 * brand-family title (gold italic "Abu" + the app name). Replaces the per-screen
 * inline headers so every app looks like one product, not seven.
 */
import type { ReactNode } from 'react'
import { BackButton } from '../BackButton'
import { GOLD, TEXT_STRONG } from '../../design/colors'
import { FONT_DISPLAY } from '../../design/typography'
import { space } from '../../design/space'

export function ScreenHeader({ name, accent = GOLD, right }: { name: string; accent?: string; right?: ReactNode }) {
  return (
    <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: space.md, padding: `${space.lg}px ${space.lg}px ${space.sm}px` }}>
      <BackButton />
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT_STRONG, letterSpacing: '0.3px', display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ color: accent, fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 27 }}>Abu</span>
        <span>{name}</span>
      </h1>
      {right && <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center' }}>{right}</div>}
    </header>
  )
}
