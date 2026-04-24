import { describe, it, expect } from 'vitest'
import { isPersonalQuery, SYSTEM_PROMPT } from './service'

describe('isPersonalQuery', () => {
  describe('calendar queries → true', () => {
    const cases = [
      'מה יש לי מחר?',
      'מה יש לי היום?',
      'מה קורה השבוע?',
      'מתי יש לי רופא?',
      'יש לי פגישה מחר?',
      'מתי התור הבא שלי?',
      'יש אירוע ביומן?',
      'תזכירי לי מחר',
    ]
    for (const q of cases) {
      it(`"${q}" → true`, () => expect(isPersonalQuery(q)).toBe(true))
    }
  })

  describe('family queries → true', () => {
    const cases = [
      'מי זו מור?',
      'מי זה אופיר?',
      'ספרי לי על לאו',
      'מי הנכדים שלי?',
      'מי זאת ירדן?',
      'פפי נפטר מתי?',
    ]
    for (const q of cases) {
      it(`"${q}" → true`, () => expect(isPersonalQuery(q)).toBe(true))
    }
  })

  describe('general queries → false', () => {
    const cases = [
      'ספרי לי על איטליה',
      'מה זה בינה מלאכותית?',
      'תספרי בדיחה',
      'איך מבשלים אורז?',
      'מה מזג האוויר?',
    ]
    for (const q of cases) {
      it(`"${q}" → false`, () => expect(isPersonalQuery(q)).toBe(false))
    }
  })
})

describe('SYSTEM_PROMPT anti-hallucination', () => {
  it('forbids inventing personal facts', () => {
    expect(SYSTEM_PROMPT).toContain('להמציא עובדות אישיות')
  })

  it('forbids saying "יש לך" without tool', () => {
    expect(SYSTEM_PROMPT).toContain('יש לך')
    expect(SYSTEM_PROMPT).toContain('בלי שהכלי החזיר')
  })

  it('requires tool use for calendar', () => {
    expect(SYSTEM_PROMPT).toContain('חייבת להשתמש בכלי')
  })

  it('has empty-result instruction', () => {
    expect(SYSTEM_PROMPT).toContain('תגידי שאין מידע')
  })

  it('has tool-failure instruction', () => {
    expect(SYSTEM_PROMPT).toContain('לא מצליחה לבדוק')
  })

  it('lists forbidden opener phrases in the אסור section', () => {
    const forbidden = SYSTEM_PROMPT.split('אסור:')[1]?.split('מותר:')[0] ?? ''
    expect(forbidden).toContain('בהחלט')
    expect(forbidden).toContain('בשמחה')
    expect(forbidden).toContain('אשמח לעזור')
    expect(forbidden).toContain('איזה יופי')
  })
})
