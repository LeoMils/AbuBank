/*
 * theme.ts — themeable semantic tokens + the runtime switch (M4).
 * ════════════════════════════════════════════════════════════════════════════
 * `t.*` are var() references — use them in inline styles instead of hard-coded hex,
 * so a screen is theme-agnostic. setTheme('day') flips the whole product to the
 * light "Bright Day" palette by setting one attribute on <html>; no rebuild, no
 * re-render. Import '../design/theme.css' once (main.tsx) so the variables exist.
 */
export type ThemeName = 'night' | 'day'

/** CSS-variable token references. Use these in style objects: background: t.bg. */
export const t = {
  bg: 'var(--abu-bg)',
  bg2: 'var(--abu-bg-2)',
  bg3: 'var(--abu-bg-3)',
  surface: 'var(--abu-surface)',
  surfaceStrong: 'var(--abu-surface-strong)',
  textStrong: 'var(--abu-text-strong)',
  textMedium: 'var(--abu-text-medium)',
  textMuted: 'var(--abu-text-muted)',
  border: 'var(--abu-border)',
  borderStrong: 'var(--abu-border-strong)',
  gold: 'var(--abu-gold)',
  star: 'var(--abu-star)',
  scrim: 'var(--abu-scrim)',
  shadow: 'var(--abu-shadow)',
  accent: 'var(--abu-accent)',
} as const

/** The Night Garden page background — a deep nebula gradient (uses the themed vars). */
export const PAGE_BG = 'radial-gradient(120% 90% at 50% -10%, var(--abu-bg-2) 0%, var(--abu-bg) 55%, var(--abu-bg-3) 100%)'

const STORAGE_KEY = 'abu-theme'

/** Apply a theme (persists the choice). Safe outside the DOM (no-op). */
export function setTheme(name: ThemeName): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-abu-theme', name)
  try { localStorage.setItem(STORAGE_KEY, name) } catch { /* private mode */ }
}

/** The active theme (from the attribute, then storage, else the Night default). */
export function getTheme(): ThemeName {
  if (typeof document !== 'undefined') {
    const a = document.documentElement.getAttribute('data-abu-theme')
    if (a === 'day' || a === 'night') return a
    try { const s = localStorage.getItem(STORAGE_KEY); if (s === 'day' || s === 'night') return s } catch { /* */ }
  }
  return 'night'
}

/** Apply the persisted theme on boot (call once from main). Default = Night Garden. */
export function initTheme(): void {
  setTheme(getTheme())
}

export function toggleTheme(): ThemeName {
  const next: ThemeName = getTheme() === 'night' ? 'day' : 'night'
  setTheme(next)
  return next
}
