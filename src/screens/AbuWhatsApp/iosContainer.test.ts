/*
 * iOS container identity + canonical-entry guard. Proves each classification, the
 * container-id lifecycle, and the mission's mutation cases (wrong-container import
 * allowed silently; browser mode falsely canonical; "not configured" for a
 * container mismatch; container id ignored; stable-host bypass).
 * Privacy: pinned-synthetic phone token only.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  detectEnvironment, classifyContainer, isImportBlockedForContainer,
  containerMessageHebrew, recommendedAction, getOrCreateContainerId, recordSaveContainer,
  type EnvProbe,
} from './iosContainer'
import { recordCommittedSave } from './contactStorageHealth'
import { LOCAL_FAMILY_CONTACTS_STORAGE_KEY as KEY } from './familyContactsStorage'

const P1 = '+972500000001'
const CANON = 'abu-ela-rc.vercel.app'
const envelope = (cs: unknown[]) => JSON.stringify({ v: 2, contacts: cs })

function fake(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed))
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)) }, removeItem: (k: string) => { m.delete(k) }, _m: m }
}
const cls = (s: ReturnType<typeof fake>, probe: EnvProbe) => classifyContainer(detectEnvironment(s, probe))

afterEach(() => { /* hermetic — injected storage */ })

describe('container classification', () => {
  it('NON_IOS_OK on desktop (not gated)', () => {
    const s = fake({ [KEY]: envelope([{ id: 'mor', enabled: true, phoneE164: P1 }]) })
    expect(cls(s, { isIOS: false, hostname: CANON, displayMode: 'browser' })).toBe('NON_IOS_OK')
  })
  it('CANONICAL_PWA on iOS installed PWA, canonical host', () => {
    const s = fake({ [KEY]: envelope([{ id: 'mor', enabled: true, phoneE164: P1 }]) })
    expect(cls(s, { isIOS: true, hostname: CANON, displayMode: 'standalone', iosStandalone: true })).toBe('CANONICAL_PWA')
  })
  it('SAFARI_BROWSER on iOS Safari tab, canonical host (wrong container)', () => {
    const s = fake({ [KEY]: envelope([]) })
    expect(cls(s, { isIOS: true, hostname: CANON, displayMode: 'browser', iosStandalone: false })).toBe('SAFARI_BROWSER')
  })
  it('WRONG_HOST on iOS, non-canonical host', () => {
    const s = fake({ [KEY]: envelope([]) })
    expect(cls(s, { isIOS: true, hostname: 'abu-bank-xyz.vercel.app', displayMode: 'standalone', iosStandalone: true })).toBe('WRONG_HOST')
  })
  it('UNKNOWN_IOS_CONTAINER when standalone cannot be determined', () => {
    const s = fake({ [KEY]: envelope([]) })
    // minimal-ui + no navigator.standalone signal
    expect(cls(s, { isIOS: true, hostname: CANON, displayMode: 'minimal-ui', iosStandalone: undefined })).toBe('UNKNOWN_IOS_CONTAINER')
  })
  it('POSSIBLE_EXTERNAL_STORAGE_LOSS: same container id, was saved, now empty (eviction, NOT mismatch)', () => {
    const s = fake({ [KEY]: envelope([]) })
    recordCommittedSave(3, s)      // high-water = 3 in THIS jar
    recordSaveContainer(s)         // last-save container = this container id
    // store now empty but same jar -> eviction
    expect(cls(s, { isIOS: true, hostname: CANON, displayMode: 'standalone', iosStandalone: true })).toBe('POSSIBLE_EXTERNAL_STORAGE_LOSS')
  })
})

describe('container id lifecycle', () => {
  it('creates a stable id once and reuses it', () => {
    const s = fake()
    const a = getOrCreateContainerId(s)
    const b = getOrCreateContainerId(s)
    expect(a).toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(8)
  })
  it('recordSaveContainer stamps the last-save container = current container', () => {
    const s = fake()
    recordSaveContainer(s)
    const env = detectEnvironment(s, { isIOS: true, hostname: CANON, displayMode: 'standalone', iosStandalone: true })
    expect(env.lastSaveContainerId).toBe(env.containerId)
  })
})

describe('MUTATION cases the guard must catch', () => {
  it('wrong-container import is NOT silently allowed (Safari import is blocked)', () => {
    expect(isImportBlockedForContainer('SAFARI_BROWSER')).toBe(true)
    // a mutant that returned false here would let Martita import into the dead jar
    expect(isImportBlockedForContainer('CANONICAL_PWA')).toBe(false) // canonical still allowed
  })
  it('browser mode is NEVER falsely marked canonical', () => {
    const s = fake({ [KEY]: envelope([{ id: 'mor', enabled: true, phoneE164: P1 }]) })
    // Even WITH data present, a Safari tab must classify SAFARI_BROWSER, not CANONICAL_PWA.
    expect(cls(s, { isIOS: true, hostname: CANON, displayMode: 'browser', iosStandalone: false })).toBe('SAFARI_BROWSER')
  })
  it('"phone not configured" is NEVER the message for a container condition', () => {
    for (const c of ['SAFARI_BROWSER', 'WRONG_HOST', 'UNKNOWN_IOS_CONTAINER', 'POSSIBLE_EXTERNAL_STORAGE_LOSS'] as const) {
      expect(containerMessageHebrew(c)).not.toContain('לא הוגדר')
      expect(containerMessageHebrew(c).length).toBeGreaterThan(0)
    }
  })
  it('container id is NOT ignored: same-jar eviction != CANONICAL_PWA', () => {
    const s = fake({ [KEY]: envelope([]) })
    recordCommittedSave(2, s); recordSaveContainer(s)
    expect(cls(s, { isIOS: true, hostname: CANON, displayMode: 'standalone', iosStandalone: true })).not.toBe('CANONICAL_PWA')
  })
  it('stable-host check is NOT bypassed', () => {
    const s = fake({ [KEY]: envelope([{ id: 'mor', enabled: true, phoneE164: P1 }]) })
    expect(cls(s, { isIOS: true, hostname: 'random-preview.vercel.app', displayMode: 'standalone', iosStandalone: true })).toBe('WRONG_HOST')
  })
  it('recommended actions map to concrete operator guidance', () => {
    expect(recommendedAction('SAFARI_BROWSER')).toBe('OPEN_FROM_HOME_SCREEN_ICON')
    expect(recommendedAction('POSSIBLE_EXTERNAL_STORAGE_LOSS')).toBe('RESTORE_FROM_BACKUP')
    expect(recommendedAction('CANONICAL_PWA')).toBe('CANONICAL_PWA_OK')
  })
})
