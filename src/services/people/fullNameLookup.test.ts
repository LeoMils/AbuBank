/*
 * fullNameLookup.test.ts — DEVICE P0 regression: "given name + unknown surname" must resolve.
 * The 739-variant oracle covered given-name spelling variants but NOT "גלעד אבורדי" where the
 * surname is absent from the dataset — people_lookup returned not_found for someone who exists.
 * Subset matching: a given name that uniquely names one person WINS even with an unknown surname.
 */
import { describe, it, expect } from 'vitest'
import { whoIs, resolveContactTarget } from './peopleLookup'
import { subsetResolve, loadPeople, resolvePersonId } from './peopleModel'

const people = loadPeople()
const giladId = resolvePersonId('גלעד', people)

describe('given name + unknown surname (the device P0)', () => {
  it('subsetResolve returns the unique person for "גלעד אבורדי"', () => {
    expect(giladId).toBeTruthy()
    const r = subsetResolve('גלעד אבורדי', people)
    expect(r.status).toBe('resolved')
    if (r.status === 'resolved') expect(r.id).toBe(giladId)
  })
  it('whoIs("גלעד אבורדי") is NOT not_found — it names Gilad', () => {
    const r = whoIs('גלעד אבורדי', people)
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.name).toBe('גלעד')
  })
  it('resolveContactTarget("גלעד אבורדי") resolves to Gilad (reachable)', () => {
    const r = resolveContactTarget('גלעד אבורדי', people)
    // resolved OR deceased(identity) — never not_found for someone in the dataset.
    expect(r.status === 'resolved' || r.status === 'deceased').toBe(true)
  })
  it('generalises: EVERY living person is findable by "givenName + <unknown surname>"', () => {
    const SURNAME = 'אבורדי' // a surname absent from the dataset
    let miss = 0
    for (const p of people.filter((x) => !x.deceased)) {
      const r = subsetResolve(`${p.hebrewName} ${SURNAME}`, people)
      // resolved to SOMEONE (unique given name) OR ambiguous (shared given name) — never 'none'
      if (r.status === 'none') miss++
    }
    expect(miss).toBe(0)
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
