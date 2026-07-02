/*
 * Family Relation Engine — directional, gendered, graph-computed. Locks the exact
 * mission pairs, including directionality (Leo→Ofir uncle vs Ofir→Leo nephew),
 * great-uncle, ex-in-laws, and honest unknown.
 */
import { describe, it, expect } from 'vitest'
import { relationOf, answerRelationQuery } from './familyRelationEngine'

describe('directional pairwise relations (mission must-pass)', () => {
  it('Leo → Ofir = uncle (דוד), not sister-of-Mor', () => {
    const r = relationOf('לאו', 'אופיר')
    expect(r.kind).toBe('uncle_aunt')
    expect(r.sentence).toContain('דוד')
    expect(r.sentence).not.toContain('אחות')
  })
  it('Ofir → Leo = nephew (directional opposite)', () => {
    expect(relationOf('אופיר', 'לאו').kind).toBe('nephew_niece')
  })
  it('Leo → Anabel = great-uncle (was null before)', () => {
    expect(relationOf('לאו', 'אנאבל').kind).toBe('great_uncle_aunt')
  })
  it('Yarden → Anabel = uncle by marriage (was null before)', () => {
    expect(relationOf('ירדן', 'אנאבל').kind).toBe('uncle_aunt_in_law')
  })
  it('Rafi → Leo = ex-brother-in-law', () => {
    expect(relationOf('רפי', 'לאו').kind).toBe('ex_sibling_in_law')
  })
  it('Rafi → Martita = ex-son-in-law', () => {
    expect(relationOf('רפי', 'מרטיטה').kind).toBe('ex_child_in_law')
  })
  it('Ofir → Martita = grandchild', () => {
    expect(relationOf('אופיר', 'מרטיטה').kind).toBe('grandchild')
  })
  it('Mor → Leo = sibling', () => {
    expect(relationOf('מור', 'לאו').kind).toBe('sibling')
  })
})

describe('gender correctness', () => {
  it('Leo (male) sibling label = אח, never אחות', () => {
    const r = relationOf('לאו', 'מור')
    expect(r.sentence).toContain('אח ')
    expect(r.sentence).not.toContain('אחות')
  })
  it('Martita → Ofir = grandmother (סבתא), female form', () => {
    expect(relationOf('מרטיטה', 'אופיר').sentence).toContain('סבתא')
  })
})

describe('unknown → no guess', () => {
  it('a non-family name → unknown', () => {
    expect(relationOf('נפוליאון', 'לאו').known).toBe(false)
  })
})

describe('query parsing preserves order (directional)', () => {
  it('"מה לאו עבור אופיר" → uncle', () => {
    expect(answerRelationQuery('מה לאו עבור אופיר')?.kind).toBe('uncle_aunt')
  })
  it('"מה הקשר בין אופיר ללאו" → nephew (subject first)', () => {
    expect(answerRelationQuery('מה הקשר בין אופיר ללאו')?.kind).toBe('nephew_niece')
  })
})
