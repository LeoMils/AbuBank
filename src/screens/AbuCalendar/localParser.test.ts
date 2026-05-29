import { describe, it, expect } from 'vitest'
import { parseLocally, cleanTranscript } from './localParser'

const TODAY = '2026-04-30' // Thursday

describe('cleanTranscript', () => {
  it('strips a stuttered repeated Hebrew word', () => {
    expect(cleanTranscript('מחר מחר בעשר')).toBe('מחר בעשר')
  })

  it('strips a repeated multi-word phrase', () => {
    expect(cleanTranscript('בשעה 10:32 בשעה 10:32 רופא')).toBe('בשעה 10:32 רופא')
  })

  it('normalizes "ב - 3" → "ב-3"', () => {
    expect(cleanTranscript('זה ב - 3')).toBe('זה ב-3')
  })

  it('normalizes "10 :32" → "10:32"', () => {
    expect(cleanTranscript('בשעה 10 :32')).toBe('בשעה 10:32')
  })

  it('collapses doubled commas / periods / whitespace', () => {
    expect(cleanTranscript('רופא,, מחר.. בעשר')).toBe('רופא, מחר. בעשר')
    expect(cleanTranscript('רופא     מחר')).toBe('רופא מחר')
  })
})

describe('parseLocally — hour-only forms ("ב-3", "בשעה 3")', () => {
  it('"ב-3" → 03:00 ambiguous (no period cue)', () => {
    const r = parseLocally('היום ב-3 רופא', TODAY)
    expect(r.time).toBe('03:00')
    expect(r.ambiguousTime).toBe(true)
  })

  it('"ב-3 בצהריים" → 15:00 not ambiguous', () => {
    const r = parseLocally('היום ב-3 בצהריים רופא', TODAY)
    expect(r.time).toBe('15:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"בשעה 12" → 12:00 not ambiguous', () => {
    const r = parseLocally('היום בשעה 12 רופא', TODAY)
    expect(r.time).toBe('12:00')
  })
})

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

describe('parseLocally — runtime regression: "ביום ראשון ב-17.34 …" full sentence', () => {
  const sentence = 'ביום ראשון ב-17.34 אני צריך להיות לישר לרמת גן לרחוב גריניצקי 3 קומה 3 לפגוש את דודה של מנקה שלי שהיא רוצה לעשות מסיבת הפתעה ואני עוזרת לה'
  const r = parseLocally(sentence, '2026-04-30')

  it('preserves exact minutes from "17.34" (period instead of colon)', () => {
    expect(r.time).toBe('17:34')
  })

  it('does not round to 17:00 when minutes are present', () => {
    expect(r.time).not.toBe('17:00')
  })

  it('date is the next Sunday (2026-05-03)', () => {
    expect(r.date).toBe('2026-05-03')
  })

  it('builds location as "street, floor, city"', () => {
    expect(r.location).toBe('רחוב גריניצקי 3, קומה 3, רמת גן')
  })

  it('extracts the action verb as the title (לפגוש את …) and strips "אני צריך להיות לישר"', () => {
    expect(r.title.startsWith('לפגוש את דודה')).toBe(true)
    expect(r.title).not.toContain('אני צריך')
    expect(r.title).not.toContain('להיות')
    expect(r.title).not.toContain('לישר')
    expect(r.title).not.toContain('ביום ראשון')
    expect(r.title).not.toContain('17')
    expect(r.title).not.toContain('רמת גן')
    expect(r.title).not.toContain('קומה')
  })

  it('extracts the relative clause as notes', () => {
    expect(r.notes).toBe('היא רוצה לעשות מסיבת הפתעה ואני עוזרת לה')
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

// ─── Phase 3 — Time Intelligence / AM-PM ────────────────────────────────────
describe('parseLocally — AM/PM explicit period hints', () => {
  it('"9 בערב" → 21:00 not ambiguous', () => {
    const r = parseLocally('מחר פגישה בשעה 9 בערב', TODAY)
    expect(r.time).toBe('21:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"9 בבוקר" → 09:00 not ambiguous', () => {
    const r = parseLocally('מחר רופא בשעה 9 בבוקר', TODAY)
    expect(r.time).toBe('09:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"תשע בערב" → 21:00 not ambiguous', () => {
    const r = parseLocally('מחר בתשע בערב פגישה', TODAY)
    expect(r.time).toBe('21:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"תשע בבוקר" → 09:00 not ambiguous', () => {
    const r = parseLocally('מחר בתשע בבוקר רופא', TODAY)
    expect(r.time).toBe('09:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"תשע וחצי בערב" → 21:30 not ambiguous', () => {
    const r = parseLocally('מחר בתשע וחצי בערב פגישה', TODAY)
    expect(r.time).toBe('21:30')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"תשע וחצי בבוקר" → 09:30 not ambiguous', () => {
    const r = parseLocally('מחר בתשע וחצי בבוקר רופא', TODAY)
    expect(r.time).toBe('09:30')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"12 בצהריים" → 12:00 not ambiguous', () => {
    const r = parseLocally('מחר בשעה 12 בצהריים ארוחה', TODAY)
    expect(r.time).toBe('12:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"12 בלילה" → 00:00 not ambiguous (midnight)', () => {
    const r = parseLocally('הלילה בשעה 12 בלילה קריאה', TODAY)
    expect(r.time).toBe('00:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"שתים עשרה בלילה" → 00:00 (midnight)', () => {
    const r = parseLocally('הלילה בשתים עשרה בלילה', TODAY)
    expect(r.time).toBe('00:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"אחת בצהריים" → 13:00 not ambiguous', () => {
    const r = parseLocally('מחר באחת בצהריים ארוחה', TODAY)
    expect(r.time).toBe('13:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"אחת בלילה" → 01:00 not ambiguous', () => {
    const r = parseLocally('הלילה באחת בלילה', TODAY)
    expect(r.time).toBe('01:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"אחת וחצי בצהריים" → 13:30 not ambiguous', () => {
    const r = parseLocally('מחר באחת וחצי בצהריים קפה', TODAY)
    expect(r.time).toBe('13:30')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"אחת וחצי בלילה" → 01:30 not ambiguous', () => {
    const r = parseLocally('הלילה באחת וחצי בלילה', TODAY)
    expect(r.time).toBe('01:30')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"אחת" alone → 01:00 ambiguous (no period hint)', () => {
    const r = parseLocally('מחר באחת פגישה', TODAY)
    expect(r.time).toBe('01:00')
    expect(r.ambiguousTime).toBe(true)
  })

  // Known product behavior: hours 7-11 alone default to morning (not ambiguous).
  // "9" alone → 09:00. To be revisited if product decides to prompt for AM/PM.
  it('"9" alone → 09:00 (morning default, not ambiguous — known behavior)', () => {
    const r = parseLocally('מחר בשעה 9 פגישה', TODAY)
    expect(r.time).toBe('09:00')
    expect(r.ambiguousTime).toBe(false)
  })
})
