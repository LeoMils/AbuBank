import { describe, it, expect } from 'vitest'
import { resolvePersonPhrase } from './personPhraseResolver'

describe('resolvePersonPhrase — relation phrase → real person (family graph)', () => {
  // In-laws (Leo device #1): רפי's daughter אופיר married גלעד → חתן של רפי = גלעד.
  it('"החתן של רפי" → גלעד (son-in-law by composition)', () => {
    expect(resolvePersonPhrase('החתן של רפי')).toBe('גלעד')
  })
  it('"הכלה של רפי" → ירדן (daughter-in-law: son עילי\'s wife)', () => {
    expect(resolvePersonPhrase('הכלה של רפי')).toBe('ירדן')
  })
  it('"החתן של מור" → גלעד (Mor\'s daughter Ofir\'s husband)', () => {
    expect(resolvePersonPhrase('החתן של מור')).toBe('גלעד')
  })
  // Blood
  it('"הבת של מור" → אופיר', () => { expect(resolvePersonPhrase('הבת של מור')).toBe('אופיר') })
  it('"אמא של אופיר" → מור', () => { expect(resolvePersonPhrase('אמא של אופיר')).toBe('מור') })
  it('"הבן של מרטיטה" → לאו', () => { expect(resolvePersonPhrase('הבן של מרטיטה')).toBe('לאו') })
  // Honest nulls
  it('a plain name is not a relation phrase → null', () => {
    expect(resolvePersonPhrase('רפי')).toBeNull()
    expect(resolvePersonPhrase('גבי')).toBeNull()
  })
  it('unknown target → null (never guesses)', () => {
    expect(resolvePersonPhrase('החתן של מישהו')).toBeNull()
  })
  it('ambiguous (more than one) → null (never picks one)', () => {
    // Martita has 2 children (Mor, Leo) → "הילד/הבן של" is singular male → Leo only;
    // but "בן דוד" etc. left as null via default. Use a genuinely ambiguous case:
    // Rafi has multiple children, so "הבן של רפי" (sons: איילון, עילי, אדר) is ambiguous.
    expect(resolvePersonPhrase('הבן של רפי')).toBeNull()
  })
})
