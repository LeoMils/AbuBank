/*
 * relationMatrix.test.ts — agent D: the FULL pair matrix against the deterministic
 * resolver (pure, no model). This is the deterministic half of D's acceptance: for every
 * ordered pair of the close (blood) family, relationshipBetween must return status 'ok'
 * with a ONE-SENTENCE relation ("X <rel> של Y") — the relation itself, no derivation
 * chain, no wider tree. The headline is the trace pair עדי/לאו (INC-04): the resolver
 * gives "עדי בן של לאו", so the ONLY remaining question (measured on the realtime probe)
 * is whether the model now CALLS this resolver instead of answering from the prompt.
 *
 * Names are the canonical Hebrew (via personById) exactly as Martita would say them, so
 * this also proves Hebrew-name resolution round-trips into the resolver.
 */
import { describe, it, expect } from 'vitest'
import { loadPeople, personById } from './peopleModel'
import { relationshipBetween } from './peopleLookup'

const people = loadPeople()
const he = (id: string) => personById(id, people)!.hebrewName

/** The close blood family — every pair is a single derived kinship term (no in-law path). */
const BLOOD = ['martita', 'mor', 'leo', 'ofir', 'eili', 'adi', 'noam', 'adar', 'ayalon'] as const

/** Confident expected relation WORD per ordered pair (from kinship.test's proven kinds). */
const EXPECTED: Array<[string, string, string]> = [
  ['adi', 'leo', 'בן'],        // ← the trace pair (INC-04): Adi is Leo's son
  ['leo', 'mor', 'אח'],
  ['mor', 'leo', 'אחות'],
  ['mor', 'adi', 'דודה'],
  ['adi', 'mor', 'אחיין'],
  ['adi', 'ofir', 'בן דוד'],
  ['ofir', 'adi', 'בת דודה'],
  ['martita', 'ofir', 'סבתא'],
  ['ofir', 'martita', 'נכדה'],
  ['leo', 'ofir', 'דוד'],
  ['leo', 'eili', 'דוד'],
]

describe('agent D — relationship resolver returns a correct ONE-SENTENCE relation', () => {
  it('the trace pair עדי/לאו resolves to a single clean relation, both directions', () => {
    const fwd = relationshipBetween(he('adi'), he('leo'), people)
    expect(fwd.status).toBe('ok')
    expect((fwd as { text: string }).text).toBe('עדי בן של לאו')
    const back = relationshipBetween(he('leo'), he('adi'), people)
    expect(back.status).toBe('ok')
    expect((back as { text: string }).text).toMatch(/^לאו .+ של עדי$/) // parent term, still one sentence
  })

  it('every confident pair returns the expected Hebrew relation word', () => {
    for (const [x, y, word] of EXPECTED) {
      const r = relationshipBetween(he(x), he(y), people)
      expect(r.status, `${he(x)}→${he(y)}`).toBe('ok')
      const text = (r as { text: string }).text
      expect(text, `${he(x)}→${he(y)} = "${text}"`).toContain(word)
    }
  })

  it('FULL blood matrix: every ordered pair is ONE sentence "X <rel> של Y" — never unrelated, never a chain', () => {
    for (const xId of BLOOD) {
      for (const yId of BLOOD) {
        if (xId === yId) continue
        const x = he(xId), y = he(yId)
        const r = relationshipBetween(x, y, people)
        expect(r.status, `${x}→${y} must resolve (close blood family)`).toBe('ok')
        const text = (r as { text: string }).text
        // structure: starts with X, ends with "של Y"
        expect(text.startsWith(x + ' '), `${x}→${y}: "${text}" starts with X`).toBe(true)
        expect(text.endsWith(' של ' + y), `${x}→${y}: "${text}" ends with "של Y"`).toBe(true)
        // ONE sentence, ONE relation: exactly one " של " connector — no derivation chain
        expect((text.match(/ של /g) ?? []).length, `${x}→${y}: "${text}" is a single relation`).toBe(1)
      }
    }
  })

  it('unknown people are not_found, and the resolver never invents a relation', () => {
    expect(relationshipBetween('מישהו שלא קיים', he('leo'), people).status).toBe('not_found')
  })
})
