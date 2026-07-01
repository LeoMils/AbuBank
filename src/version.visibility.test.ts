/**
 * Version visibility — proves Leo can confirm the running build.
 * The version flows: src/version.ts (APP_VERSION) → store.appVersion → visible in
 * Home (QA badge) and Settings (About). HIGH evidence for the export/store chain;
 * MEDIUM (source contract) for the two render sites.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { APP_VERSION } from './version'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8')

describe('version is exported + visible', () => {
  it('APP_VERSION.version is a non-empty semver-ish string', () => {
    expect(typeof APP_VERSION.version).toBe('string')
    expect(APP_VERSION.version.length).toBeGreaterThan(3)
    expect(APP_VERSION.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(APP_VERSION.appName).toBe('AbuBank')
  })

  it('the Zustand store initializes appVersion from APP_VERSION.version', () => {
    const store = read('./state/store.ts')
    expect(store).toMatch(/appVersion:\s*APP_VERSION\.version/)
  })

  it('Home renders a visible version badge sourced from appVersion', () => {
    const home = read('./screens/Home/index.tsx')
    expect(home).toContain('data-testid="home-qa-version"')
    expect(home).toMatch(/QA: v\{appVersion\}/)
    expect(home).toMatch(/const appVersion = useAppStore\(s => s\.appVersion\)/)
  })

  it('Settings About shows the build label + version + branch', () => {
    const settings = read('./screens/Settings/index.tsx')
    expect(settings).toContain("import { APP_VERSION }")
    expect(settings).toMatch(/APP_VERSION\.buildLabel.*APP_VERSION\.version/s)
    expect(settings).toContain('APP_VERSION.branchHint')
  })

  it('platformHealth exposes appVersion for the health/diagnostic surface', () => {
    const ph = read('./services/platformHealth.ts')
    expect(ph).toMatch(/appVersion:\s*APP_VERSION\.version/)
  })
})
