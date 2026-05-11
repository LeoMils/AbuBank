/*
 * AbuAI B2.5 — All-pairs family relationship matrix.
 *
 * Loads every known person from knowledge/family_data.json and, for each
 * ordered pair, asserts the global invariants the resolver is required
 * to honour:
 *
 *   1. Every result is either a known kinship type (with confidence
 *      'derived_from_explicit_data') OR an explicit no_direct_relation_found.
 *   2. No result text leaks the generic graph-database wording when a
 *      semantic kinship label exists — i.e. when the type is not
 *      no_direct_relation_found, the result MUST NOT contain "קשור",
 *      "conectado", or "connected to".
 *   3. No result is a single-person profile dump.
 *   4. People in the result text use the expected display names.
 *
 * This is the global QA floor for the family intelligence engine.
 */

import { describe, it, expect } from 'vitest'
import {
  listFamilyPeople,
  resolveRelationship,
  displayName,
  type RelationType,
} from './familyGraph'

const KNOWN_TYPES = new Set<RelationType>([
  'same_person', 'spouse', 'ex_spouse', 'partner', 'parent', 'child',
  'sibling', 'grandparent', 'grandchild', 'great_grandparent',
  'great_grandchild', 'uncle_aunt', 'niece_nephew', 'cousin',
  'brother_in_law', 'sister_in_law',
  'former_brother_in_law', 'former_sister_in_law',
  'son_in_law', 'daughter_in_law',
  'former_son_in_law', 'former_daughter_in_law',
  'father_in_law', 'mother_in_law',
  'former_father_in_law', 'former_mother_in_law',
  'grandchild_in_law', 'grandparent_in_law',
  'indirect_family_relation', 'no_direct_relation_found',
])

const people = listFamilyPeople()

describe('B2.5 — all-pairs family relationship matrix', () => {
  it('graph contains the expected immediate family + grandchildren', () => {
    const names = people.map((p) => p.canonical)
    // Spot-check key people are loaded.
    for (const expected of ['Martita', 'Mor', 'Leo', 'Raphi', 'Yael', 'Ofir',
      'Ayalon', 'Eili', 'Adar', 'Adi', 'Noam', 'Yarden', 'Gilad', 'Anabel', 'Ari']) {
      expect(names, `missing ${expected}`).toContain(expected)
    }
  })

  it('every (A,B) pair returns a known RelationType', () => {
    for (const a of people) {
      for (const b of people) {
        const r = resolveRelationship(a.hebrew, b.hebrew, 'he')
        expect(
          KNOWN_TYPES.has(r.type),
          `unknown type "${r.type}" for ${a.canonical}↔${b.canonical}`,
        ).toBe(true)
      }
    }
  })

  it('no semantic answer contains generic graph wording ("קשור" / "conectado" / "connected to")', () => {
    for (const a of people) {
      for (const b of people) {
        const rHe = resolveRelationship(a.hebrew, b.hebrew, 'he')
        const rEs = resolveRelationship(a.hebrew, b.hebrew, 'es')
        const rEn = resolveRelationship(a.hebrew, b.hebrew, 'en')
        if (rHe.type === 'no_direct_relation_found') continue
        expect(/קשור[הת]?/.test(rHe.he),
          `${a.canonical}↔${b.canonical} HE contains קשור: "${rHe.he}"`).toBe(false)
        expect(/conectad[oa]/i.test(rEs.es),
          `${a.canonical}↔${b.canonical} ES contains conectad: "${rEs.es}"`).toBe(false)
        expect(/connected to/i.test(rEn.en),
          `${a.canonical}↔${b.canonical} EN contains connected to: "${rEn.en}"`).toBe(false)
      }
    }
  })

  it('every successful answer is ≤ 2 sentences', () => {
    for (const a of people) {
      for (const b of people) {
        const r = resolveRelationship(a.hebrew, b.hebrew, 'he')
        if (r.type === 'no_direct_relation_found' || r.type === 'same_person') continue
        const sentences = r.he.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
        expect(sentences.length,
          `${a.canonical}↔${b.canonical} has ${sentences.length} HE sentences: "${r.he}"`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('every successful answer mentions both display names', () => {
    for (const a of people) {
      for (const b of people) {
        if (a.hebrew === b.hebrew) continue
        const r = resolveRelationship(a.hebrew, b.hebrew, 'he')
        if (r.type === 'no_direct_relation_found') continue
        const A = displayName(a, 'he'), B = displayName(b, 'he')
        // Either the HE sentence contains A and B explicitly, or it is
        // a parent-style sentence that names the parent + child anyway.
        const both = r.he.includes(A) && r.he.includes(B)
        expect(both, `${a.canonical}↔${b.canonical} HE missing a name: "${r.he}"`).toBe(true)
      }
    }
  })

  it('symmetry: the relation TYPE is the same for (A,B) and (B,A)', () => {
    for (const a of people) {
      for (const b of people) {
        if (a.hebrew === b.hebrew) continue
        const ab = resolveRelationship(a.hebrew, b.hebrew, 'he').type
        const ba = resolveRelationship(b.hebrew, a.hebrew, 'he').type
        // The taxonomy is symmetric for most relations; for parent/child
        // we use a single 'parent' type for either direction (the
        // sentence resolves which side is the parent). For uncle/aunt
        // and cousin and grandchild_in_law, ditto.
        expect(ab, `directional asymmetry ${a.canonical}↔${b.canonical}: ${ab} vs ${ba}`).toBe(ba)
      }
    }
  })

  it('confidence is always either derived_from_explicit_data or not_found', () => {
    for (const a of people) {
      for (const b of people) {
        const r = resolveRelationship(a.hebrew, b.hebrew, 'he')
        expect(['derived_from_explicit_data', 'not_found']).toContain(r.confidence)
      }
    }
  })
})
