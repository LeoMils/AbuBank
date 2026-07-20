/*
 * P5 · ledger intake width (intake-rebuild). Explicit-remember ("תזכרי ש…") covers
 * EVERY chapter kind — residence/work/education/hobby/preference/event, and anything
 * else about a known person falls to a generic STORY fact (nothing lost). A "can't
 * remember" answer where the ledger CAN store is banned. Privacy holds: medical /
 * financial detail is declined, never stored — even on an explicit remember.
 */
import { describe, it, expect } from 'vitest'
import { classifyIntake, extractChange } from './conversationIntake'
import { resolveSinglePerson, isKnownFamilyPerson } from '../screens/AbuAI/familyReasoning'

const factKind = (r: ReturnType<typeof classifyIntake>) =>
  r.change?.op === 'addFact' ? r.change.fact.kind : null
const classify = (u: string) => classifyIntake(u, resolveSinglePerson, isKnownFamilyPerson)

describe('P5 · explicit-remember covers all chapter kinds', () => {
  const CASES: Array<[string, string]> = [
    ['תזכרי שאופיר גרה בחיפה', 'residence'],
    ['תזכרי שאופיר עובדת בגוגל', 'work'],
    ['תזכרי שאופיר למדה רפואה', 'education'],
    ['תזכרי שאופיר מנגנת בפסנתר', 'hobby'],
    ['תזכרי שאופיר אוהבת לטייל', 'preference'],
    ['תזכרי שאופיר התחתנה עם גלעד', 'event'],
    ['תזכרי שאופיר סיפרה על הטיול לפריז', 'story'],   // generic fallback
    ['תזכרי שאופיר תמיד עוזרת לכולם', 'story'],       // arbitrary → story, not lost
  ]
  for (const [utter, kind] of CASES) {
    it(`"${utter}" → explicit / ${kind}`, () => {
      const r = classify(utter)
      expect(r.kind).toBe('explicit')
      expect(factKind(r)).toBe(kind)
    })
  }

  it('a relation-phrase subject resolves in the ledger ("הבת של מור" → אופיר)', () => {
    const r = classify('תזכרי שהבת של מור נסעה ליפן')
    expect(r.kind).toBe('explicit')
    expect(r.change?.op === 'addFact' && r.change.id).toBe('אופיר')
  })
})

describe('P5 · the ledger never says "can\'t remember" where it CAN store', () => {
  const DENIAL = /לא\s+יכולה\s+לזכור|לא\s+יכול\s+לזכור|אי\s+אפשר\s+לזכור|לא\s+זוכרת|can'?t\s+remember/iu
  it('every explicit-remember about a person stores (never ignore) + no denial phrasing', () => {
    for (const u of ['תזכרי שאופיר גרה בחיפה', 'תזכרי שאופיר למדה רפואה', 'תזכרי שאופיר סיפרה סיפור יפה', 'תזכרי שלאו אוסף בולים']) {
      const r = classify(u)
      expect(r.kind).toBe('explicit')
      expect(r.reason).not.toMatch(DENIAL)
      expect(r.confirmPrompt ?? '').not.toMatch(DENIAL)
    }
  })
})

describe('P5 · privacy holds — medical / financial declined, never stored', () => {
  it('a medical statement is NOT stored, even on explicit remember', () => {
    const r = classify('תזכרי שאופיר חולה בסוכרת')
    expect(r.kind).toBe('ignore') // declined by the privacy boundary, not stored
  })
  it('a financial statement is NOT stored', () => {
    const r = classify('תזכרי שאופיר הרוויחה הרבה כסף')
    expect(r.kind).toBe('ignore')
  })
  it('no specific pattern ever emits a health-kind fact', () => {
    const r = extractChange('אופיר חולה בסוכרת')
    expect(r === null || (r.op === 'addFact' && r.fact.kind !== 'health')).toBe(true)
  })
})
