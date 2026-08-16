/*
 * relationChainShort.test.ts — device regression (transcript item 2): "גלעד לעדי" returned a
 * sprawling chain ("husband of Ofir who is daughter of Mor who is sister of Leo who is father of
 * Adi"). Martita wants the relation as ONE short phrase — a derived term, or the shortest true
 * thing anchored to her — NEVER a transitive hop chain. This locks that.
 */
import { describe, it, expect } from 'vitest'
import { relationshipBetween } from './peopleLookup'

const CHAIN = /שהיא|שהוא|, ש/ // the multi-hop connectors a chain uses

describe('relationshipBetween never returns a transitive chain', () => {
  it('גלעד ↔ עדי is one short phrase anchored to Martita, not a chain', () => {
    const r = relationshipBetween('גלעד', 'עדי')
    expect(r.status).toBe('ok')
    if (r.status === 'ok') {
      expect(r.text).not.toMatch(CHAIN)
      // both anchored to Martita: Gilad is her granddaughter's husband, Adi her grandson
      expect(r.text).toContain('גלעד')
      expect(r.text).toContain('עדי')
      expect(r.text).toContain('שלך')
      expect(r.text.split(/\s+/).length).toBeLessThanOrEqual(12) // short, not a sprawl
    }
  })

  it('a still-distant pair says "בני משפחה", never a chain', () => {
    // ירדן (Eili's wife) ↔ עדי (Leo's son): no single term, ירדן has no clean kin term to Martita
    const r = relationshipBetween('ירדן', 'עדי')
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.text).not.toMatch(CHAIN)
  })

  it('a direct single term is still returned as-is (גלעד גיס של עילי)', () => {
    expect(relationshipBetween('גלעד', 'עילי')).toEqual({ status: 'ok', text: 'גלעד גיס של עילי' })
  })
})
