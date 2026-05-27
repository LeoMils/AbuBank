import { describe, it, expect } from 'vitest'
import { extractPersonPhrase, isRelationshipDescriptor, resolvePersonPhrase } from './familyResolve'

describe('extractPersonPhrase', () => {
  it('captures a full kinship descriptor intact (not just one word)', () => {
    expect(extractPersonPhrase('תקבעי פגישה למחר בשעה 21 עם הבת של מור')).toBe('הבת של מור')
    expect(extractPersonPhrase('פגישה עם הבן של מור')).toBe('הבן של מור')
    expect(extractPersonPhrase('פגישה עם הנכדה של לאו')).toBe('הנכדה של לאו')
  })

  it('captures a bare name', () => {
    expect(extractPersonPhrase('פגישה עם לאו מחר')).toBe('לאו')
  })

  it('ignores non-person stop words and empty input', () => {
    expect(extractPersonPhrase('פגישה עם הרופא')).toBeNull()
    expect(extractPersonPhrase('')).toBeNull()
    expect(extractPersonPhrase('פגישה מחר בעשר')).toBeNull()
  })
})

describe('isRelationshipDescriptor', () => {
  it('is true only for …של… phrases', () => {
    expect(isRelationshipDescriptor('הבת של מור')).toBe(true)
    expect(isRelationshipDescriptor('לאו')).toBe(false)
  })
})

describe('resolvePersonPhrase', () => {
  it('MISSING — "הבת של מור": Mor has no daughter; never invent', () => {
    const r = resolvePersonPhrase('הבת של מור')
    expect(r.status).toBe('missing')
    if (r.status === 'missing') expect(r.phrase).toBe('הבת של מור')
  })

  it('AMBIGUOUS — "הבן של מור": four sons → candidates, no guess', () => {
    const r = resolvePersonPhrase('הבן של מור')
    expect(r.status).toBe('ambiguous')
    if (r.status === 'ambiguous') {
      expect(r.candidates.length).toBeGreaterThan(1)
      for (const c of ['אופיר', 'איילון', 'עילי', 'אדר']) expect(r.candidates).toContain(c)
    }
  })

  it('RESOLVED — a bare known name resolves to the canonical Hebrew name', () => {
    const r = resolvePersonPhrase('לאו')
    expect(r.status).toBe('resolved')
    if (r.status === 'resolved') expect(r.name).toBe('לאו')
  })

  it('MISSING — unknown name preserved, never invented', () => {
    const r = resolvePersonPhrase('דנה')
    expect(r.status).toBe('missing')
  })

  it('NONE — empty phrase', () => {
    expect(resolvePersonPhrase('').status).toBe('none')
  })

  it('does not support eldest/youngest (no birth-order data) — not guessed', () => {
    const r = resolvePersonPhrase('הנכדה הגדולה')
    expect(r.status === 'missing' || r.status === 'none').toBe(true)
  })
})
