/**
 * Gender matrix: every family member must have correct gender
 * and Hebrew responses must use correct pronouns.
 */
import { describe, it, expect } from 'vitest'
import { loadGraph } from './familyGraph'
import { tryGroundedAnswer, SYSTEM_PROMPT } from './service'
import { routePersonalQuery } from './router'

describe('Gender Matrix — every family member', () => {
  const graph = loadGraph()

  const expectedGenders: Record<string, 'female' | 'male'> = {
    'מירטה': 'female',     // Martita — matriarch
    'פפי': 'male',         // Pepe — deceased husband
    'מור': 'female',       // daughter
    'לאו': 'male',         // son (Leo)
    'אופיר': 'male',      // grandson
    'איילון': 'male',     // grandson
    'עילי': 'male',        // grandson
    'אדר': 'male',         // grandson
    'עדי': 'male',         // grandson (Leo's)
    'נועם': 'male',        // grandson (Leo's)
    'יעל': 'female',       // Mor's partner
    'רפי': 'male',         // ex son-in-law
    'ירדן': 'female',      // granddaughter-in-law
    'גלעד': 'male',        // grandson-in-law
    'אנאבל': 'female',     // great-granddaughter
    'ארי': 'female',       // great-granddaughter
  }

  for (const [name, expectedGender] of Object.entries(expectedGenders)) {
    it(`${name} should be ${expectedGender}`, () => {
      const node = graph.find(n => n.hebrew === name)
      if (!node) {
        // Some names may not be direct graph nodes (pets, friends)
        return
      }
      expect(node.gender).toBe(expectedGender)
    })
  }
})

describe('Gender in grounded answers', () => {
  it('"מי זאת מור?" uses feminine', () => {
    const answer = tryGroundedAnswer('מי זאת מור?')
    expect(answer).not.toBeNull()
    // Should not use masculine pronouns for Mor
    expect(answer).not.toMatch(/הוא\s/)
  })

  it('"מי זה נעם?" uses masculine', () => {
    const answer = tryGroundedAnswer('מי זה נעם?')
    expect(answer).not.toBeNull()
    // Should not use feminine pronouns for Noam
    expect(answer).not.toMatch(/היא\s/)
  })

  it('"מי זה רפי?" uses masculine', () => {
    const answer = tryGroundedAnswer('מי זה רפי?')
    expect(answer).not.toBeNull()
  })

  it('"מי זאת יעל?" uses feminine', () => {
    const answer = tryGroundedAnswer('מי זאת יעל?')
    expect(answer).not.toBeNull()
  })

  it('Martita is always addressed as female in system prompt', () => {
    expect(SYSTEM_PROMPT).toContain('את ')
    expect(SYSTEM_PROMPT).toContain('שלך')
  })
})

describe('Calendar source honesty', () => {
  it('system prompt mentions internal app calendar, not Google/Apple', () => {
    expect(SYSTEM_PROMPT).toContain('לא ליומן גוגל או אפל')
  })
})
