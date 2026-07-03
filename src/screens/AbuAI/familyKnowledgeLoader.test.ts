import { describe, it, expect, afterEach } from 'vitest'
import { reloadFamilyKnowledge, resolvePerson, personNotes, familyGraphNodes } from './familyKnowledgeLoader'
import { findRelationPath } from './familyPathReasoner'
import type { RawFamilyGraph } from './familyKnowledgeValidator'

afterEach(() => { reloadFamilyKnowledge() }) // restore the real graph

describe('familyKnowledgeLoader — editable, alias-aware, reloadable', () => {
  it('resolves aliases: Leo / לאו / ליאו → one person', () => {
    const k = reloadFamilyKnowledge()
    const id = resolvePerson('לאו', k)
    expect(id).toBeTruthy()
    expect(resolvePerson('Leo', k)).toBe(id)
    expect(resolvePerson('ליאו', k)).toBe(id)
    expect(resolvePerson('לאון', k)).toBe(id)
  })

  it('adding a new family FACT updates the computed relationship', () => {
    // base: two unrelated people → no path
    const g0: RawFamilyGraph = { version: 1, people: [
      { id: 'x', hebrew: 'איקס', gender: 'male' },
      { id: 'y', hebrew: 'יגרק', gender: 'female' },
    ] }
    const k0 = reloadFamilyKnowledge(g0, '')
    expect(findRelationPath('איקס', 'יגרק', familyGraphNodes(k0)).found).toBe(false)

    // add the fact: y is x's parent → now there IS a computed relationship
    const g1: RawFamilyGraph = { version: 1, people: [
      { id: 'x', hebrew: 'איקס', gender: 'male', parents: ['y'] },
      { id: 'y', hebrew: 'יגרק', gender: 'female', children: ['x'] },
    ] }
    const k1 = reloadFamilyKnowledge(g1, '')
    const p = findRelationPath('איקס', 'יגרק', familyGraphNodes(k1))
    expect(p.found).toBe(true)
    expect(p.hops).toBe(1)
    expect(p.edges[0]).toBe('parent')
  })

  it('backfills symmetry so a one-sided edit still reasons both directions', () => {
    // only x declares the parent; y has no child link — loader must backfill.
    const g: RawFamilyGraph = { version: 1, people: [
      { id: 'x', hebrew: 'איקס', parents: ['y'] },
      { id: 'y', hebrew: 'יגרק' },
    ] }
    const k = reloadFamilyKnowledge(g, '')
    expect(findRelationPath('יגרק', 'איקס', familyGraphNodes(k)).found).toBe(true) // y→x via backfilled child edge
  })

  it('soft notes come from family_notes.md, resolved by alias, separate from the graph', () => {
    const g: RawFamilyGraph = { version: 1, people: [{ id: 'לאו', hebrew: 'לאו', aliases: ['Leo'] }] }
    const notes = '## Leo\nLeo loves Friday dinners.\n'
    const k = reloadFamilyKnowledge(g, notes)
    expect(personNotes('לאו', k)).toMatch(/Friday dinners/)
    expect(personNotes('Leo', k)).toMatch(/Friday dinners/)
    expect(personNotes('nobody', k)).toBeNull()
  })

  it('an invalid graph is flagged (not silently used)', () => {
    const bad: RawFamilyGraph = { version: 1, people: [{ id: 'a', hebrew: 'א', parents: ['a'] }] }
    const k = reloadFamilyKnowledge(bad, '')
    expect(k.valid).toBe(false)
    expect(k.errors.length).toBeGreaterThan(0)
  })

  it('the real knowledge loads valid with a full family', () => {
    const k = reloadFamilyKnowledge()
    expect(k.valid).toBe(true)
    expect(k.people.length).toBeGreaterThanOrEqual(10)
  })
})
