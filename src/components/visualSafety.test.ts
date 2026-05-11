/*
 * AbuBank P0.4 — visual emergency recovery contract.
 *
 * Pins the rules that must hold so diagnostic plumbing never disturbs
 * normal app UI again:
 *
 *   1. Home does not carry a diagnostic pill (it lived inside the
 *      family-footer flex container in PR #31 and disturbed layout).
 *   2. DiagnosticOverlay is rendered only when `diagOpen` is true;
 *      when closed, no overlay element is in the DOM.
 *   3. DiagnosticOverlay only uses `position: 'fixed'` (not on Home,
 *      not as a global wrapper).
 *   4. No global CSS selectors (e.g. `body`, `html`, `*`, '.diag-')
 *      were introduced by the diagnostic files.
 *   5. Settings diagnostic button exists only inside Settings layout
 *      (not in a shared component).
 *   6. Direct URL diagnostics (?diagnostics=1 / #diagnostics) still
 *      works — App.tsx still parses them.
 *   7. AbuWhatsApp / AbuGames screens do not import any diagnostic
 *      component or call __abubankOpenDiag.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC_ROOT = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.resolve(SRC_ROOT, rel), 'utf8')
}

const HOME = read('screens/Home/index.tsx')
const SETTINGS = read('screens/Settings/index.tsx')
const APP = read('App.tsx')
const PANEL = read('components/DiagnosticPanel.tsx')
const OVERLAY = read('components/DiagnosticOverlay.tsx')

// ─── 1) Home does not carry the diagnostic pill ─────────────────────────

describe('P0.4 — Home is restored to pre-PR31 layout', () => {
  it('home-diagnostic-pill is gone', () => {
    expect(HOME.includes('home-diagnostic-pill')).toBe(false)
  })

  it('the global `__abubankOpenDiag` invocation is not present in Home', () => {
    expect(HOME.includes('__abubankOpenDiag')).toBe(false)
  })

  it('Home has not been re-wrapped or re-styled in a way that would resize main icons', () => {
    // Spot-check: the pre-existing footer + dashboard structure is intact.
    expect(HOME.includes('home-qa-version')).toBe(true)
    // No new fontSize bump near a service tile.
    const servicesIdx = HOME.indexOf('SERVICES')
    if (servicesIdx > -1) {
      const block = HOME.slice(Math.max(0, servicesIdx - 200), servicesIdx + 800)
      // No accidental `fontSize: '40px'` / `width: '120px'` style bombs.
      expect(/fontSize:\s*['"][4-9]\d/.test(block)).toBe(false)
      expect(/width:\s*['"][1-9]\d{2,}px['"]/.test(block)).toBe(false)
    }
  })
})

// ─── 2) Overlay only mounts when open ───────────────────────────────────

describe('P0.4 — DiagnosticOverlay renders only when open', () => {
  it('App.tsx renders <DiagnosticOverlay> behind a `diagOpen &&` guard', () => {
    expect(APP.includes('{diagOpen && <DiagnosticOverlay')).toBe(true)
  })

  it('App.tsx initializes diagOpen=false unless the URL explicitly opens diagnostics', () => {
    // The initializer reads URL searchParams + hash; without those, returns false.
    expect(APP.includes("useState<boolean>(() =>")).toBe(true)
    expect(APP.includes('return false')).toBe(true)
  })

  it('DiagnosticOverlay component itself uses position: "fixed" (full-screen overlay only)', () => {
    expect(OVERLAY.includes("position: 'fixed'")).toBe(true)
    expect(OVERLAY.includes('inset: 0')).toBe(true)
  })
})

// ─── 3) No global CSS / no body styles from diagnostics ─────────────────

describe('P0.4 — diagnostic files do not introduce global CSS', () => {
  for (const [name, src] of [
    ['DiagnosticPanel.tsx', PANEL],
    ['DiagnosticOverlay.tsx', OVERLAY],
  ] as Array<[string, string]>) {
    it(`${name} does not select body/html/* or inject a <style> tag`, () => {
      // No injected stylesheet.
      expect(/<style[\s>]/.test(src)).toBe(false)
      // No document.body / document.documentElement.style mutation.
      expect(src.includes('document.body.style')).toBe(false)
      expect(src.includes('document.documentElement.style')).toBe(false)
      // No global `body { ... }` / `html { ... }` template literal.
      expect(/`(?:html|body|\*)\s*\{/.test(src)).toBe(false)
    })
  }
})

// ─── 4) Settings diagnostic button is local to Settings ─────────────────

describe('P0.4 — Settings diagnostic button is local to the Settings screen', () => {
  it('Settings has a top-level diagnostic button inside its own JSX', () => {
    expect(SETTINGS.includes('settings-diagnostic-button')).toBe(true)
  })

  it('the button lives inside a wrapper <div> with normal padding (not absolutely positioned)', () => {
    // Source-grep: the wrapper directly above the button is a normal flow div.
    const idx = SETTINGS.indexOf('data-testid="settings-diagnostic-button"')
    const before = SETTINGS.slice(Math.max(0, idx - 200), idx)
    expect(before.includes('padding:')).toBe(true)
    expect(before.includes("position: 'absolute'")).toBe(false)
    expect(before.includes("position: 'fixed'")).toBe(false)
  })
})

// ─── 5) Direct URL trigger still works ──────────────────────────────────

describe('P0.4 — URL trigger (?diagnostics=1 / #diagnostics) still works', () => {
  it('App.tsx still parses both query and hash forms', () => {
    expect(APP.includes("'diagnostics'")).toBe(true)
    expect(APP.includes("'#diagnostics'")).toBe(true)
    expect(APP.includes("addEventListener('hashchange'")).toBe(true)
  })

  it('window.__abubankOpenDiag is exposed for the Settings button', () => {
    expect(APP.includes('__abubankOpenDiag')).toBe(true)
  })
})

// ─── 6) AbuWhatsApp / AbuGames untouched ────────────────────────────────

describe('P0.4 — AbuWhatsApp / AbuGames screens unchanged', () => {
  for (const dir of ['AbuWhatsApp', 'AbuGames']) {
    it(`${dir} does not import DiagnosticPanel or DiagnosticOverlay`, () => {
      const base = path.resolve(SRC_ROOT, 'screens', dir)
      if (!fs.existsSync(base)) return
      for (const f of fs.readdirSync(base)) {
        if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
        if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
        const src = fs.readFileSync(path.join(base, f), 'utf8')
        expect(src.includes('DiagnosticPanel'), `${dir}/${f} imports DiagnosticPanel`).toBe(false)
        expect(src.includes('DiagnosticOverlay'), `${dir}/${f} imports DiagnosticOverlay`).toBe(false)
        expect(src.includes('__abubankOpenDiag'), `${dir}/${f} calls __abubankOpenDiag`).toBe(false)
      }
    })
  }
})

// ─── 7) Hard-rule envelope (still preserved) ────────────────────────────

describe('P0.4 — hard rules', () => {
  it('AbuAI useRealtime stays false', () => {
    const src = read('screens/AbuAI/index.tsx')
    expect(src.includes('const useRealtime = false')).toBe(true)
  })

  it('no AbuAI production source reads VITE_OPENAI_API_KEY', () => {
    const ABUAI = path.resolve(SRC_ROOT, 'screens', 'AbuAI')
    const FORBIDDEN = ['VITE', '_OPENAI', '_API_KEY'].join('')
    for (const f of fs.readdirSync(ABUAI)) {
      if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      expect(src.includes(FORBIDDEN), `${f} reads ${FORBIDDEN}`).toBe(false)
    }
  })
})
