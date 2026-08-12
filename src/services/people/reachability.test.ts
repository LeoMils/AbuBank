/*
 * reachability.test.ts — THE proof for FIX 1 + FIX 2 (device: "who is Susi → not_found"
 * while "who is Elsi" answered fully). One retrieval path for ALL people:
 * ════════════════════════════════════════════════════════════════════════════
 * Every person in knowledge/family_data.json must be reachable with IDENTICAL guarantees:
 *   (a) by NAME and every alias           → whoIs resolves (never not_found)
 *   (b) by RELATIONSHIP to Martita        → a family member relates to her (kinship OR a
 *                                            described PATH); a friend relates by role
 *   (c) the device-empty queries          → siblings/parents/"who is Susi"/friends
 *   (d) in-law / by-marriage PATHS        → never "no relation" when a path exists (FIX 2)
 * Data-driven: it enumerates the REAL roster, so adding a person automatically extends
 * coverage. This is the test that must go green before the fix is claimed complete.
 */
import { describe, it, expect } from 'vitest'
import familyData from '../../../knowledge/family_data.json'
import { loadPeople, resolvePersonId } from './peopleModel'
import { whoIs, relationshipBetween, relativesByKind, friendsOf } from './peopleLookup'

const people = loadPeople()
const MARTITA = 'מרטיטה'

// ── classify each raw person from the data: is their relation to Martita KINSHIP or ROLE? ──
const FAMILY_GROUPS = ['matriarch', 'deceased', 'children', 'children_related', 'grandchildren_mor', 'grandchildren_leo', 'grandchildren_spouses', 'great_grandchildren', 'extended_family'] as const
const FRIEND_REL = /friend|acquaintance/i
interface RawP { canonical_name?: string; hebrew_name?: string; aliases?: string[]; relationship?: string; deceased?: boolean }
function roster(): Array<{ heb: string; latin: string; aliases: string[]; group: string; rel: string; isFriend: boolean; isPet: boolean }> {
  const fam = (familyData as { family: Record<string, unknown> }).family
  const out: Array<{ heb: string; latin: string; aliases: string[]; group: string; rel: string; isFriend: boolean; isPet: boolean }> = []
  for (const [group, v] of Object.entries(fam)) {
    const list = Array.isArray(v) ? v : v ? [v] : []
    for (const raw of list as RawP[]) {
      if (!raw || (!raw.canonical_name && !raw.hebrew_name)) continue
      const rel = raw.relationship ?? ''
      const isPet = group === 'pets'
      out.push({
        heb: raw.hebrew_name ?? raw.canonical_name!, latin: raw.canonical_name ?? '',
        aliases: raw.aliases ?? [], group, rel,
        isFriend: FRIEND_REL.test(rel) || group === 'close_friends', isPet,
      })
    }
  }
  return out
}
const ROSTER = roster().filter((r) => !r.isPet)

describe(`every one of the ${ROSTER.length} people is reachable by NAME (and every alias)`, () => {
  for (const r of ROSTER) {
    it(`whoIs("${r.heb}") resolves`, () => {
      expect(whoIs(r.heb).status).toBe('ok')
    })
    for (const alias of r.aliases) {
      it(`alias "${alias}" resolves to the same person`, () => {
        expect(resolvePersonId(alias)).toBe(resolvePersonId(r.heb))
      })
    }
  }
})

describe('every FAMILY member relates to Martita (kinship or a described path); no family member is "unrelated"', () => {
  for (const r of ROSTER) {
    const isFamily = (FAMILY_GROUPS as readonly string[]).includes(r.group) && !r.isFriend && r.heb !== MARTITA
    if (!isFamily) continue
    it(`${r.heb} ↔ Martita is a real relationship, not "unrelated"`, () => {
      const res = relationshipBetween(r.heb, MARTITA)
      expect(res.status, `${r.heb} came back ${res.status}`).toBe('ok')
    })
  }
})

describe('every FRIEND relates to Martita by role (whoIs carries a relationToMartita)', () => {
  for (const r of ROSTER) {
    if (!r.isFriend) continue
    it(`${r.heb} has a non-null relationToMartita`, () => {
      const w = whoIs(r.heb)
      expect(w.status).toBe('ok')
      expect((w as { relationToMartita?: string | null }).relationToMartita).toBeTruthy()
    })
  }
})

describe('the device-empty queries must now return data', () => {
  it('people_lookup(מרתה, sibling) → Luis and Bobby', () => {
    const r = relativesByKind(MARTITA, 'sibling')
    expect(r.status).toBe('ok')
    expect(r.status === 'ok' && r.people).toContain('לואיס')
    expect(r.status === 'ok' && r.people).toContain('בובי')
  })
  it('people_lookup(מרתה, parent) → Dora and Jacobo', () => {
    const r = relativesByKind(MARTITA, 'parent')
    expect(r.status).toBe('ok')
    expect(r.status === 'ok' && r.people).toContain('דורה')
    expect(r.status === 'ok' && r.people).toContain('יעקב')
  })
  it('people_lookup(who, סוסי) → Susi Raz (STT spelling variant of סוזי)', () => {
    expect(whoIs('סוסי').status).toBe('ok')
    expect(resolvePersonId('סוסי')).toBe(resolvePersonId('סוזי רז'))
  })
  it('"my friends" → the friend circle (Susi, Lydia, Noah, Mirta, Shoshana …)', () => {
    const f = friendsOf(MARTITA)
    expect(f.length).toBeGreaterThanOrEqual(5)
    expect(f).toContain('סוזי רז')
    expect(f).toContain('לידיה אומנסקי')
  })
})

describe('FIX 2 — in-law / by-marriage PATHS are described, never "no relation"', () => {
  const pairs: Array<[string, string]> = [
    ['גלעד', 'לאו'],     // Gilad is Ofir's husband; Ofir is Leo's niece
    ['לאו', 'גלעד'],
    ['יעל', 'לאו'],      // Yael is Mor's partner; Mor is Leo's sister
    ['ירדן', 'מרטיטה'],  // Yarden is Eili's wife; Eili is Martita's grandson
    ['נילי', 'מור'],     // Nili is Rafi's partner; Rafi is Mor's ex
    ['גלעד', 'מור'],     // Gilad is Ofir's husband; Ofir is Mor's daughter
    ['חורחה', 'לאו'],    // Jorge is Martita's nephew; Leo is Martita's son → cousins-ish path
    ['סופיה', 'מרטיטה'], // Sofia is Luis's wife; Luis is Martita's brother
    ['אאצ\'י', 'מרטיטה'],// Achi is Jorge's wife; Jorge is Martita's nephew
    ['גלעד', 'אדר'],     // Gilad is Ofir's husband; Adar is Ofir's brother
  ]
  for (const [a, b] of pairs) {
    it(`${a} ↔ ${b} yields a path, not "unrelated"`, () => {
      const res = relationshipBetween(a, b)
      expect(res.status, `${a}↔${b} came back ${res.status}`).toBe('ok')
      if (res.status === 'ok') expect(res.text.length).toBeGreaterThan(0)
    })
  }
})
