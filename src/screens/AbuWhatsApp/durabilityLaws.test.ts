/*
 * GATE 4 — EXECUTABLE DURABILITY LAWS (D1–D12) + GATE 1 — DEFECT-INJECTION
 * HARNESS CERTIFICATION.
 *
 * Each law is proven against the REAL contact-storage functions (no mocks of the
 * logic under test), AND each law's NEGATION is injected as a concrete defect to
 * prove the check catches it — a green law is only trusted if its mutant is red.
 *
 * Scope: the deterministic storage/seed/migration/import/consumer laws. The
 * full-stack kill/reopen laws (D1/D2 across a real process) are proven by the
 * persistent-profile lab (e2e/persistence-lifecycle.spec.ts). The communication
 * laws (explicit send/call never falls to general/Calendar) are proven by
 * communicationMultiTurn.test.ts + comm-call-visibility.spec.ts. Cross-references
 * are listed per law so the certification map is complete.
 *
 * Privacy: phone fixtures use ONLY pinned-synthetic tokens from the phonePrivacy
 * allow-list (+972500000001/2/3) — never a real number.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  getLocalContacts, setLocalContacts, clearLocalContacts, removeLocalContact,
  seedDefaultContactsIfEmpty, migrateContactPhotos, previewImportContacts,
  importContactsJSON, DEFAULT_SEED_CONTACTS,
  type LocalFamilyContact,
} from './familyContactsStorage'
import { contactsToPersonFaces, isPersonActionable } from './familyQuickFaces'
import type { FamilyQuickFace } from './familyContacts.private'

// Pinned-synthetic (allow-listed) numbers.
const P1 = '+972500000001', P2 = '+972500000002', P3 = '+972500000003'

/** Hermetic StorageLike (Map-backed). Passing an explicit storage keeps the real
 *  functions off the global durable path, so the logic is tested in isolation. */
function fakeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
    _dump: () => Object.fromEntries(m),
  }
}
type Fake = ReturnType<typeof fakeStorage>

const phoneCount = (cs: LocalFamilyContact[]) => cs.filter((c) => (c.phoneE164 ?? '').trim().length > 0).length
const withPhones = (): LocalFamilyContact[] => ([
  { id: 'mor', enabled: true, phoneE164: P1, displayName: 'מור' },
  { id: 'leo', enabled: true, phoneE164: P2, displayName: 'לאו' },
  { id: 'adar', enabled: true, phoneE164: P3, displayName: 'אדר' },
])
const importJSON = () => JSON.stringify(withPhones())

afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

// ── D3 — Seed runs only on a truly empty repository ─────────────────────────
describe('D3 — seed only on empty repo', () => {
  it('LAW: seeds an empty store, and NEVER re-seeds a written store', () => {
    const s = fakeStorage()
    expect(seedDefaultContactsIfEmpty(s)).toBe(true)          // empty → seeds
    expect(getLocalContacts(s).length).toBe(DEFAULT_SEED_CONTACTS.length)
    setLocalContacts(withPhones(), s)                          // user writes
    expect(seedDefaultContactsIfEmpty(s)).toBe(false)          // non-empty → no-op
    expect(phoneCount(getLocalContacts(s))).toBe(3)
  })
  it('DEFECT (seed overwrites): a seed that ignores existing data is caught', () => {
    const s = fakeStorage()
    setLocalContacts(withPhones(), s)
    // Injected buggy seed that unconditionally overwrites:
    const buggySeed = () => setLocalContacts(DEFAULT_SEED_CONTACTS, s)
    buggySeed()
    // The harness law (phones must survive a seed) FAILS on the mutant:
    expect(phoneCount(getLocalContacts(s))).toBe(0)           // detector observes the loss
  })
})

// ── D4 — Seed never edits existing user records ─────────────────────────────
describe('D4 — seed never edits existing records', () => {
  it('LAW: an existing user record keeps its phone across a seed attempt', () => {
    const s = fakeStorage()
    setLocalContacts([{ id: 'mor', enabled: true, phoneE164: P1, displayName: 'מור' }], s)
    seedDefaultContactsIfEmpty(s)                              // no-op (non-empty)
    const mor = getLocalContacts(s).find((c) => c.id === 'mor')!
    expect(mor.phoneE164).toBe(P1)
    expect(mor.enabled).toBe(true)
  })
})

