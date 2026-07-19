/*
 * Version-truth contract.
 *
 * Single visible-version source: src/version.ts → APP_VERSION.version.
 * Package.json carries the npm semver (a separate release lane); that string
 * must NOT appear in any UI surface — Leo must always see the build label, not
 * the legacy npm version. The npm semver is read DYNAMICALLY from package.json
 * below so this guard can never drift as the package version is bumped.
 * See docs/engineering-os/VERSION_CONTRACT.md for the two-lane contract.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { APP_VERSION } from './version'

const PROJECT_ROOT = path.resolve(__dirname, '..')

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8')
}

const VISIBLE_UI_FILES = [
  'src/main.tsx',
  'src/App.tsx',
  'src/state/store.ts',
  'src/state/types.ts',
  'src/components/BottomBar/index.tsx',
  'src/screens/Home/index.tsx',
  'src/screens/Settings/index.tsx',
  'src/screens/Admin/index.tsx',
  'src/screens/AbuWhatsApp/index.tsx',
  'src/screens/AbuWhatsApp/familyQuickFaces.tsx',
  'src/screens/AbuWhatsApp/FamilyContactsSetup.tsx',
]

describe('APP_VERSION shape', () => {
  it('exposes version, buildLabel, buildDate, branchHint, commitHint', () => {
    expect(APP_VERSION.version).toBe('0.137.0-nightly-autopilot')
    expect(APP_VERSION.buildLabel).toBe('AbuBank — NIGHTLY_AUTOPILOT (Cycle 57 — LEDGER EXPANSION v3, session 1: the autopilot core). Built the invisible maintenance chain (Constitution §3/§4), CODE-provable, reusing the existing engines. LEDGER CURATOR (src/truth/ledgerCurator.ts + LedgerService.curate/undoCuration): dedupe identical facts, supersede a corrected value (latest wins, in place), reorder chronologically — NEVER deletes a fact; each substantive change is one Hebrew line and the whole curation is UNDOABLE. NIGHTLY CHAIN (src/eval/nightlyAutopilot.ts): runs the duel/guard corpus + the flight-recorder analyzer (weaknessMap → archetypes) + the curator, emits ONE Hebrew status line (🟢 הכל תקין / 🟠 נמצאו N דברים לתיקון) and, when items exist, a ready-made fix-the-queue prompt for Claude Code. LEO-ONLY NOTIFICATION (src/eval/notify.ts): email via raw fetch to Resend when RESEND_API_KEY + LEDGER_RECIPIENT exist, else the honest Leo-only status page — NOTHING is ever Martita-facing. SERVER CRON (api/cron/nightly.ts, nodejs runtime, + vercel.json crons 03:00) runs the server-safe curator and returns the status page. HONEST INFRA LIMITS (proven, not hidden): NO storage backend (KV/Postgres/Blob), NO email provider, NO deps addable (package.json gated) are provisioned here — so cloud-canonical persistence, real email, and guaranteed cron firing are DEFERRED; the endpoint + fallbacks are built and documented. Evidence: CODE — ledgerCurator 3/3, nightlyAutopilot 5/5, notify 4/4, cronNightly 2/2, full suite 11115 pass / 2 todo, typecheck + build. Deferred: cloud-canonical ledger store, full-person chapters, one-tap upload UI. Builds on 0.136.0.')
    expect(typeof APP_VERSION.buildDate).toBe('string')
    expect(APP_VERSION.buildDate.length).toBeGreaterThan(0)
    expect(typeof APP_VERSION.branchHint).toBe('string')
    expect(APP_VERSION.branchHint.length).toBeGreaterThan(0)
    expect(typeof APP_VERSION.commitHint).toBe('string')
    expect(APP_VERSION.commitHint.length).toBeGreaterThan(0)
  })
})

describe('canonical version identity is single-sourced and health stays in sync', () => {
  it('api/health.ts BUILD_VERSION matches APP_VERSION.version (no manual drift)', () => {
    const health = readSrc('api/health.ts')
    const mVer = health.match(/const BUILD_VERSION = '([^']+)'/)
    const mLabel = health.match(/const BUILD_LABEL = '([^']+)'/)
    expect(mVer).not.toBeNull()
    expect(mLabel).not.toBeNull()
    expect(mVer![1]).toBe(APP_VERSION.version)
    expect(mLabel![1]).toBe(APP_VERSION.buildLabel)
  })

  it('buildDate and branchHint are not the known-stale placeholders', () => {
    expect(APP_VERSION.buildDate).not.toBe('2026-06-11')
    expect(APP_VERSION.branchHint).not.toBe('feat/calendar-revolution')
  })
})

// The npm semver is read live from package.json so this guard tracks the
// current value (e.g. 30.14.0) instead of a hardcoded literal that goes stale.
const NPM_SEMVER = (JSON.parse(readSrc('package.json')) as { version: string }).version

describe('no visible UI source hardcodes the npm semver', () => {
  it('the npm semver is a real semver string and differs from the visible build version', () => {
    expect(/^\d+\.\d+\.\d+/.test(NPM_SEMVER)).toBe(true)
    // The two version lanes are intentionally distinct (see VERSION_CONTRACT.md).
    expect(NPM_SEMVER).not.toBe(APP_VERSION.version)
  })
  for (const rel of VISIBLE_UI_FILES) {
    it(`${rel} does not include the npm semver "${NPM_SEMVER}"`, () => {
      const src = readSrc(rel)
      expect(src.includes(NPM_SEMVER)).toBe(false)
    })
  }
})

describe('store.appVersion is sourced from APP_VERSION (not VITE_APP_VERSION)', () => {
  const storeSrc = readSrc('src/state/store.ts')

  it('imports APP_VERSION', () => {
    expect(/from\s+['"]\.\.\/version['"]/.test(storeSrc)).toBe(true)
    expect(storeSrc.includes('APP_VERSION')).toBe(true)
  })

  it('initial state assigns appVersion: APP_VERSION.version', () => {
    expect(/appVersion:\s*APP_VERSION\.version/.test(storeSrc)).toBe(true)
  })

  it('does not fall back to import.meta.env.VITE_APP_VERSION for visible appVersion', () => {
    // VITE_APP_VERSION may still appear in vite-env.d.ts / vite.config.ts but
    // must not appear as the store.appVersion source any more.
    expect(/appVersion:\s*import\.meta\.env\.VITE_APP_VERSION/.test(storeSrc)).toBe(false)
  })
})

describe('visible UI surfaces show the new build version', () => {
  it('Home renders the QA build marker via APP_VERSION-derived appVersion', () => {
    const homeSrc = readSrc('src/screens/Home/index.tsx')
    expect(homeSrc.includes('home-qa-version')).toBe(true)
    expect(homeSrc.includes('QA: v')).toBe(true)
    // No more hardcoded git hash either.
    expect(homeSrc.includes('382e71f')).toBe(false)
  })

  it('Settings About panel still exposes APP_VERSION.buildLabel + version', () => {
    const settingsSrc = readSrc('src/screens/Settings/index.tsx')
    expect(settingsSrc.includes('settings-build-identity')).toBe(true)
    expect(settingsSrc.includes('APP_VERSION.buildLabel')).toBe(true)
    expect(settingsSrc.includes('APP_VERSION.version')).toBe(true)
  })

  it('AbuWhatsApp Martita-facing screen no longer surfaces the build version (clean header)', () => {
    // v0.4.x — the Martita header is now Title + Subtitle only. The build
    // version pill moved to operator-only surfaces.
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('abuwhatsapp-build-version')).toBe(false)
    // Operator setup still shows the build version (gated by ?operator=1).
    const setupSrc = readSrc('src/screens/AbuWhatsApp/FamilyContactsSetup.tsx')
    expect(setupSrc.includes('setup-build-version')).toBe(true)
    expect(setupSrc.includes('APP_VERSION.version')).toBe(true)
  })

  it('main.tsx logs APP_VERSION on startup', () => {
    const src = readSrc('src/main.tsx')
    expect(src.includes("console.info('[AbuBank Build]', APP_VERSION)")).toBe(true)
  })
})
