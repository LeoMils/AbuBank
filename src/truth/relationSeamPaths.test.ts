/*
 * P2 · the ONE seam feeds ALL paths (intake-rebuild session 2).
 * A relation phrase must resolve to the SAME real person whether it arrives via
 * who-is, calendar create/title, search, or the ledger — never punt to the LLM,
 * never fabricate. This proves the create, ledger, and search paths route through
 * familyReasoning.resolveSinglePerson (who-is is covered by relationMorphology.test).
 */
import { describe, it, expect } from 'vitest'
import { parseCreateIntent } from '../screens/AbuAI/calendarCreate'
import { extractChange, classifyIntake } from './conversationIntake'
import { resolveSinglePerson } from '../screens/AbuAI/familyReasoning'
import { resolvePersonPhrase } from '../screens/AbuAI/personPhraseResolver'

describe('P2 path · calendar create/title resolves a relation-phrase companion', () => {
  const title = (utter: string) => parseCreateIntent(utter)?.draft.title ?? ''

  it('"עם בת הזוג של מור" → title names יעל, not the phrase', () => {
    const t = title('תקבע לי פגישה עם בת הזוג של מור מחר בשלוש')
    expect(t).toContain('יעל')
    expect(t).not.toContain('בת הזוג')
  })
  it('in-law: "עם החתן של מור" → title names גלעד', () => {
    const t = title('תקבע לי פגישה עם החתן של מור מחר בשלוש')
    expect(t).toContain('גלעד')
    expect(t).not.toContain('החתן')
  })
  it('blood: "עם הבת של מרטיטה" → title names מור', () => {
    expect(title('תקבע לי פגישה עם הבת של מרטיטה מחר בשלוש')).toContain('מור')
  })
  it('an unknown "<x> של <y>" is left literal (never invented)', () => {
    const t = title('תקבע לי פגישה עם הכלב של מור מחר בשלוש')
    expect(t).toContain('הכלב') // dog, not kin — unchanged
  })
})

describe('P2 path · ledger resolves a relation-phrase SUBJECT then LAWS-gates', () => {
  it('"הבת של מור גרה בחיפה" → residence fact for אופיר', () => {
    const c = extractChange('הבת של מור גרה בחיפה', resolveSinglePerson)
    expect(c).toEqual({ op: 'addFact', id: 'אופיר', fact: { kind: 'residence', value: 'חיפה', source: 'conversation', at: 0 } })
  })
  it('explicit "תזכרי שהבת של מור עובדת בגוגל" → work fact for אופיר', () => {
    const r = classifyIntake('תזכרי שהבת של מור עובדת בגוגל', resolveSinglePerson)
    expect(r.kind).toBe('explicit')
    expect(r.change).toEqual({ op: 'addFact', id: 'אופיר', fact: { kind: 'work', value: 'גוגל', source: 'conversation', at: 0 } })
  })
  it('poison survives resolution: "אופיר היא אשתו של רפי" stays addSpouse for the LAWS gate to refuse', () => {
    // רפי has no wife, so the phrase resolves to nobody → no substitution → the
    // relationship claim reaches THE LAWS unchanged (Ofir is Rafi's daughter → refused there).
    const c = extractChange('אופיר היא אשתו של רפי', resolveSinglePerson)
    expect(c).toEqual({ op: 'addSpouse', a: 'אופיר', b: 'רפי' })
  })
  it('the resolver is what makes it correct: without it the fact mis-binds to the ANCHOR (מור), with it → אופיר', () => {
    // The bare residence regex grabs "מור גרה בחיפה" → wrong subject. The injected
    // seam is precisely what redirects the fact to the referenced person.
    const idOf = (c: ReturnType<typeof extractChange>) => (c && 'id' in c ? c.id : undefined)
    expect(idOf(extractChange('הבת של מור גרה בחיפה'))).toBe('מור')
    expect(idOf(extractChange('הבת של מור גרה בחיפה', resolveSinglePerson))).toBe('אופיר')
  })
})

describe('P2 path · search resolves through the SAME seam (delegated resolver)', () => {
  it('"החתן של רפי" → גלעד', () => { expect(resolvePersonPhrase('החתן של רפי')).toBe('גלעד') })
  it('"בת הזוג של מור" → יעל', () => { expect(resolvePersonPhrase('בת הזוג של מור')).toBe('יעל') })
  it('ambiguous multi-person → null (never guesses)', () => {
    expect(resolvePersonPhrase('הבן של רפי')).toBeNull() // 3 sons
  })
})
