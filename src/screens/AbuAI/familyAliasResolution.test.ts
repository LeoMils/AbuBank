/*
 * Spelling-variant family names must resolve to the grounded graph, not the LLM.
 * These natural STT/typing variants were previously missing as aliases:
 *   אנבל → אנאבל · איליי → עילי · הדר → אדר
 */
import { describe, it, expect } from 'vitest'
import { loadGraph } from './familyGraph'
import { tryGroundedAnswer } from './service'

describe('family alias resolution — spelling variants', () => {
  const graph = loadGraph()
  const find = (name: string) => graph.find(n => n.hebrew === name || n.aliases.includes(name))

  it('"אנבל" resolves to Anabel (canonical אנאבל)', () => {
    expect(find('אנבל')?.hebrew).toBe('אנאבל')
  })
  it('"איליי" resolves to Eili (canonical עילי)', () => {
    expect(find('איליי')?.hebrew).toBe('עילי')
  })
  it('"הדר" resolves to Adar (canonical אדר)', () => {
    expect(find('הדר')?.hebrew).toBe('אדר')
  })
  it('gender is preserved for the resolved variants', () => {
    expect(find('אנבל')?.gender).toBe('female')
    expect(find('איליי')?.gender).toBe('male')
    expect(find('הדר')?.gender).toBe('male')
  })
})

describe('family alias resolution — grounded answer path (not LLM fallthrough)', () => {
  it('"מי זה הדר?" returns a grounded answer', () => {
    expect(tryGroundedAnswer('מי זה הדר?')).not.toBeNull()
  })
  it('"מי זאת אנבל?" returns a grounded answer', () => {
    expect(tryGroundedAnswer('מי זאת אנבל?')).not.toBeNull()
  })
  it('"מי זה איליי?" returns a grounded answer', () => {
    expect(tryGroundedAnswer('מי זה איליי?')).not.toBeNull()
  })
})
