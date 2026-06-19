/**
 * RC3 Family Reasoning Tests — generalized inference, not hardcoded examples.
 */
import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { loadGraph } from './familyGraph'

describe('RC3: Relational role queries', () => {
  it('"מי אמא של אופיר" → מור', () => {
    const answer = tryGroundedAnswer('מי אמא של אופיר?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('מור')
  })

  it('"מי סבתא של אנאבל" → מור (grandmother, not great-grandmother)', () => {
    const answer = tryGroundedAnswer('מי סבתא של אנאבל?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('מור')
  })

  it('"מי סבתא של ארי" → מור', () => {
    const answer = tryGroundedAnswer('מי סבתא של ארי?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('מור')
  })

  it('"מי אחות של לאו" → מור', () => {
    const answer = tryGroundedAnswer('מי אחות של לאו?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('מור')
  })

  it('"מי בת הזוג של מור" → יעל', () => {
    const answer = tryGroundedAnswer('מי בת הזוג של מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('יעל')
  })

  it('"מי החברה של מור" → יעל', () => {
    const answer = tryGroundedAnswer('מי החברה של מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('יעל')
  })

  it('"מי הילדים של מור" routes to family group', () => {
    const route = routePersonalQuery('מי הילדים של מור?')
    expect(route.type).toBe('family_lookup')
  })

  it('"מי הנכדים של מור" routes to family', () => {
    const route = routePersonalQuery('מי הנכדים של מור?')
    expect(route.type).toBe('family_lookup')
  })
})

describe('RC3: Graph inference integrity', () => {
  const graph = loadGraph()

  it('Martita is grandparent of all grandchildren', () => {
    const martita = graph.find(n => n.hebrew === 'מרטיטה')!
    expect(martita.childrenHe).toContain('מור')
    expect(martita.childrenHe).toContain('לאו')
  })

  it('Mor children are in graph', () => {
    const mor = graph.find(n => n.hebrew === 'מור')!
    expect(mor.childrenHe).toContain('אופיר')
    expect(mor.childrenHe).toContain('איילון')
    expect(mor.childrenHe).toContain('עילי')
    expect(mor.childrenHe).toContain('אדר')
  })

  it('Yael is Mor partner', () => {
    const yael = graph.find(n => n.hebrew === 'יעל')!
    expect(yael.partnersHe).toContain('מור')
  })

  it('Ofir parents include Mor', () => {
    const ofir = graph.find(n => n.hebrew === 'אופיר')!
    expect(ofir.parentsHe).toContain('מור')
  })

  it('Anabel parents include Ofir', () => {
    const anabel = graph.find(n => n.hebrew === 'אנאבל')!
    expect(anabel.parentsHe).toContain('אופיר')
  })
})

describe('RC3: "ספרי לי על X" vs "מי זאת X" produce different depth', () => {
  it('"מי זאת מור" and "ספרי לי על מור" both return non-null', () => {
    const who = tryGroundedAnswer('מי זאת מור?')
    const tell = tryGroundedAnswer('ספרי לי על מור')
    expect(who).not.toBeNull()
    expect(tell).not.toBeNull()
  })
})

describe('RC3: "מה X עושה" routes to family', () => {
  it('"מה מור עושה" routes to family_lookup', () => {
    const route = routePersonalQuery('מה מור עושה?')
    expect(route.type).toBe('family_lookup')
  })
})
