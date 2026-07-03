import { describe, it, expect } from 'vitest'
import { validateFamilyGraph, type RawFamilyGraph } from './familyKnowledgeValidator'
import realGraph from '../../../knowledge/family_graph.json'

const base = (people: RawFamilyGraph['people']): RawFamilyGraph => ({ version: 1, people })

describe('familyKnowledgeValidator — rejects invalid / contradictory data', () => {
  it('accepts a clean, consistent graph', () => {
    const r = validateFamilyGraph(base([
      { id: 'a', hebrew: 'א', gender: 'female', children: ['b'] },
      { id: 'b', hebrew: 'ב', gender: 'male', parents: ['a'] },
    ]))
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('rejects a dangling reference', () => {
    const r = validateFamilyGraph(base([{ id: 'a', hebrew: 'א', children: ['ghost'] }]))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/unknown person "ghost"/)
  })

  it('rejects self-reference', () => {
    const r = validateFamilyGraph(base([{ id: 'a', hebrew: 'א', parents: ['a'] }]))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/references itself/)
  })

  it('rejects a parent⇄child contradiction', () => {
    const r = validateFamilyGraph(base([
      { id: 'a', hebrew: 'א', parents: ['b'], children: ['b'] },
      { id: 'b', hebrew: 'ב' },
    ]))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/BOTH parent and child/)
  })

  it('rejects a spouse/ex-spouse contradiction', () => {
    const r = validateFamilyGraph(base([
      { id: 'a', hebrew: 'א', spouses: ['b'], exSpouses: ['b'] },
      { id: 'b', hebrew: 'ב' },
    ]))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/BOTH spouse and ex-spouse/)
  })

  it('rejects an ancestor cycle (impossible loop)', () => {
    const r = validateFamilyGraph(base([
      { id: 'a', hebrew: 'א', parents: ['b'] },
      { id: 'b', hebrew: 'ב', parents: ['a'] },
    ]))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/own ancestor/)
  })

  it('rejects a duplicate id', () => {
    const r = validateFamilyGraph(base([{ id: 'a', hebrew: 'א' }, { id: 'a', hebrew: 'ב' }]))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/duplicate id/)
  })

  it('rejects an alias that maps to two people', () => {
    const r = validateFamilyGraph(base([
      { id: 'a', hebrew: 'א', aliases: ['Nick'] },
      { id: 'b', hebrew: 'ב', aliases: ['Nick'] },
    ]))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/maps to both/)
  })

  it('rejects an invalid gender', () => {
    const r = validateFamilyGraph(base([{ id: 'a', hebrew: 'א', gender: 'other' as never }]))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/invalid gender/)
  })

  it('the real family_graph.json is valid (no contradictions)', () => {
    const r = validateFamilyGraph(realGraph as RawFamilyGraph)
    if (!r.ok) console.error(r.errors.join('\n'))
    expect(r.ok).toBe(true)
  })
})
