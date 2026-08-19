import { describe, it, expect } from 'vitest'
import { resolveRelationalQuery } from './relationalResolver'

describe('L-2 Spanish relational routing', () => {
  it('resolves correct inferred relations (Latin names, Rioplatense)', () => {
    expect(resolveRelationalQuery('la mamá de Ofir', 'es')).toContain('Mor')
    expect(resolveRelationalQuery('quién es la abuela de Annabel', 'es')).toContain('Mor')
    expect(resolveRelationalQuery('quién es la nieta de Mor', 'es')).toMatch(/Ann?abel/)
    expect(resolveRelationalQuery('el marido de Ofir', 'es')).toContain('Gilad')
    expect(resolveRelationalQuery('la tía de Adi', 'es')).toContain('Mor')
  })
  it('never invents a relation that does not exist (honest)', () => {
    // Leo has only sons (Adi, Noam) → no daughter; Ofir's parents have no female sibling → no aunt.
    expect(resolveRelationalQuery('la hija de Leo', 'es')).toMatch(/no tiene/)
    expect(resolveRelationalQuery('la tía de Ofir', 'es')).toMatch(/no tiene/)
  })
  it('uses Latin names, not Hebrew script', () => {
    const a = resolveRelationalQuery('la mamá de Ofir', 'es')!
    expect(a).not.toMatch(/[֐-׿]/)
  })
})

describe('L-2 English relational routing', () => {
  it('resolves correct inferred relations', () => {
    expect(resolveRelationalQuery("Ofir's mother", 'en')).toContain('Mor')
    expect(resolveRelationalQuery("who is Annabel's grandmother", 'en')).toContain('Mor')
    expect(resolveRelationalQuery("who is Mor's granddaughter", 'en')).toMatch(/Ann?abel/)
    expect(resolveRelationalQuery("who is Ofir's uncle", 'en')).toContain('Leo')
    expect(resolveRelationalQuery('mother of Mor', 'en')).toBeTruthy()
  })
  it('honest when no such relative', () => {
    expect(resolveRelationalQuery("Leo's daughter", 'en')).toMatch(/has no/)
  })
})

describe('L-2 mixed-language (relation word + Hebrew/Latin name)', () => {
  it('Spanish relation + Hebrew name', () => {
    expect(resolveRelationalQuery('la mamá de אופיר', 'es')).toContain('Mor')
  })
  it('English relation + Hebrew name', () => {
    expect(resolveRelationalQuery('mother of מור', 'en')).toBeTruthy()
  })
  it('alias spelling (Annabel vs Anabel) resolves', () => {
    expect(resolveRelationalQuery('la abuela de Annabel', 'es')).toContain('Mor')
  })
})

describe('L-2 non-relational input returns null (falls back to normal lookup)', () => {
  it('plain who-is / non-relation → null', () => {
    expect(resolveRelationalQuery('quién es Mor', 'es')).toBeNull()
    expect(resolveRelationalQuery('who is Leo', 'en')).toBeNull()
  })
  it('unknown name → null', () => {
    expect(resolveRelationalQuery('la mamá de Pedro', 'es')).toBeNull()
  })
})
