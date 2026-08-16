/*
 * relationChainShort.test.ts — the relation BETWEEN two people (owner device round 3): compute the
 * relation between X and Y DIRECTLY, as one natural possessive phrase. NEVER route through Martita
 * ("both of their relations to her" was rejected), NEVER return the generic "בני משפחה" bucket, and
 * NEVER a pronoun hop-chain ("שהיא… שהוא…"). A direct single term is still returned as-is.
 */
import { describe, it, expect } from 'vitest'
import { relationshipBetween } from './peopleLookup'

const PRONOUN_CHAIN = /שהיא|שהוא|, ש/          // the old sprawling pronoun chain
const THROUGH_MARTITA = /מרטיטה|מרתיטה|שלך/     // routed through / anchored to Martita (rejected)

describe('relationshipBetween computes the relation BETWEEN the two people', () => {
  it('Yael ↔ Leo is a direct possessive phrase, NOT "בני משפחה" (he pushed 3× on this)', () => {
    const r = relationshipBetween('יעל', 'לאו')
    expect(r.status).toBe('ok')
    if (r.status === 'ok') {
      expect(r.text).not.toBe('יעל ולאו בני משפחה')
      expect(r.text).not.toMatch(/בני משפחה/)
      expect(r.text).not.toMatch(THROUGH_MARTITA)
      expect(r.text).toContain('לאו')
      // Yael is the partner of Leo's sister (Mor): a real, direct path.
      expect(r.text).toMatch(/בת הזוג של האחות של לאו/)
    }
  })

  it('a distant pair (עדי ↔ גלעד) gives the relation between THEM, never through Martita, never a chain', () => {
    const r = relationshipBetween('עדי', 'גלעד')
    expect(r.status).toBe('ok')
    if (r.status === 'ok') {
      expect(r.text).not.toMatch(PRONOUN_CHAIN)
      expect(r.text).not.toMatch(THROUGH_MARTITA)
      expect(r.text).not.toMatch(/בני משפחה/)
      expect(r.text).toContain('עדי')
      expect(r.text).toContain('גלעד')
    }
  })

  it('a direct single term is still returned as-is (גלעד גיס של עילי)', () => {
    expect(relationshipBetween('גלעד', 'עילי')).toEqual({ status: 'ok', text: 'גלעד גיס של עילי' })
  })
})
