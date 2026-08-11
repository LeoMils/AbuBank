/*
 * AbuLogo — the per-app Abu logo family (M4), one system.
 * ════════════════════════════════════════════════════════════════════════════
 * A real graphic mark, not text. Every app shares the SAME construction — a
 * luminous circular emblem on the deep Night-Garden dark, a thin accent rim, and
 * the CONSTANT "Abu spark" (a small four-point star, top-right) — so the seven are
 * unmistakably one family. Only the inner glyph + accent colour change per app.
 * Delivered as SVG so it is crisp everywhere the app is named.
 */
import type { CSSProperties } from 'react'

export type AbuAppId = 'ai' | 'news' | 'bank' | 'whatsapp' | 'weather' | 'games' | 'calendar'

/** Per-app accent — a "constellation colour" within the one Night-Garden system. */
export const APP_ACCENT: Record<AbuAppId, string> = {
  ai: '#FCD34D', news: '#FDBA74', bank: '#5EEAD4', whatsapp: '#4ADE80',
  weather: '#7DD3FC', games: '#FCA5A5', calendar: '#C4B5FD',
}

const STROKE = { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/** The distinct inner glyph per app (white line-art on the glow). */
function glyph(app: AbuAppId, accent: string): React.ReactNode {
  switch (app) {
    case 'ai': // a bright spark / intelligence
      return <path d="M12 6.5l1.3 3.9 3.9 1.3-3.9 1.3L12 17l-1.3-3.9L6.8 11.8l3.9-1.3z" fill="#FFFFFF" opacity="0.95" />
    case 'news': // a newspaper with headline + columns
      return <g {...STROKE}>
        <rect x="6.5" y="7" width="11" height="10" rx="1.2" />
        <line x1="8.4" y1="9.4" x2="13" y2="9.4" /><line x1="8.4" y1="11.6" x2="15.6" y2="11.6" />
        <line x1="8.4" y1="13.4" x2="15.6" y2="13.4" /><line x1="8.4" y1="15.2" x2="12.4" y2="15.2" />
      </g>
    case 'bank': // a classical column (pediment + pillars + base)
      return <g {...STROKE}>
        <path d="M6.5 9.2L12 6.4l5.5 2.8z" /><line x1="7.4" y1="10.6" x2="16.6" y2="10.6" />
        <line x1="9" y1="11" x2="9" y2="15.4" /><line x1="12" y1="11" x2="12" y2="15.4" /><line x1="15" y1="11" x2="15" y2="15.4" />
        <line x1="7.2" y1="16.2" x2="16.8" y2="16.2" />
      </g>
    case 'whatsapp': // a speech bubble with three dots
      return <g>
        <path d="M12 6.6a5.4 5.4 0 0 0-4.7 8.1L6.6 17.4l2.8-.7A5.4 5.4 0 1 0 12 6.6z" {...STROKE} />
        <circle cx="9.9" cy="12" r="0.9" fill="#FFFFFF" /><circle cx="12" cy="12" r="0.9" fill="#FFFFFF" /><circle cx="14.1" cy="12" r="0.9" fill="#FFFFFF" />
      </g>
    case 'weather': // a crescent + a small cloud (Night-Garden weather)
      return <g {...STROKE}>
        <path d="M13.6 7.2a3.4 3.4 0 1 0 1.2 5.2 4.2 4.2 0 0 1-1.2-5.2z" fill={accent} stroke="#FFFFFF" opacity="0.95" />
        <path d="M8.2 15.2a2 2 0 0 1 .3-3.98 2.6 2.6 0 0 1 5 .5 1.7 1.7 0 0 1-.2 3.48z" />
      </g>
    case 'games': // a die showing five
      return <g {...STROKE}>
        <rect x="7.2" y="7.2" width="9.6" height="9.6" rx="2" />
        <circle cx="9.7" cy="9.7" r="0.85" fill="#FFFFFF" /><circle cx="14.3" cy="9.7" r="0.85" fill="#FFFFFF" />
        <circle cx="12" cy="12" r="0.85" fill="#FFFFFF" />
        <circle cx="9.7" cy="14.3" r="0.85" fill="#FFFFFF" /><circle cx="14.3" cy="14.3" r="0.85" fill="#FFFFFF" />
      </g>
    case 'calendar': // a calendar page with rings + a marked day
      return <g {...STROKE}>
        <rect x="6.8" y="7.6" width="10.4" height="9.4" rx="1.4" /><line x1="6.8" y1="10.4" x2="17.2" y2="10.4" />
        <line x1="9.4" y1="6.4" x2="9.4" y2="8.4" /><line x1="14.6" y1="6.4" x2="14.6" y2="8.4" />
        <circle cx="12" cy="13.6" r="1.5" fill={accent} stroke="#FFFFFF" />
      </g>
  }
}

export function AbuLogo({ app, size = 64, style }: { app: AbuAppId; size?: number; style?: CSSProperties }) {
  const accent = APP_ACCENT[app]
  const gid = `abu-glow-${app}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={`Abu ${app}`} style={style}>
      <defs>
        <radialGradient id={gid} cx="42%" cy="36%" r="62%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* emblem disc: deep base + accent glow + thin accent rim (the shared frame) */}
      <circle cx="12" cy="12" r="11" fill="#0B1226" />
      <circle cx="12" cy="12" r="11" fill={`url(#${gid})`} />
      <circle cx="12" cy="12" r="11" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.6" />
      {glyph(app, accent)}
      {/* the CONSTANT Abu spark — a small four-point star, top-right, same on every app */}
      <path d="M18.4 5.2l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" fill={accent} />
      <circle cx="18.4" cy="6.7" r="0.35" fill="#FFFFFF" />
    </svg>
  )
}
