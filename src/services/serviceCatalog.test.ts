import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { LAUNCHER_SERVICES, type LauncherService } from './serviceCatalog'
import { SERVICES as HOME_SERVICES } from '../screens/Home/data'
import { IMMUTABLE_DEFAULTS } from '../state/defaults'

const PROJECT_ROOT = path.resolve(__dirname, '../..')

describe('serviceCatalog (single source of truth)', () => {
  it('contains exactly 9 services', () => {
    expect(LAUNCHER_SERVICES.length).toBe(9)
  })

  it('every service has id, Hebrew/Latin label, https url, and logo path', () => {
    for (const s of LAUNCHER_SERVICES) {
      expect(typeof s.id).toBe('string')
      expect(s.id.length).toBeGreaterThan(0)
      expect(typeof s.label).toBe('string')
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.url.startsWith('https://')).toBe(true)
      expect(typeof s.logo).toBe('string')
      expect(s.logo.startsWith('/logos/')).toBe(true)
    }
  })

  it('has no duplicate service ids', () => {
    const ids = LAUNCHER_SERVICES.map((s) => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('uses canonical persisted ids matching IndexedDB shape', () => {
    const expected: Array<LauncherService['id']> = [
      'mizrahi', 'postalbank', 'max', 'water-ks', 'iec',
      'arnona-ks', 'hot-mobile', 'partner', 'yes',
    ]
    expect(LAUNCHER_SERVICES.map((s) => s.id)).toEqual(expected)
  })
})

describe('Home SERVICES derives from the catalog', () => {
  it('Home SERVICES === LAUNCHER_SERVICES (same reference, no copy)', () => {
    expect(HOME_SERVICES).toBe(LAUNCHER_SERVICES)
  })

  it('Home renders 9 launcher services for the 3×3 grid', () => {
    expect(HOME_SERVICES.length).toBe(9)
  })
})

describe('IMMUTABLE_DEFAULTS derives from the catalog', () => {
  it('IMMUTABLE_DEFAULTS has exactly 9 services', () => {
    expect(IMMUTABLE_DEFAULTS.length).toBe(9)
  })

  it('IMMUTABLE_DEFAULTS ids match LAUNCHER_SERVICES ids in the same order', () => {
    expect(IMMUTABLE_DEFAULTS.map((s) => s.id))
      .toEqual(LAUNCHER_SERVICES.map((s) => s.id))
  })

  it('IMMUTABLE_DEFAULTS labels match LAUNCHER_SERVICES labels', () => {
    expect(IMMUTABLE_DEFAULTS.map((s) => s.label))
      .toEqual(LAUNCHER_SERVICES.map((s) => s.label))
  })

  it('IMMUTABLE_DEFAULTS urls match LAUNCHER_SERVICES urls', () => {
    expect(IMMUTABLE_DEFAULTS.map((s) => s.url))
      .toEqual(LAUNCHER_SERVICES.map((s) => s.url))
  })

  it('IMMUTABLE_DEFAULTS entries carry an iconPath field for the ServiceConfig contract', () => {
    for (const s of IMMUTABLE_DEFAULTS) {
      expect(typeof s.iconPath).toBe('string')
    }
  })
})

describe('catalog ↔ Home / IMMUTABLE_DEFAULTS consistency', () => {
  it('Home and IMMUTABLE_DEFAULTS use the same canonical id order', () => {
    expect(HOME_SERVICES.map((s) => s.id))
      .toEqual(IMMUTABLE_DEFAULTS.map((s) => s.id))
  })

  it('no service id is a legacy short form (no postal/arnona/water/hot)', () => {
    const legacy = new Set(['postal', 'arnona', 'water', 'hot'])
    for (const s of LAUNCHER_SERVICES) {
      expect(legacy.has(s.id)).toBe(false)
    }
  })

  it('no service has missing or empty label / url / logo', () => {
    for (const s of LAUNCHER_SERVICES) {
      expect(s.label.trim().length).toBeGreaterThan(0)
      expect(s.url.trim().length).toBeGreaterThan(0)
      expect(s.logo.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('catalog logo paths exist on disk', () => {
  for (const s of LAUNCHER_SERVICES) {
    it(`${s.id}: logo file exists under public/`, () => {
      // logo paths are absolute web paths like '/logos/foo.png'.
      const fsPath = path.join(PROJECT_ROOT, 'public', s.logo.replace(/^\/+/, ''))
      expect(fs.existsSync(fsPath)).toBe(true)
    })
  }
})

describe('launcher contract — no services[8] / "more" coupling', () => {
  // Static-source guard: these checks fail loudly if any future patch
  // re-introduces the index-8 special case the catalog contract forbids.
  function readSrc(rel: string): string {
    return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8')
  }

  it('App.tsx does not index services[8]', () => {
    const src = readSrc('src/App.tsx')
    expect(src.includes('services[8]')).toBe(false)
  })

  it('App.tsx does not import or render MoreModal as a launcher path', () => {
    const src = readSrc('src/App.tsx')
    expect(/from\s+['"][^'"]*MoreModal[^'"]*['"]/.test(src)).toBe(false)
    expect(src.includes('<MoreModal')).toBe(false)
  })

  it('Home/index.tsx renders SERVICES via .map (no overflow/more split)', () => {
    const src = readSrc('src/screens/Home/index.tsx')
    expect(/SERVICES\.map\s*\(/.test(src)).toBe(true)
    expect(src.includes('services[8]')).toBe(false)
  })
})
