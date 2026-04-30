import { describe, it, expect } from 'vitest'
import { parseLocally } from './localParser'

const TODAY = '2026-04-30' // Thursday

describe('parseLocally — time', () => {
  it('preserves exact minutes from numeric "2:34"', () => {
    const r = parseLocally('מחר בשעה 2:34 רופא', TODAY)
    expect(r.time).toBe('02:34')
    expect(r.ambiguousTime).toBe(true)
  })

  it('keeps numeric 14:34 as-is (unambiguous afternoon)', () => {
    const r = parseLocally('מחר בשעה 14:34 רופא', TODAY)
    expect(r.time).toBe('14:34')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"בעשר" → 10:00 (not ambiguous)', () => {
    const r = parseLocally('מחר בעשר רופא', TODAY)
    expect(r.time).toBe('10:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"בארבע אחרי הצהריים" → 16:00 not ambiguous', () => {
    const r = parseLocally('מחר בארבע אחרי הצהריים פגישה', TODAY)
    expect(r.time).toBe('16:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"בארבע בבוקר" → 04:00 not ambiguous', () => {
    const r = parseLocally('מחר בארבע בבוקר טיסה', TODAY)
    expect(r.time).toBe('04:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('parses Hebrew "בשתיים שלושים וארבע"', () => {
    const r = parseLocally('מחר בשתיים שלושים וארבע תור אצל התופרת', TODAY)
    expect(r.time).toBe('02:34')
    expect(r.ambiguousTime).toBe(true)
  })

  it('parses "בשתיים וחצי" → 02:30 ambiguous', () => {
    const r = parseLocally('היום בשתיים וחצי קפה', TODAY)
    expect(r.time).toBe('02:30')
    expect(r.ambiguousTime).toBe(true)
  })
})

describe('parseLocally — location', () => {
  it('extracts street + number + city', () => {
    const r = parseLocally('מחר בשעה 14:00 תור אצל התופרת ברחוב קוק 14 בהרצליה', TODAY)
    expect(r.location).toBe('רחוב קוק 14, הרצליה')
  })

  it('extracts street alone', () => {
    const r = parseLocally('מחר בעשר פגישה ברחוב הרצל 22', TODAY)
    expect(r.location).toBe('רחוב הרצל 22')
  })

  it('extracts city alone', () => {
    const r = parseLocally('מחר בעשר תור בכפר סבא', TODAY)
    expect(r.location).toBe('כפר סבא')
  })
})

describe('parseLocally — notes', () => {
  it('extracts notes after second "יש לי" (reason)', () => {
    const r = parseLocally(
      'מחר בשעה 2:34 יש לי תור אצל התופרת ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים',
      TODAY,
    )
    expect(r.notes).toBe('חור במכנסיים')
  })

  it('extracts notes after "כי"', () => {
    const r = parseLocally('מחר בעשר רופא כי כואב לי הראש', TODAY)
    expect(r.notes).toBe('כואב לי הראש')
  })

  it('extracts notes after "בגלל"', () => {
    const r = parseLocally('מחר בעשר תור בגלל הגב', TODAY)
    expect(r.notes).toBe('הגב')
  })
})

describe('parseLocally — emoji', () => {
  it('seamstress: תופרת → 🧵', () => {
    const r = parseLocally('מחר בשעה 14:00 תור אצל התופרת', TODAY)
    expect(r.emoji).toBe('🧵')
  })

  it('מכנסיים in notes drives 🧵', () => {
    const r = parseLocally('מחר בשעה 14:00 תור, יש לי חור במכנסיים', TODAY)
    expect(r.emoji).toBe('🧵')
  })

  it('רופא → 🏥', () => {
    const r = parseLocally('מחר בעשר רופא', TODAY)
    expect(r.emoji).toBe('🏥')
  })

  it('קניות → 🛒', () => {
    const r = parseLocally('מחר בעשר קניות', TODAY)
    expect(r.emoji).toBe('🛒')
  })

  it('ארוחה → 🍽️', () => {
    const r = parseLocally('מחר בשמונה ארוחה משפחתית', TODAY)
    expect(r.emoji).toBe('🍽️')
  })
})

describe('parseLocally — title', () => {
  it('keeps "תור אצל התופרת" intact, not collapsed to "פגישה"', () => {
    const r = parseLocally('מחר בשעה 14:00 יש לי תור אצל התופרת', TODAY)
    expect(r.title).toContain('תור אצל התופרת')
    expect(r.title).not.toBe('פגישה')
  })
})

describe('parseLocally — full noisy bug sentence', () => {
  const sentence = 'מחר בשעה 2:34 יש לי תור אצל התופרת ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים'

  it('produces the expected draft', () => {
    const r = parseLocally(sentence, TODAY)
    expect(r.title).toContain('תור אצל התופרת')
    expect(r.title).not.toContain('יש לי')
    expect(r.title).not.toContain('ברחוב')
    expect(r.date).toBe('2026-05-01')
    expect(r.time).toBe('02:34')
    expect(r.ambiguousTime).toBe(true)
    expect(r.location).toBe('רחוב קוק 14, הרצליה')
    expect(r.notes).toBe('חור במכנסיים')
    expect(r.emoji).toBe('🧵')
    expect(r.confidence).toBeGreaterThanOrEqual(0.5)
  })
})

describe('parseLocally — runtime regression sentence (10:32 word order)', () => {
  const sentence = 'יש לי תור אצל התופרת מחר בשעה 10:32 ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים'

  it('does not put the whole sentence into the title', () => {
    const r = parseLocally(sentence, TODAY)
    expect(r.title).not.toBe(sentence)
    expect(r.title).not.toContain('ברחוב')
    expect(r.title).not.toContain('מחר')
    expect(r.title).not.toContain('10:32')
    expect(r.title).not.toContain('יש לי')
  })

  it('extracts title exactly "תור אצל התופרת"', () => {
    const r = parseLocally(sentence, TODAY)
    expect(r.title).toBe('תור אצל התופרת')
  })

  it('preserves numeric time 10:32 unrounded', () => {
    const r = parseLocally(sentence, TODAY)
    expect(r.time).toBe('10:32')
    expect(r.ambiguousTime).toBe(false)
  })

  it('date is tomorrow', () => {
    const r = parseLocally(sentence, TODAY)
    expect(r.date).toBe('2026-05-01')
  })

  it('extracts location "רחוב קוק 14, הרצליה"', () => {
    const r = parseLocally(sentence, TODAY)
    expect(r.location).toBe('רחוב קוק 14, הרצליה')
  })

  it('extracts notes "חור במכנסיים"', () => {
    const r = parseLocally(sentence, TODAY)
    expect(r.notes).toBe('חור במכנסיים')
  })

  it('emoji is 🧵', () => {
    const r = parseLocally(sentence, TODAY)
    expect(r.emoji).toBe('🧵')
  })
})

describe('parseLocally — date', () => {
  it('"מחר" → tomorrow', () => {
    const r = parseLocally('מחר בעשר רופא', TODAY)
    expect(r.date).toBe('2026-05-01')
  })

  it('"היום" → today', () => {
    const r = parseLocally('היום בשבע ארוחה', TODAY)
    expect(r.date).toBe(TODAY)
  })

  it('"ביום ראשון" → next Sunday', () => {
    const r = parseLocally('ביום ראשון בעשר רופא', TODAY)
    expect(r.date).toBe('2026-05-03')
  })
})
