/*
 * Release gate — submission-safety invariants.
 *
 * These guard blockers that have no other automated coverage and would
 * otherwise only surface as a user-visible failure:
 *   - a screen crash must fall back to the Hebrew recovery UI, never a blank
 *     screen (every interactive screen is wrapped in <ErrorBoundary>)
 *   - lazy screens must have a Suspense fallback (no blank during chunk load)
 *   - the PWA must auto-update and clean stale caches so a returning user is
 *     never stuck on an old bundle (the #1 "it works on my machine but the
 *     deployed app is stale" release hazard)
 *   - the build identity must be logged on boot for field debugging
 *
 * Source-contract style (no DOM-render infra in this repo), matching the
 * sibling version/privacy gate tests.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const PROJECT_ROOT = path.resolve(__dirname, '..')
function read(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8')
}

describe('release gate — crash safety (no blank screen)', () => {
  const appSrc = read('src/App.tsx')

  it('every interactive screen is wrapped in <ErrorBoundary>', () => {
    for (const screen of ['Home', 'AbuAI', 'AbuWhatsApp', 'AbuCalendar', 'Settings', 'AbuGames', 'AbuWeather', 'FamilyGallery', 'Admin']) {
      expect(
        new RegExp(`<ErrorBoundary><${screen} ?/>`).test(appSrc),
        `${screen} must be wrapped in <ErrorBoundary>`,
      ).toBe(true)
    }
  })

  it('lazy screens render behind a Suspense fallback (no blank during chunk load)', () => {
    expect(appSrc.includes('<Suspense fallback={<ScreenLoader />}>')).toBe(true)
    expect(/lazy\(\(\) => import\(/.test(appSrc)).toBe(true)
  })

  it('main.tsx wraps the whole app in <ErrorBoundary> and logs the build identity', () => {
    const mainSrc = read('src/main.tsx')
    expect(mainSrc.includes('<ErrorBoundary>')).toBe(true)
    expect(mainSrc.includes("console.info('[AbuBank Build]', APP_VERSION)")).toBe(true)
  })

  it('ErrorBoundary renders a Hebrew recovery UI with a home action and a full reload', () => {
    const ebSrc = read('src/components/ErrorBoundary/index.tsx')
    expect(ebSrc.includes('getDerivedStateFromError')).toBe(true)
    expect(ebSrc.includes('משהו לא עבד')).toBe(true)        // Hebrew, senior-friendly
    expect(ebSrc.includes('חזרה הביתה')).toBe(true)          // go-home recovery
    expect(ebSrc.includes('window.location.reload()')).toBe(true) // hard reload escape hatch
  })
})

describe('release gate — PWA freshness (no stale bundle)', () => {
  const viteSrc = read('vite.config.ts')

  it('service worker auto-updates and takes control immediately', () => {
    expect(viteSrc.includes("registerType: 'autoUpdate'")).toBe(true)
    expect(viteSrc.includes('cleanupOutdatedCaches: true')).toBe(true)
    expect(viteSrc.includes('skipWaiting: true')).toBe(true)
    expect(viteSrc.includes('clientsClaim: true')).toBe(true)
  })

  it('an explicit SW update path exists so a new build can prompt/refresh', () => {
    // useSWUpdate + UpdateToast give the user a "new version" path instead of
    // silently serving stale assets.
    expect(read('src/App.tsx').includes('useSWUpdate')).toBe(true)
  })
})
