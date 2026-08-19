/*
 * fullNameLookup.test.ts — DEVICE P0 regression: "given name + unknown surname" must resolve.
 * The 739-variant oracle covered given-name spelling variants but NOT "גלעד אבורדי" where the
 * surname is absent from the dataset — people_lookup returned not_found for someone who exists.
 * Subset matching: a given name that uniquely names one person WINS even with an unknown surname.
 */
import { describe, it, expect } from 'vitest'
import { whoIs, resolveContactTarget, suggestForMiss } from './peopleLookup'
import { subsetResolve, loadPeople, resolvePersonId } from './peopleModel'

const people = loadPeople()
const giladId = resolvePersonId('גלעד', people)

// AMENDMENT: a spoken surname is EVIDENCE. An UNCONFIRMED surname (belongs to no one / a public
// figure who shares a given name) must NOT resolve silently — that is fabrication. It becomes an
// ASK. The device P0 "someone in the dataset must be reachable" is served by the ask, not a silent
// (possibly wrong) resolution.
describe('given name + surname — confirmed resolves, unconfirmed ASKS (no fabrication)', () => {
  it('subsetResolve("גלעד אבורדי") is CONFLICT (surname unconfirmed), not a silent resolve', () => {
    expect(giladId).toBeTruthy()
    const r = subsetResolve('גלעד אבורדי', people)
    expect(r.status).toBe('conflict')
    if (r.status === 'conflict') expect(r.id).toBe(giladId) // the candidate to ASK about
  })
  it('whoIs("גלעד אבורדי") does not silently assert identity; suggestForMiss offers the ask', () => {
    expect(whoIs('גלעד אבורדי', people).status).toBe('not_found') // never a silent fabricated identity
    expect(suggestForMiss('גלעד אבורדי', people)?.id).toBe(giladId) // "did you mean גלעד?" — the exact candidate
  })
  it('resolveContactTarget("גלעד אבורדי") ASKS (single-candidate ambiguous), never a silent resolve', () => {
    const r = resolveContactTarget('גלעד אבורדי', people)
    expect(r.status).toBe('ambiguous')
    if (r.status === 'ambiguous') { expect(r.candidates).toHaveLength(1); expect(r.candidates[0]!.id).toBe(giladId) }
  })
  it('FABRICATION GUARD: a family given name + a public-figure surname does NOT resolve', () => {
    // Take a real family given name and append a famous, non-family surname. It must NOT resolve to
    // the family member (that is the "יצחק רבין → family Yitzhak" fabrication).
    const someone = people.find((p) => !p.deceased && !p.hebrewName.includes(' '))!
    for (const surname of ['רבין', 'קנדי', 'איינשטיין']) {
      const r = subsetResolve(`${someone.hebrewName} ${surname}`, people)
      expect(r.status === 'conflict' || r.status === 'none' || r.status === 'ambiguous').toBe(true)
      expect(r.status).not.toBe('resolved') // never a silent (fabricated) resolution
    }
  })
  it('generalises: no living person is silently resolved by "givenName + <unknown surname>"', () => {
    const SURNAME = 'אבורדיקסון' // a surname absent from the dataset
    let silentResolves = 0
    for (const p of people.filter((x) => !x.deceased && !x.hebrewName.includes(' '))) {
      const r = subsetResolve(`${p.hebrewName} ${SURNAME}`, people)
      if (r.status === 'resolved') silentResolves++ // an unconfirmed surname must never resolve
    }
    expect(silentResolves).toBe(0)
  })
})

describe('subset matching never guesses across DIFFERENT people', () => {
  it('two distinct real names → ambiguous, not a silent pick', () => {
    const r = subsetResolve('מור לאו', people) // two different real people
    // both are real → ambiguous (ask), never a wrong single resolution
    expect(r.status).toBe('ambiguous')
  })
  it('a single word is left to the exact/fuzzy paths (none here)', () => {
    expect(subsetResolve('גלעד', people).status).toBe('none')
  })
})
