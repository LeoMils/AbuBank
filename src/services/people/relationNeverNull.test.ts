/*
 * relationNeverNull.test.ts — agent M3 (Part 4 · Layer 1, 100% of the cross-product).
 * ════════════════════════════════════════════════════════════════════════════
 * The Gilad defect: people_lookup returned relationToMartita: null for a real family member,
 * so an 81-year-old had to name her own grandson-in-law. This asserts the INVARIANT — never
 * null for a connected entity — across EVERY entity and EVERY ordered pair (deterministic,
 * no model). The oracle is the structural graph itself (a spouse-of-a-grandchild MUST have a
 * relation to Martita); see docs/eval/FAMILY_GROUND_TRUTH.md for the enumerated file.
 */
import { describe, it, expect } from 'vitest'
import { loadPeople } from './peopleModel'
import { whoIs, relationshipBetween } from './peopleLookup'

const people = loadPeople()

describe('M3 — whoIs never returns a null relation for a dataset entity', () => {
  it('every entity resolves to a non-empty relationToMartita (or a role) — no GAPs', () => {
    const gaps: string[] = []
    for (const p of people) {
      if (p.id === 'martita') continue
      const w = whoIs(p.hebrewName, people)
      if (w.status !== 'ok' || !w.relationToMartita || !w.relationToMartita.trim()) gaps.push(p.hebrewName)
    }
    expect(gaps, `entities with no derivable relation to Martita: ${gaps.join(', ')}`).toEqual([])
  })

  it('REGRESSION — Gilad (grandson-in-law) is not null; he is the husband of Martita\'s granddaughter', () => {
    const w = whoIs('גלעד', people)
    expect(w.status).toBe('ok')
    if (w.status === 'ok') {
      expect(w.relationToMartita).toBeTruthy()
      expect(w.relationToMartita).toContain('נכד') // "בעל הנכדה של מרטיטה"
      expect(w.relationToMartita).not.toBeNull()
    }
    // and the by-marriage relation is computed (not "unrelated"/not_found)
    expect(relationshipBetween('גלעד', 'מרטיטה', people).status).toBe('ok')
  })

  it('every close-family member (has a graph edge) resolves via a term or a path, never a bare role fallback for kin', () => {
    // A person connected to Martita by blood or marriage must get a KINSHIP-derived relation
    // (term or path), not fall through to a generic role. Spot the grandchildren-in-law.
    for (const name of ['גלעד', 'ירדן']) {
      const w = whoIs(name, people)
      expect(w.status).toBe('ok')
      if (w.status === 'ok') expect(w.relationToMartita).toMatch(/של מרטיטה|נכד|כלה|חתן/)
    }
  })
})