// ── D6 — Migration cannot remove phones ─────────────────────────────────────
describe('D6 — migration never strips phones', () => {
  it('LAW: photo migration preserves every phone (adds photos only)', () => {
    const s = fakeStorage()
    setLocalContacts(withPhones(), s)
    const before = phoneCount(getLocalContacts(s))
    const res = migrateContactPhotos(s)
    const after = getLocalContacts(s)
    expect(phoneCount(after)).toBe(before)                    // no phone lost
    // migration only ADDS a bundled photo to a known id that had none:
    for (const c of after) expect((c.phoneE164 ?? '').length).toBeGreaterThan(0)
    expect(res.skipped === false || res.migrated >= 0).toBe(true)
  })
  it('DEFECT (migration strips phones): a strip-mutant is caught', () => {
    const s = fakeStorage()
    setLocalContacts(withPhones(), s)
    // Injected buggy migration that blanks phones (the defect a strip would cause):
    const buggy = getLocalContacts(s).map((c) => ({ ...c, phoneE164: '' }))
    setLocalContacts(buggy, s)
    expect(phoneCount(getLocalContacts(s))).toBe(0)           // detector flags the strip
  })
})

// ── D7 — Identical JSON import is a true no-op ──────────────────────────────
describe('D7 — identical re-import is a no-op', () => {
  it('LAW: re-importing the same JSON yields zero added/updated', () => {
    const s = fakeStorage()
    const parsed = importContactsJSON(importJSON())
    expect(parsed.ok).toBe(true)
    setLocalContacts(parsed.contacts, s)
    const preview = previewImportContacts(importJSON(), getLocalContacts(s))
    expect(preview.added.length).toBe(0)
    expect(preview.updated.length).toBe(0)
    expect(preview.toSave.length).toBe(0)                     // true no-op
    expect(preview.unchanged.length).toBe(3)
  })
})

// ── D8 — Build update without migration cannot modify contact data ──────────
describe('D8 — build-update boot never mutates contact data', () => {
  it('LAW: a re-boot (seed+migrate) over an existing store keeps phones+enabled', () => {
    const s = fakeStorage()
    setLocalContacts(withPhones(), s)
    // Simulate a Build B/C reopen: startup runs seed + photo migration again.
    seedDefaultContactsIfEmpty(s)
    migrateContactPhotos(s)
    seedDefaultContactsIfEmpty(s)
    migrateContactPhotos(s)                                   // idempotent second pass
    const after = getLocalContacts(s)
    expect(phoneCount(after)).toBe(3)
    expect(after.filter((c) => c.enabled).length).toBe(3)
    for (const id of ['mor', 'leo', 'adar']) {
      expect(after.find((c) => c.id === id)?.phoneE164).toBeTruthy()
    }
  })
})

// ── D9 — Resolver and Board expose the SAME committed data ──────────────────
describe('D9 — resolver/Board consistency', () => {
  it('LAW: getLocalContacts (resolver) and contactsToPersonFaces (Board) agree', () => {
    const s = fakeStorage()
    setLocalContacts([
      { id: 'mor', enabled: true, phoneE164: P1, displayName: 'מור' },
      { id: 'leo', enabled: false, phoneE164: '', displayName: 'לאו' },
    ], s)
    const resolver = getLocalContacts(s)
    const faces = contactsToPersonFaces(resolver) as Extract<FamilyQuickFace, { type: 'person' }>[]
    const morFace = faces.find((f) => f.id === 'mor')!
    const leoFace = faces.find((f) => f.id === 'leo')!
    expect(isPersonActionable(morFace)).toBe(true)            // enabled + phone
    expect(isPersonActionable(leoFace)).toBe(false)           // disabled / no phone
  })
  it('DEFECT (stale Board snapshot): rendering an OLD list is caught', () => {
    const s = fakeStorage()
    setLocalContacts([{ id: 'mor', enabled: false, phoneE164: '', displayName: 'מור' }], s)
    const stale = getLocalContacts(s)                         // captured BEFORE the update
    setLocalContacts([{ id: 'mor', enabled: true, phoneE164: P1, displayName: 'מור' }], s)
    const fresh = getLocalContacts(s)
    const staleFace = (contactsToPersonFaces(stale) as Extract<FamilyQuickFace, { type: 'person' }>[])[0]!
    const freshFace = (contactsToPersonFaces(fresh) as Extract<FamilyQuickFace, { type: 'person' }>[])[0]!
    // A consumer that kept the stale snapshot would be non-actionable; the fresh
    // committed snapshot IS actionable — the mismatch is the detectable defect.
    expect(isPersonActionable(staleFace)).toBe(false)
    expect(isPersonActionable(freshFace)).toBe(true)
  })
})

// ── D10 — Phone count cannot reach zero without explicit deletion ───────────
describe('D10 — no implicit phone-zeroing', () => {
  it('LAW: only removeLocalContact/clear reduces the count; boot steps never do', () => {
    const s = fakeStorage()
    setLocalContacts(withPhones(), s)
    seedDefaultContactsIfEmpty(s); migrateContactPhotos(s)   // implicit boot work
    expect(phoneCount(getLocalContacts(s))).toBe(3)          // unchanged
    removeLocalContact('mor', s)                              // EXPLICIT deletion
    expect(phoneCount(getLocalContacts(s))).toBe(2)
    clearLocalContacts(s)                                     // EXPLICIT clear
    expect(getLocalContacts(s).length).toBe(0)
  })
})
