/*
 * fuzzyMatch.test.ts — P8: a misheard name finds the right person, but a non-name never does.
 */
import { describe, it, expect } from 'vitest'
import { hebrewPhonetic, editDistance, similarity, fuzzyResolvePersonId, fuzzyCandidates } from './fuzzyMatch'
import { loadPeople } from './peopleModel'
import { whoIs } from './peopleLookup'

describe('hebrew phonetic + edit distance primitives', () => {
  it('collapses the sounds the transcriber confuses (ז/ס, final forms, silent letters)', () => {
    expect(hebrewPhonetic('סוזי')).toBe(hebrewPhonetic('סוסי')) // Susi heard with ס instead of ז
    expect(hebrewPhonetic('אופיר')).toBe(hebrewPhonetic('אופירה'))
  })
  it('editDistance / similarity behave', () => {
    expect(editDistance('גלעד', 'גלעת')).toBe(1)
    expect(similarity('abc', 'abc')).toBe(1)
    expect(similarity('abcd', 'abxd')).toBeCloseTo(0.75, 5)
  })
})

describe('fuzzyResolvePersonId — confident + unambiguous only', () => {
  const cands = fuzzyCandidates(loadPeople())

  it('resolves a misheard family name to the right person', () => {
    expect(fuzzyResolvePersonId('אופירה', cands)?.id).toBe('ofir')  // one ה too many
    expect(fuzzyResolvePersonId('סוסי', cands)?.id).toBe('susi-raz') // ז heard as ס
  })

  it('returns NULL for a non-name (never a wrong guess)', () => {
    expect(fuzzyResolvePersonId('אבוקדו', cands)).toBeNull()
    expect(fuzzyResolvePersonId('מזג האוויר', cands)).toBeNull()
    expect(fuzzyResolvePersonId('בוריס', cands)).toBeNull() // a genuinely-unknown name stays unknown
  })

  it('a too-short fragment does not match', () => {
    expect(fuzzyResolvePersonId('א', cands)).toBeNull()
  })
})

describe('whoIs uses the fuzzy fallback (after exact + descriptive miss)', () => {
  it('a misheard name still identifies the person', () => {
    const w = whoIs('אופירה')
    expect(w.status).toBe('ok')
    if (w.status === 'ok') expect(w.name).toBe('אופיר')
  })
  it('an unknown name is still an honest not_found', () => {
    expect(whoIs('בוריס').status).toBe('not_found')
  })
})
