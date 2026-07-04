/*
 * Family Runtime Cutover — proves the LIVE family engines (relationOf, findNode,
 * explainRelation) read from the editable Family Knowledge System (family_graph.json
 * via familyKnowledgeLoader), NOT the old family_data.json. Editing the graph changes
 * live answers; notes never affect relationship computation.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { relationOf } from './familyRelationEngine'
import { explainRelation } from './familyPathReasoner'
import { findNode, loadGraph } from './familyGraph'
import { reloadFamilyKnowledge, personNotes } from './familyKnowledgeLoader'
import type { RawFamilyGraph } from './familyKnowledgeValidator'

afterEach(() => { reloadFamilyKnowledge() }) // restore the real editable graph

const two = (extra: Partial<RawFamilyGraph['people'][number]> = {}): RawFamilyGraph => ({
  version: 1,
  people: [
    { id: 'aa', hebrew: 'אאא', gender: 'female', ...extra },
    { id: 'bb', hebrew: 'בבב', gender: 'male' },
  ],
})

describe('Family Runtime Cutover — live answers come from the editable graph', () => {
  it('editing family_graph.json changes the live relationOf answer', () => {
    reloadFamilyKnowledge(two(), '')
    expect(relationOf('אאא', 'בבב').known).toBe(false) // unrelated

    // add the fact: aa is bb's parent → live answer updates without code changes
    reloadFamilyKnowledge(two({ children: ['bb'] }), '')
    expect(relationOf('אאא', 'בבב').kind).toBe('parent')
    expect(relationOf('בבב', 'אאא').kind).toBe('child')
  })

  it('explainRelation reflects the editable graph (edge-by-edge from the new data)', () => {
    reloadFamilyKnowledge(two({ children: ['bb'] }), '')
    const ex = explainRelation('בבב', 'אאא')
    expect(ex).toMatch(/אאא/) // the added parent appears in the computed path
  })

  it('the runtime uses the editable graph, NOT old family_data.json', () => {
    // A graph WITHOUT Leo/Mor's real sibling relation → relationOf must not "remember"
    // the old data. Proves there is no hidden family_data.json read.
    reloadFamilyKnowledge(two(), '')
    expect(findNode('לאו')).toBeNull()      // Leo isn't in this graph
    expect(relationOf('לאו', 'מור').known).toBe(false)
  })

  it('aliases Leo / לאו / ליאו resolve to the same node through the live graph', () => {
    reloadFamilyKnowledge() // real graph
    const leo = findNode('לאו')
    expect(leo).not.toBeNull()
    expect(findNode('Leo')?.hebrew).toBe(leo!.hebrew)
    expect(findNode('ליאו')?.hebrew).toBe(leo!.hebrew)
    expect(findNode('לאון')?.hebrew).toBe(leo!.hebrew)
  })

  it('family_notes.md NEVER affects relationship computation (soft only)', () => {
    // a note that "claims" a relation must not create one in the graph.
    const notes = '## אאא\nאאא היא האמא של בבב לפי הסיפור.\n'
    reloadFamilyKnowledge(two(), notes) // graph has NO parent edge
    expect(relationOf('אאא', 'בבב').known).toBe(false) // note ignored for relationships
    expect(personNotes('אאא')).toMatch(/הסיפור/)        // but available as soft context
  })

  it('the real graph still answers the known relations after cutover', () => {
    reloadFamilyKnowledge()
    expect(relationOf('לאו', 'אופיר').kind).toBe('uncle_aunt')       // Leo is Ofir's uncle
    expect(relationOf('לאו', 'מור').kind).toBe('sibling')             // Leo ↔ Mor siblings
    expect(relationOf('מרטיטה', 'אופיר').kind).toBe('grandparent')    // Martita grandparent
  })
})

describe('DATA HOLD — Ofir gender/data mismatch (do not guess; needs Leo)', () => {
  it('pins the CURRENT unconfirmed state so a silent change is caught', () => {
    reloadFamilyKnowledge()
    const ofir = findNode('אופיר')
    expect(ofir).not.toBeNull()
    // family_graph.json currently derives gender=male from family_data role "grandson",
    // while the notes describe Ofir as a parent of Anabel/Ari. This is UNCONFIRMED.
    // Leaving it pinned here documents the DATA HOLD; when Leo confirms, update
    // family_graph.json + this expectation together.
    expect(ofir!.gender).toBe('male') // ⚠️ DATA HOLD — awaiting Leo's confirmation
  })
})
