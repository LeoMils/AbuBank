/*
 * AbuBank P0.3 — diagnostic visibility / always-render tests.
 *
 * Source-contract tests pin the new visibility rules:
 *  1. DiagnosticPanel renders the title + version + summary BEFORE any
 *     async health check resolves.
 *  2. Copy button works with a partial report (URL + UA + timestamp +
 *     fetch error included).
 *  3. Force-refresh button is always rendered, even if a check fails.
 *  4. Settings has a top-level "אבחון מערכת" button BEFORE the
 *     accordion sections — not buried in a collapsed About card.
 *  5. Home shows a visible "אבחון" pill near the version marker.
 *  6. App.tsx wires the ?diagnostics=1 / #diagnostics URL trigger AND
 *     a global window.__abubankOpenDiag() function for entry-point
 *     buttons.
 *  7. The DiagnosticOverlay component exists and wraps DiagnosticPanel
 *     in a full-screen surface.
 *  8. No secrets exposed by the new files.
 *  9. AbuWhatsApp / AbuGames source unchanged.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
}

const PANEL = read('components/DiagnosticPanel.tsx')
const OVERLAY = read('components/DiagnosticOverlay.tsx')
const APP = read('App.tsx')
const SETTINGS = read('screens/Settings/index.tsx')
const HOME = read('screens/Home/index.tsx')

// ─── 1) Panel renders identity BEFORE async checks ───────────────────────

describe('P0.3 — DiagnosticPanel renders title + version + buttons immediately', () => {
  it('has a title row that does not depend on the async report', () => {
    expect(PANEL.includes('data-testid="diag-title"')).toBe(true)
    expect(PANEL.includes('אבחון מערכת')).toBe(true)
  })

  it('renders the APP_VERSION.version line without waiting for /api/health', () => {
    // The version line MUST appear outside any `report &&` conditional.
    // We grep for the data-testid and confirm it's not gated.
    expect(PANEL.includes('data-testid="diag-version-line"')).toBe(true)
    // The summary block is also rendered immediately, not gated on `report`.
    expect(PANEL.includes('data-testid="diag-summary"')).toBe(true)
    // Sanity: the summary's "בודק…" placeholder is the default state.
    expect(PANEL.includes('בודק…')).toBe(true)
    expect(PANEL.includes("שרת")).toBe(true)
    expect(PANEL.includes("קול")).toBe(true)
    expect(PANEL.includes("קלנדר")).toBe(true)
  })

  it('the three action buttons (rerun, copy, force-refresh) are NOT gated on `report`', () => {
    // Find the buttons block and confirm none is wrapped in `report &&`.
    const rerunMatch = PANEL.indexOf('data-testid="diag-rerun"')
    const copyMatch  = PANEL.indexOf('data-testid="diag-copy"')
    const refMatch   = PANEL.indexOf('data-testid="diag-force-refresh"')
    expect(rerunMatch).toBeGreaterThan(-1)
    expect(copyMatch).toBeGreaterThan(-1)
    expect(refMatch).toBeGreaterThan(-1)
    // The 60-char window before each button must NOT contain `report &&`.
    for (const idx of [rerunMatch, copyMatch, refMatch]) {
      const before = PANEL.slice(Math.max(0, idx - 120), idx)
      expect(/report\s*&&\s*$/.test(before),
        `button at idx ${idx} appears gated on report`).toBe(false)
    }
  })

  it('copy button is enabled even when report is null (disabled prop missing)', () => {
    // Old code had `disabled={!report}` on the copy button. The fix removes it.
    expect(PANEL.includes('disabled={!report}')).toBe(false)
  })
})

// ─── 2) Copy includes partial report with URL/UA/timestamp/fetchError ─────

describe('P0.3 — copy diagnostic includes partial context', () => {
  it('partialReportJson collects url, userAgent, timestamp, SW support, fetch error', () => {
    expect(PANEL.includes('partialReportJson')).toBe(true)
    expect(PANEL.includes('userAgent')).toBe(true)
    expect(PANEL.includes('capturedAt')).toBe(true)
    expect(PANEL.includes('serviceWorkerSupported')).toBe(true)
    expect(PANEL.includes('apiHealthFetchError')).toBe(true)
    expect(PANEL.includes('fullReport')).toBe(true)
  })

  it('fetch error path keeps panel visible and copies anyway', () => {
    expect(PANEL.includes('data-testid="diag-fetch-error"')).toBe(true)
    // Copy button is rendered outside the report check.
    expect(/onClick=\{\(\) => void copyReport\(\)\}/.test(PANEL)).toBe(true)
  })

  it('clipboard fallback writes a prompt() when navigator.clipboard is unavailable', () => {
    expect(PANEL.includes("window.prompt('העתיקי את האבחון:'")).toBe(true)
  })
})

// ─── 3) Force refresh works even if checks failed ────────────────────────

describe('P0.3 — force refresh always reloads', () => {
  it('button exists with confirm + reload (even if SW unregister fails)', () => {
    expect(PANEL.includes('handleForceRefresh')).toBe(true)
    expect(PANEL.includes('window.confirm')).toBe(true)
    expect(PANEL.includes('window.location.reload()')).toBe(true)
  })
})

// ─── 4) Settings has a TOP-LEVEL diagnostic button (before accordion) ────

describe('P0.3 — Settings top-level diagnostic entry point', () => {
  it('contains a visible "אבחון מערכת" button BEFORE the accordion sections', () => {
    expect(SETTINGS.includes('data-testid="settings-diagnostic-button"')).toBe(true)
    expect(SETTINGS.includes('אבחון מערכת')).toBe(true)
    expect(SETTINGS.includes('בדיקת API, גרסה, קול וקלנדר')).toBe(true)
    // The top-level button must appear in source BEFORE sectionsData.map.
    const buttonIdx = SETTINGS.indexOf('data-testid="settings-diagnostic-button"')
    const sectionsIdx = SETTINGS.indexOf('sectionsData.map(section =>')
    expect(buttonIdx).toBeGreaterThan(-1)
    expect(sectionsIdx).toBeGreaterThan(-1)
    expect(buttonIdx).toBeLessThan(sectionsIdx)
  })

  it('the About card no longer renders the inline DiagnosticPanel (moved to overlay)', () => {
    expect(SETTINGS.includes('<DiagnosticPanel />')).toBe(false)
    // It now has a smaller "אבחון מערכת" button inside About that opens
    // the overlay (so the path from About also works for users who tap there).
    expect(SETTINGS.includes('data-testid="about-diagnostic-button"')).toBe(true)
  })
})

// ─── 5) Home has a visible diagnostic pill ───────────────────────────────

describe('P0.3 — Home diagnostic pill', () => {
  it('Home renders a tappable "אבחון" pill near the QA version marker', () => {
    expect(HOME.includes('data-testid="home-diagnostic-pill"')).toBe(true)
    // The pill text is "אבחון" — short, fits in a Hebrew header.
    expect(HOME.includes('>אבחון</button>')).toBe(true)
    // It must call window.__abubankOpenDiag().
    expect(HOME.includes('__abubankOpenDiag')).toBe(true)
  })
})

// ─── 6) App wires URL trigger + global open function ─────────────────────

describe('P0.3 — App.tsx wires URL trigger + global function', () => {
  it('reads ?diagnostics=1 / ?diagnostic=1 / #diagnostics from window.location', () => {
    expect(APP.includes("'diagnostics'")).toBe(true)
    expect(APP.includes("'diagnostic'")).toBe(true)
    expect(APP.includes("'#diagnostics'")).toBe(true)
    expect(APP.includes("'#diagnostic'")).toBe(true)
  })

  it('listens for hashchange so deep links open the overlay live', () => {
    expect(APP.includes("addEventListener('hashchange'")).toBe(true)
  })

  it('exposes window.__abubankOpenDiag as a global trigger for entry-point buttons', () => {
    expect(APP.includes('__abubankOpenDiag')).toBe(true)
  })

  it('renders <DiagnosticOverlay> when diagOpen is true', () => {
    expect(APP.includes('<DiagnosticOverlay')).toBe(true)
    expect(APP.includes('{diagOpen && <DiagnosticOverlay')).toBe(true)
  })
})

// ─── 7) Overlay component ────────────────────────────────────────────────

describe('P0.3 — DiagnosticOverlay full-screen component', () => {
  it('exists, is full-screen (position: fixed, inset: 0), and wraps DiagnosticPanel', () => {
    expect(OVERLAY.includes('data-testid="diagnostic-overlay"')).toBe(true)
    expect(OVERLAY.includes("position: 'fixed'")).toBe(true)
    expect(OVERLAY.includes('inset: 0')).toBe(true)
    expect(OVERLAY.includes('<DiagnosticPanel />')).toBe(true)
  })

  it('has a close button with aria-label="סגירה"', () => {
    expect(OVERLAY.includes('data-testid="diag-overlay-close"')).toBe(true)
    expect(OVERLAY.includes('aria-label="סגירה"')).toBe(true)
  })

  it('clicking the backdrop closes via onClose; clicks inside the card stop propagation', () => {
    expect(OVERLAY.includes('onClick={onClose}')).toBe(true)
    expect(OVERLAY.includes('e.stopPropagation()')).toBe(true)
  })
})

// ─── 8) Secret hygiene + scope ──────────────────────────────────────────

describe('P0.3 — secret hygiene + scope envelope', () => {
  it('DiagnosticPanel never reads import.meta.env.X for any X', () => {
    // The transcription-key check is delegated to platformHealth.ts,
    // where it only reads presence. The panel itself must not.
    expect(/import\.meta\.env\.[A-Z_]+/.test(PANEL)).toBe(false)
  })

  it('No production source under AbuAI reads VITE_OPENAI_API_KEY', () => {
    const ABUAI = path.resolve(ROOT, 'screens', 'AbuAI')
    const FORBIDDEN = ['VITE', '_OPENAI', '_API_KEY'].join('')
    for (const f of fs.readdirSync(ABUAI)) {
      if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      expect(src.includes(FORBIDDEN), `${f} reads ${FORBIDDEN}`).toBe(false)
    }
  })

  it('AbuAI useRealtime still false', () => {
    const src = fs.readFileSync(path.resolve(ROOT, 'screens', 'AbuAI', 'index.tsx'), 'utf8')
    expect(src.includes('const useRealtime = false')).toBe(true)
  })

  it('AbuWhatsApp / AbuGames screens do not import DiagnosticPanel or DiagnosticOverlay', () => {
    for (const dir of ['AbuWhatsApp', 'AbuGames']) {
      const base = path.resolve(ROOT, 'screens', dir)
      if (!fs.existsSync(base)) continue
      for (const f of fs.readdirSync(base)) {
        if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
        if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
        const src = fs.readFileSync(path.join(base, f), 'utf8')
        expect(src.includes('DiagnosticPanel'), `${dir}/${f} imports DiagnosticPanel`).toBe(false)
        expect(src.includes('DiagnosticOverlay'), `${dir}/${f} imports DiagnosticOverlay`).toBe(false)
      }
    }
  })
})

// ─── 9) APP_VERSION + buildLabel surfaced in panel ───────────────────────

describe('P0.3 — APP_VERSION fields surfaced in DiagnosticPanel', () => {
  it('references APP_VERSION.version / buildLabel / commitHint / buildDate / branchHint', () => {
    expect(PANEL.includes('APP_VERSION.version')).toBe(true)
    expect(PANEL.includes('APP_VERSION.buildLabel')).toBe(true)
    expect(PANEL.includes('APP_VERSION.commitHint')).toBe(true)
    expect(PANEL.includes('APP_VERSION.buildDate')).toBe(true)
    expect(PANEL.includes('APP_VERSION.branchHint')).toBe(true)
  })
})
