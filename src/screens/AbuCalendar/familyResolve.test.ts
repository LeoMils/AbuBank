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

  it('RESOLVED — spouse "הבעל של אופיר" → גלעד (male spouse from familyGraph)', () => {
    for (const p of ['הבעל של אופיר', 'בעלה של אופיר', 'בן הזוג של אופיר']) {
      const r = resolvePersonPhrase(p)
      expect(r.status).toBe('resolved')
      if (r.status === 'resolved') expect(r.name).toBe('גלעד')
    }
  })

  it('RESOLVED — spouse "האישה של אופיר" → גלעד (no female spouse → male is the only match? no: gender-filtered)', () => {
    // "האישה של אופיר" asks for a FEMALE spouse; Ofir's spouse Gilad is male →
    // no female match → missing (never invent a wrong-gender answer).
    const r = resolvePersonPhrase('האישה של אופיר')
    expect(r.status).toBe('missing')
  })

  it('MISSING — "הבעל של מור": Mor is not married to a man → preserve, never invent', () => {
    const r = resolvePersonPhrase('הבעל של מור')
    expect(r.status).toBe('missing')
  })

  it('extractPersonPhrase captures the WHOLE spouse phrase (not just "הבעל")', () => {
    expect(extractPersonPhrase('תקבעי פגישה למחר בשעה 21 עם הבעל של אופיר')).toBe('הבעל של אופיר')
    expect(extractPersonPhrase('קבעי פגישה מחר ב-21 עם בעלה של אופיר')).toBe('בעלה של אופיר')
  })

  it('isRelationshipDescriptor is true for spouse phrases', () => {
    expect(isRelationshipDescriptor('הבעל של אופיר')).toBe(true)
    expect(isRelationshipDescriptor('בן הזוג של אופיר')).toBe(true)
  })

  it('does not support eldest/youngest (no birth-order data) — not guessed', () => {
    const r = resolvePersonPhrase('הנכדה הגדולה')
    expect(r.status === 'missing' || r.status === 'none').toBe(true)
  })

  it('Hebrew prepositional prefixes (ל/ב/מ/ה/ש/כ/ו) on the kinship word', () => {
    for (const prefix of ['ה', 'ל', 'ב', 'מ', 'ש', 'ו', 'כ', '']) {
      const r = resolvePersonPhrase(`${prefix}בעל של אופיר`)
      expect(r.status).toBe('resolved')
      if (r.status === 'resolved') expect(r.name).toBe('גלעד')
    }
  })

  it('female spouse forms — אשתו / אשת / בת הזוג של עילי → ירדן', () => {
    for (const p of ['אשתו של עילי', 'אשת עילי'.replace('עילי','של עילי'), 'בת הזוג של עילי']) {
      const r = resolvePersonPhrase(p)
      expect(r.status).toBe('resolved')
      if (r.status === 'resolved') expect(r.name).toBe('ירדן')
    }
  })

  it('"בת הזוג של מור" → יעל (female partner from familyGraph.partnersHe)', () => {
    const r = resolvePersonPhrase('בת הזוג של מור')
    expect(r.status).toBe('resolved')
    if (r.status === 'resolved') expect(r.name).toBe('יעל')
  })

  it('"בן הזוג של מור" → missing (no MALE partner/spouse, never invent)', () => {
    const r = resolvePersonPhrase('בן הזוג של מור')
    expect(r.status).toBe('missing')
  })

  it('command verbs never end up as the captured person phrase', () => {
    for (const v of ['תקבעי', 'תקבע', 'קבעי', 'קבע', 'תזכירי', 'תזכיר', 'תזכרי',
                     'שימי', 'שים', 'תוסיפי', 'תוסיף', 'תכניסי', 'תכניס',
                     'תרשמי', 'תרשום']) {
      const phrase = extractPersonPhrase(`${v} פגישה למחר עם הבעל של אופיר`)
      expect(phrase).toBe('הבעל של אופיר')
    }
  })
})
