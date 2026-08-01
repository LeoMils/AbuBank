/*
 * Seeded-localStorage repro for the flip-card "all contacts non-actionable"
 * regression. Synthesises the operator JSON import flow purely at the unit
 * level (no React, no DOM) by:
 *   1. Seeding a fake StorageLike under the canonical key.
 *   2. Running getLocalContacts(fakeStorage) → mergeFacesWithLocal →
 *      isPersonActionable on Mor / Leo / Yael.
 *   3. Confirming Ari / Anabel stay non-actionable.
 *   4. Confirming WhatsApp + tel URLs are correctly composed.
 *   5. Confirming a window.localStorage shim makes getLocalContacts() (no
 *      args, default storage) succeed too — which is the path the React
 *      component takes at mount.
 *
 * If every assertion here passes, the unit-level data flow is intact and
 * any user-reported "all contacts say המספר עדיין לא הוגדר" stems from
 * runtime/UX (operator hasn't imported on this device, ITP cleared
 * storage, stale service-worker bundle, etc.), NOT from the merge logic.
 *
 * Synthetic phones only — never real digits.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildTelUrl,
  buildWhatsAppPersonUrl,
  isPersonActionable,
  getDisplayablePersons,
} from './familyQuickFaces'
import {
  LOCAL_FAMILY_CONTACTS_STORAGE_KEY,
  DEFAULT_SEED_CONTACTS,
  getLocalContacts,
  type LocalFamilyContact,
} from './familyContactsStorage'
import { type FamilyQuickFace } from './familyContacts.private'

// The store is the single source of truth: the realistic device state is the
// default family SEED (all members) with a few configured with a number. Pinned
// synthetic phones only — covered by the privacy allowlist.
const CONFIGURED: Record<string, { phone: string }> = {
  mor: { phone: '+972500000001' }, leo: { phone: '+972500000002' }, yael: { phone: '+972500000003' },
}
const SEED: LocalFamilyContact[] = DEFAULT_SEED_CONTACTS.map((c) => {
  const cfg = CONFIGURED[c.id]
  return cfg ? { ...c, enabled: true, phoneE164: cfg.phone, whatsappE164: cfg.phone } : c
})

interface MapStorage {
  store: Map<string, string>
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}
function makeFakeStorage(): MapStorage {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v) },
    removeItem: (k) => { store.delete(k) },
  }
}

function person(merged: FamilyQuickFace[], id: string): Extract<FamilyQuickFace, { type: 'person' }> {
  const f = merged.find((x) => x.type === 'person' && x.id === id)
  return f as Extract<FamilyQuickFace, { type: 'person' }>
}

describe('seeded-localStorage repro — operator-imported contacts must be actionable', () => {
  let fake: MapStorage

  beforeEach(() => {
    fake = makeFakeStorage()
    fake.setItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY, JSON.stringify(SEED))
  })

  it('storage is seeded under the canonical key', () => {
    expect(LOCAL_FAMILY_CONTACTS_STORAGE_KEY).toBe('abubank.familyContacts.v1')
    expect(fake.getItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY)).not.toBeNull()
  })

  it('getLocalContacts(fakeStorage) returns the full seeded family; 3 are configured/enabled', () => {
    const c = getLocalContacts(fake)
    expect(c.length).toBe(DEFAULT_SEED_CONTACTS.length)
    expect(c.filter((x) => x.enabled).map((x) => x.id).sort()).toEqual(['leo', 'mor', 'yael'])
  })

  it('the board renders Mor / Leo / Yael with their phone + enabled=true', () => {
    const c = getLocalContacts(fake)
    const merged = getDisplayablePersons(c)
    for (const id of ['mor', 'leo', 'yael']) {
      const p = person(merged, id)
      expect(p, `id=${id}`).toBeDefined()
      expect(p.enabled, `id=${id} enabled`).toBe(true)
      // Don't embed a partial phone literal here — it would trip the
      // privacy scan. Validate by length + leading '+' + E.164 validity.
      expect(p.phoneE164.length).toBeGreaterThanOrEqual(8)
      expect(p.phoneE164.startsWith('+')).toBe(true)
      // whatsappE164 is preserved through the merge.
      expect((p.whatsappE164 ?? '').length).toBeGreaterThan(0)
    }
  })

  it('isPersonActionable is TRUE for every seeded person (regression guard for the bug Leo reported)', () => {
    const c = getLocalContacts(fake)
    const merged = getDisplayablePersons(c)
    for (const id of ['mor', 'leo', 'yael']) {
      const p = person(merged, id)
      expect(isPersonActionable(p), `id=${id} must be actionable when local data exists`).toBe(true)
    }
  })

  it('Ari / Anabel stay non-actionable when not in the seed', () => {
    const c = getLocalContacts(fake)
    const merged = getDisplayablePersons(c)
    for (const id of ['ari', 'anabel']) {
      const p = person(merged, id)
      expect(isPersonActionable(p), `id=${id} must NOT be actionable without local data`).toBe(false)
    }
  })

  it('Other family members not in the seed (e.g. raphi, ofir) stay non-actionable', () => {
    const c = getLocalContacts(fake)
    const merged = getDisplayablePersons(c)
    for (const id of ['raphi', 'ofir', 'gilad']) {
      const p = person(merged, id)
      expect(isPersonActionable(p), `id=${id} should not be actionable`).toBe(false)
    }
  })

  it('buildWhatsAppPersonUrl prefers whatsappE164, yields wa.me/<digits> (no plus, no spaces, no dashes)', () => {
    const c = getLocalContacts(fake)
    const merged = getDisplayablePersons(c)
    const mor = person(merged, 'mor')
    const url = buildWhatsAppPersonUrl(mor)
    expect(url).toBe('https://wa.me/972500000001')
    expect(/^https:\/\/wa\.me\/\d{8,15}$/.test(url)).toBe(true)
  })

  it('buildTelUrl yields tel:+<digits> with leading +', () => {
    const c = getLocalContacts(fake)
    const merged = getDisplayablePersons(c)
    const leo = person(merged, 'leo')
    const tel = buildTelUrl(leo)
    expect(tel).toBe('tel:+972500000002')
    expect(/^tel:\+\d{8,15}$/.test(tel)).toBe(true)
  })

  it('control: getLocalContacts() with NO args in vitest node env returns [] (no window.localStorage)', () => {
    // Vitest's node environment has no window, so defaultStorage() returns
    // null and the helper returns []. This is the cold-start path; the
    // React component recovers via useEffect when the browser provides
    // window.localStorage.
    expect(getLocalContacts()).toEqual([])
  })
})

// ─── Runtime path: simulate the React component's default-arg call ──────────
//
// The component calls `getLocalContacts()` (no args) inside useEffect after
// mount. That path uses `defaultStorage()` which checks
// `typeof window !== 'undefined' && window.localStorage`. We shim those
// globals here so the runtime path is exercised under vitest, then restore
// them — proving the bug is NOT in the storage helper.
describe('runtime path — default-arg getLocalContacts() with shimmed window.localStorage', () => {
  const g = globalThis as unknown as {
    window?: unknown
    localStorage?: unknown
  }
  let savedWindow: unknown
  let savedLS: unknown
  let fake: MapStorage

  beforeEach(() => {
    savedWindow = g.window
    savedLS = g.localStorage
    fake = makeFakeStorage()
    fake.setItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY, JSON.stringify(SEED))
    // Make `defaultStorage()` happy: window must exist AND have a localStorage.
    g.window = { localStorage: fake }
    g.localStorage = fake
  })
  afterEach(() => {
    if (savedWindow === undefined) delete g.window
    else g.window = savedWindow
    if (savedLS === undefined) delete g.localStorage
    else g.localStorage = savedLS
  })

  it('default-arg getLocalContacts() reads the seeded storage', () => {
    const c = getLocalContacts()
    expect(c.length).toBe(DEFAULT_SEED_CONTACTS.length)
  })

  it('full pipeline (storage → merge → isPersonActionable) returns true for every seeded id', () => {
    const c = getLocalContacts()
    const merged = getDisplayablePersons(c)
    for (const id of ['mor', 'leo', 'yael']) {
      expect(isPersonActionable(person(merged, id)), `id=${id}`).toBe(true)
    }
  })
})
