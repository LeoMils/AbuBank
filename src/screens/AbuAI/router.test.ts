import { describe, it, expect } from 'vitest'
import { routePersonalQuery } from './router'

describe('routePersonalQuery', () => {
  describe('calendar_today', () => {
    const cases = [
      'מה יש לי היום?',
      'מה יש היום',
      'יש לי משהו היום?',
      'מה קבעתי היום',
      'מה קורה היום',
    ]
    for (const q of cases) {
      it(`"${q}" → calendar_today`, () => {
        expect(routePersonalQuery(q).type).toBe('calendar_today')
      })
    }
  })

  describe('calendar_tomorrow', () => {
    const cases = [
      'מה יש מחר?',
      'מה יש לי מחר',
      'יש לי משהו מחר?',
      'מה קבעתי מחר',
      'צריך לקום מחר?',
    ]
    for (const q of cases) {
      it(`"${q}" → calendar_tomorrow`, () => {
        expect(routePersonalQuery(q).type).toBe('calendar_tomorrow')
      })
    }
  })

  describe('calendar_upcoming', () => {
    const cases = [
      'מה יש השבוע?',
      'מה יש לי השבוע',
      'מה הפגישות הקרובות?',
      'מה התורים הקרובים',
      'מה האירועים הקרובים',
    ]
    for (const q of cases) {
      it(`"${q}" → calendar_upcoming`, () => {
        expect(routePersonalQuery(q).type).toBe('calendar_upcoming')
      })
    }
  })

  describe('family_lookup', () => {
    it('"מי זה עילי?" → family_lookup', () => {
      const r = routePersonalQuery('מי זה עילי?')
      expect(r.type).toBe('family_lookup')
      expect(r.familyQuery).toContain('עילי')
    })

    it('"מי זאת מור?" → family_lookup', () => {
      const r = routePersonalQuery('מי זאת מור?')
      expect(r.type).toBe('family_lookup')
    })

    it('"איך קוראים לבן של לאו?" → family_lookup', () => {
      expect(routePersonalQuery('איך קוראים לבן של לאו?').type).toBe('family_lookup')
    })

    it('known family name triggers lookup', () => {
      expect(routePersonalQuery('ספרי לי על אופיר').type).toBe('family_lookup')
    })

    it('known family name in Hebrew triggers lookup', () => {
      expect(routePersonalQuery('מה עם גלעד?').type).toBe('family_lookup')
    })
  })

  describe('expanded family patterns', () => {
    it('"מה עם עילי?" → family_lookup via known name', () => {
      expect(routePersonalQuery('מה עם עילי?').type).toBe('family_lookup')
    })

    it('"ספרי לי על מור" → family_lookup via known name', () => {
      expect(routePersonalQuery('ספרי לי על מור').type).toBe('family_lookup')
    })

    it('"תגידי לי על אופיר" → family_lookup via known name', () => {
      expect(routePersonalQuery('תגידי לי על אופיר').type).toBe('family_lookup')
    })

    it('"מה הקשר עם גלעד?" → family_lookup', () => {
      expect(routePersonalQuery('מה הקשר עם גלעד?').type).toBe('family_lookup')
    })

    it('"הנכדים שלי" → family_lookup', () => {
      expect(routePersonalQuery('מי הנכדים שלי?').type).toBe('family_lookup')
    })

    it('"הבת שלי" → family_lookup', () => {
      expect(routePersonalQuery('מי הבת שלי?').type).toBe('family_lookup')
    })

    it('"הילדים שלי" → family_lookup', () => {
      expect(routePersonalQuery('מי הילדים שלי?').type).toBe('family_lookup')
    })

    it('"איך ירדן קשורה?" → family_lookup', () => {
      expect(routePersonalQuery('איך ירדן קשורה?').type).toBe('family_lookup')
    })

    it('every known family Hebrew name routes to family_lookup', () => {
      const names = ['מור', 'לאו', 'אופיר', 'איילון', 'עילי', 'אדר', 'עדי', 'נועם', 'ירדן', 'גלעד', 'יעל', 'פפי', 'טונטו', 'אנאבל', 'ארי']
      for (const name of names) {
        const r = routePersonalQuery(name)
        expect(r.type).toBe('family_lookup')
      }
    })
  })

  describe('family_location', () => {
    it('"איפה מור גרה?" → family_location', () => {
      const r = routePersonalQuery('איפה מור גרה?')
      expect(r.type).toBe('family_location')
      expect(r.familyQuery).toContain('מור')
    })

    it('"איפה גרה מור?" → family_location', () => {
      const r = routePersonalQuery('איפה גרה מור?')
      expect(r.type).toBe('family_location')
    })

    it('"איפה עדי גרה?" → family_location', () => {
      expect(routePersonalQuery('איפה עדי גרה?').type).toBe('family_location')
    })
  })

  describe('non_personal', () => {
    it('"מה מזג האוויר?" → non_personal', () => {
      expect(routePersonalQuery('מה מזג האוויר?').type).toBe('non_personal')
    })

    it('"ספרי לי על איטליה" → non_personal', () => {
      expect(routePersonalQuery('ספרי לי על איטליה').type).toBe('non_personal')
    })

    it('"מה זה בינה מלאכותית?" → non_personal', () => {
      expect(routePersonalQuery('מה זה בינה מלאכותית?').type).toBe('non_personal')
    })

    it('"מה השעה?" → non_personal', () => {
      expect(routePersonalQuery('מה השעה?').type).toBe('non_personal')
    })
  })
})
