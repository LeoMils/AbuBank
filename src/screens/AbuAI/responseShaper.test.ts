import { describe, it, expect } from 'vitest'
import { shapeFamilyAnswer, shapeLocationAnswer, shapeCalendarAnswer, shapeNotFound, shapeToolError, timeInWords, shapeCreateConfirm, shapeCreateConfirmReadback, shapeCreateSaved, shapeCreateCancelled, shapeCreateClarify } from './responseShaper'
import type { FamilyMember } from '../../services/familyLoader'

const makeMember = (overrides: Partial<FamilyMember> = {}): FamilyMember => ({
  canonicalName: 'Mor', hebrew: 'מור', aliases: ['מור'],
  relationship: 'daughter', relationshipHebrew: 'הבת, גרושה מרפי, בת זוג של יעל',
  ...overrides,
})

// ─── timeInWords — spoken Hebrew hours ──────────────────────────────────────

describe('timeInWords', () => {
  it('10:00 → בעשר בבוקר', () => expect(timeInWords('10:00')).toBe('בעשר בבוקר'))
  it('15:00 → בשלוש אחר הצהריים', () => expect(timeInWords('15:00')).toBe('בשלוש אחר הצהריים'))
  it('19:00 → בשבע בערב', () => expect(timeInWords('19:00')).toBe('בשבע בערב'))
  it('20:00 → בשמונה בערב', () => expect(timeInWords('20:00')).toBe('בשמונה בערב'))
  it('14:30 → בשתיים וחצי אחר הצהריים', () => expect(timeInWords('14:30')).toBe('בשתיים וחצי אחר הצהריים'))
  it('00:00 → בחצות', () => expect(timeInWords('00:00')).toBe('בחצות'))
  it('12:00 → בצהריים', () => expect(timeInWords('12:00')).toBe('בצהריים'))
  it('09:00 → בתשע בבוקר', () => expect(timeInWords('09:00')).toBe('בתשע בבוקר'))
  it('odd minutes use raw time', () => expect(timeInWords('10:15')).toContain('10:15'))
  it('never outputs bare digits like ב10', () => {
    // All standard hours should use words
    for (const h of ['08:00', '10:00', '14:00', '17:00', '20:00']) {
      expect(timeInWords(h)).not.toMatch(/ב\d/)
    }
  })
})

// ─── Family ─────────────────────────────────────────────────────────────────

describe('shapeFamilyAnswer', () => {
  it('Mor: natural pronoun sentence', () => {
    const answer = shapeFamilyAnswer(makeMember({
      children: ['אופיר', 'איילון', 'עילי', 'אדר'],
    }))
    expect(answer).toContain('מור היא הבת שלך.')
    expect(answer).toContain('היא גרושה מרפי, בת זוג של יעל.')
    expect(answer).toContain('הילדים שלה — אופיר, איילון, עילי ואדר.')
  })

  it('grandson uses dash format', () => {
    const answer = shapeFamilyAnswer(makeMember({ relationshipHebrew: 'נכד (בן של מור ורפי)' }))
    expect(answer).toContain('מור —')
  })

  it('children list uses ו before last name', () => {
    expect(shapeFamilyAnswer(makeMember({ children: ['א', 'ב', 'ג'] }))).toContain('א, ב וג')
  })

  it('single child — no ו', () => {
    expect(shapeFamilyAnswer(makeMember({ children: ['נועם'] }))).toContain('הילדים שלה — נועם')
  })

  it('includes notes', () => {
    expect(shapeFamilyAnswer(makeMember({ notes: 'גרה בהוד השרון.' }))).toContain('גרה בהוד השרון')
  })

  it('never empty', () => {
    expect(shapeFamilyAnswer(makeMember()).length).toBeGreaterThan(5)
  })

  it('no hallucination — only uses provided fields', () => {
    const m = makeMember()
    delete (m as any).children
    delete (m as any).notes
    delete (m as any).spouse
    const answer = shapeFamilyAnswer(m)
    expect(answer).not.toContain('ילדים')
    expect(answer).not.toContain('בן הזוג')
    expect(answer).not.toContain('בת הזוג')
  })

  it('gendered spouse label', () => {
    expect(shapeFamilyAnswer(makeMember({ relationshipHebrew: 'הבת', spouse: 'יעל' }))).toContain('בן הזוג שלה')
    expect(shapeFamilyAnswer(makeMember({ relationshipHebrew: 'הבן', spouse: 'דנה' }))).toContain('בת הזוג שלו')
  })

  it('newline-separated for speech pacing', () => {
    expect(shapeFamilyAnswer(makeMember({ children: ['אופיר'] }))).toContain('\n')
  })
})

// ─── Location ───────────────────────────────────────────────────────────────

describe('shapeLocationAnswer', () => {
  it('single sentence with comma for notes', () => {
    expect(shapeLocationAnswer('מור', 'הוד השרון', 'בווילה עם יעל'))
      .toBe('מור גרה בהוד השרון, בווילה עם יעל.')
  })

  it('clean without notes', () => {
    expect(shapeLocationAnswer('עדי', 'תל אביב')).toBe('עדי גרה בתל אביב.')
  })
})

// ─── Calendar Read ──────────────────────────────────────────────────────────

describe('shapeCalendarAnswer', () => {
  it('empty today — short, no מרטיטה', () => {
    expect(shapeCalendarAnswer([], 'today')).toBe('לא מצאתי משהו ביומן להיום.')
  })

  it('empty tomorrow', () => {
    expect(shapeCalendarAnswer([], 'tomorrow')).toBe('לא מצאתי משהו ביומן למחר.')
  })

  it('empty week', () => {
    const answer = shapeCalendarAnswer([], 'week')
    expect(answer).toContain('לא מצאתי')
    expect(answer).not.toContain('מרטיטה')
  })

  it('single event — fact first, time on second line', () => {
    const answer = shapeCalendarAnswer(
      [{ id: '1', title: 'רופא', date: '2026-04-30', time: '10:00', emoji: '🏥', color: '#C9A84C' }],
      'today'
    )
    expect(answer).toBe('היום יש לך רופא.\nבעשר בבוקר.')
  })

  it('single event — no מרטיטה', () => {
    const answer = shapeCalendarAnswer(
      [{ id: '1', title: 'פגישה', date: '2026-05-01', time: '15:00', emoji: '📅', color: '#C9A84C' }],
      'tomorrow'
    )
    expect(answer).not.toContain('מרטיטה')
    expect(answer).toContain('מחר יש לך פגישה')
    expect(answer).toContain('בשלוש אחר הצהריים')
  })

  it('birthday — no extras', () => {
    const answer = shapeCalendarAnswer(
      [{ id: '1', title: 'יום הולדת אופיר 🎂', date: '2026-02-15', time: '09:00', emoji: '🎂', color: '#FF6B9D', type: 'birthday' as const }],
      'today'
    )
    expect(answer).toBe('היום יום הולדת אופיר 🎂.')
  })

  it('multiple events — spoken count, time—title', () => {
    const events = [
      { id: '1', title: 'רופא', date: '2026-04-30', time: '10:00', emoji: '🏥', color: '#C9A84C' },
      { id: '2', title: 'קניות', date: '2026-04-30', time: '14:00', emoji: '🛒', color: '#C9A84C' },
    ]
    const answer = shapeCalendarAnswer(events, 'today')
    expect(answer).toContain('שני דברים')
    expect(answer).toContain('בעשר בבוקר — רופא.')
    expect(answer).toContain('בשתיים אחר הצהריים — קניות.')
    expect(answer).not.toContain('מרטיטה')
  })

  it('3 events uses שלושה', () => {
    const events = [
      { id: '1', title: 'רופא', date: '2026-04-30', time: '09:00', emoji: '🏥', color: '#C9A84C' },
      { id: '2', title: 'קניות', date: '2026-04-30', time: '14:00', emoji: '🛒', color: '#C9A84C' },
      { id: '3', title: 'ארוחה', date: '2026-04-30', time: '19:00', emoji: '🍽️', color: '#C9A84C' },
    ]
    expect(shapeCalendarAnswer(events, 'today')).toContain('שלושה דברים')
  })

  it('never empty string', () => {
    expect(shapeCalendarAnswer([], 'today').length).toBeGreaterThan(5)
  })

  it('no invented facts', () => {
    const answer = shapeCalendarAnswer(
      [{ id: '1', title: 'פגישה', date: '2026-05-01', time: '15:00', emoji: '📅', color: '#C9A84C' }],
      'today'
    )
    expect(answer).not.toContain('דוקטור')
    expect(answer).toContain('פגישה')
  })

  it('no bare digits in time', () => {
    const answer = shapeCalendarAnswer(
      [{ id: '1', title: 'רופא', date: '2026-04-30', time: '10:00', emoji: '🏥', color: '#C9A84C' }],
      'today'
    )
    expect(answer).not.toMatch(/ב\d+ ב/)
    expect(answer).toContain('בעשר')
  })
})

// ─── Calendar Create ────────────────────────────────────────────────────────

describe('shapeCreateConfirm', () => {
  it('אצל אופיר → להיות אצל אופיר', () => {
    const msg = shapeCreateConfirm({ title: 'אצל אופיר', date: '2026-05-06', time: '17:00', emoji: '📅' })
    expect(msg).toContain('אני קובעת לך להיות אצל אופיר')
    expect(msg).toContain('בחמש')
    expect(msg).toContain('זה נכון?')
  })

  it('רופא → תור לרופא kept as-is', () => {
    const msg = shapeCreateConfirm({ title: 'תור לרופא', date: '2026-05-01', time: '10:00', emoji: '🏥' })
    expect(msg).toContain('אני קובעת לך תור לרופא')
    expect(msg).toContain('בעשר בבוקר')
  })

  it('ארוחת ערב kept as-is', () => {
    const msg = shapeCreateConfirm({ title: 'ארוחת ערב עם המשפחה', date: '2026-05-01', time: '20:00', emoji: '🍽️' })
    expect(msg).toContain('אני קובעת לך ארוחת ערב עם המשפחה')
    expect(msg).toContain('בשמונה בערב')
  })

  it('no title → fallback to משהו', () => {
    const msg = shapeCreateConfirm({ title: null, date: '2026-05-01', time: '15:00', emoji: '📅' })
    expect(msg).toContain('אני קובעת לך משהו')
    expect(msg).not.toContain('undefined')
    expect(msg).not.toContain('null')
  })

  it('no time → no time in output', () => {
    const msg = shapeCreateConfirm({ title: 'פגישה', date: '2026-05-01', time: null, emoji: '📅' })
    expect(msg).toContain('אני קובעת לך פגישה')
    expect(msg).not.toContain('undefined')
  })

  it('says מחר for tomorrow date', () => {
    const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]!
    const msg = shapeCreateConfirm({ title: 'קניות', date: tmrw, time: '10:00', emoji: '🛒' })
    expect(msg).toContain('מחר')
  })

  it('never contains מצאתי/שמרתי/draft', () => {
    const msg = shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '10:00', emoji: '🏥' })
    expect(msg).not.toContain('מצאתי')
    expect(msg).not.toContain('שמרתי')
    expect(msg).not.toContain('draft')
  })

  it('default shapeCreateConfirm output is unchanged for the baseline fixture', () => {
    // Pin the existing wording so the readback variant cannot accidentally
    // alter it via shared helpers.
    const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]!
    const msg = shapeCreateConfirm({ title: 'תור לרופא', date: tmrw, time: '10:00', emoji: '🏥' })
    expect(msg).toContain('אני קובעת לך תור לרופא')
    expect(msg).toContain('מחר')
    expect(msg).toContain('בעשר בבוקר')
    expect(msg.trim().endsWith('זה נכון?')).toBe(true)
    expect(msg).not.toContain('הבנתי')
    expect(msg).not.toContain('לקבוע?')
  })
})

// ─── Calendar Create Read-back ──────────────────────────────────────────────

describe('shapeCreateConfirmReadback', () => {
  const tmrw = () => new Date(Date.now() + 86400000).toISOString().split('T')[0]!

  it('happy path — all fields → ends with לקבוע? and includes every clause', () => {
    const msg = shapeCreateConfirmReadback({
      title: 'תור אצל התופרת',
      personName: null,
      date: tmrw(),
      time: '17:00',
      location: 'רחוב קוק 14, הרצליה',
      notes: 'חור במכנסיים',
    })
    expect(msg).toContain('הבנתי')
    expect(msg).toContain('תור אצל התופרת')
    expect(msg).toContain('מחר')
    expect(msg).toContain('בחמש')
    expect(msg).toContain('רחוב קוק 14, הרצליה')
    expect(msg).toContain('הסיבה: חור במכנסיים')
    expect(msg.trim().endsWith('לקבוע?')).toBe(true)
    expect(msg).not.toContain('undefined')
    expect(msg).not.toContain('null')
  })

  it('uses personName when title is missing', () => {
    const msg = shapeCreateConfirmReadback({
      title: null,
      personName: 'דר כהן',
      date: tmrw(),
      time: '09:00',
      location: null,
      notes: null,
    })
    expect(msg).toContain('פגישה עם דר כהן')
    expect(msg.trim().endsWith('לקבוע?')).toBe(true)
  })

  it('missing time → asks "לא שמעתי שעה — באיזו שעה?" and does NOT say "לקבוע?"', () => {
    const msg = shapeCreateConfirmReadback({
      title: 'תור אצל הרופא',
      date: tmrw(),
      time: null,
      location: null,
      notes: null,
    })
    expect(msg).toContain('לא שמעתי שעה')
    expect(msg).toContain('באיזו שעה?')
    expect(msg).not.toContain('לקבוע?')
    expect(msg).not.toContain('undefined')
    expect(msg).not.toContain('null')
  })

  it('missing date → asks "לא שמעתי תאריך — מתי?" and does NOT say "לקבוע?"', () => {
    const msg = shapeCreateConfirmReadback({
      title: 'תור אצל הרופא',
      date: null,
      time: '09:00',
      location: null,
      notes: null,
    })
    expect(msg).toContain('לא שמעתי תאריך')
    expect(msg).toContain('מתי?')
    expect(msg).not.toContain('לקבוע?')
    expect(msg).not.toContain('undefined')
    expect(msg).not.toContain('null')
  })

  it('missing location → omits location clause, still ends with "לקבוע?"', () => {
    const msg = shapeCreateConfirmReadback({
      title: 'ארוחה עם מור',
      date: tmrw(),
      time: '14:00',
      location: null,
      notes: 'יום הולדת',
    })
    expect(msg).toContain('ארוחה עם מור')
    expect(msg).toContain('הסיבה: יום הולדת')
    expect(msg.trim().endsWith('לקבוע?')).toBe(true)
    expect(msg).not.toContain('ב\n')
    expect(msg).not.toContain('undefined')
  })

  it('missing notes → omits "הסיבה" clause, still ends with "לקבוע?"', () => {
    const msg = shapeCreateConfirmReadback({
      title: 'תור אצל הרופא',
      date: tmrw(),
      time: '09:00',
      location: 'מכבי',
      notes: null,
    })
    expect(msg).not.toContain('הסיבה')
    expect(msg).toContain('מכבי')
    expect(msg.trim().endsWith('לקבוע?')).toBe(true)
  })

  it('ambiguousTime: true → returns clarification, NOT a "לקבוע?" final', () => {
    const msg = shapeCreateConfirmReadback({
      title: 'תור אצל התופרת',
      date: tmrw(),
      time: '02:34',
      location: null,
      notes: null,
      ambiguousTime: true,
    })
    expect(msg).toContain('02:34')
    expect(msg).toContain('בצהריים או בלילה')
    expect(msg).not.toContain('לקבוע?')
    expect(msg).not.toContain('בלילה.')   // does not auto-assume night
  })

  it('exact-minute preservation: 10:32 / 02:34 / 17:34 are not rounded', () => {
    for (const t of ['10:32', '02:34', '17:34']) {
      const msg = shapeCreateConfirmReadback({
        title: 'אירוע',
        date: tmrw(),
        time: t,
        location: null,
        notes: null,
      })
      expect(msg).toContain(t)
      expect(msg).not.toContain('10:00')
      // pin: should not contain rounded forms when raw minute is non-zero
    }
  })

  it('never contains מצאתי/שמרתי/draft', () => {
    const msg = shapeCreateConfirmReadback({
      title: 'רופא',
      date: tmrw(),
      time: '10:00',
      location: null,
      notes: null,
    })
    expect(msg).not.toContain('מצאתי')
    expect(msg).not.toContain('שמרתי')
    expect(msg).not.toContain('draft')
  })
})

describe('shapeCreateSaved', () => {
  it('short confirmation', () => {
    expect(shapeCreateSaved()).toBe('נרשם ביומן.')
  })
})

describe('shapeCreateCancelled', () => {
  it('natural cancel', () => {
    expect(shapeCreateCancelled()).toContain('עזבתי')
  })
})

describe('shapeCreateClarify', () => {
  it('time', () => expect(shapeCreateClarify(['time'])).toContain('שעה'))
  it('date', () => expect(shapeCreateClarify(['date'])).toContain('יום'))
  it('title', () => expect(shapeCreateClarify(['title'])).toContain('מה לרשום'))
})

// ─── Fallbacks ──────────────────────────────────────────────────────────────

describe('shapeNotFound', () => {
  it('with context', () => expect(shapeNotFound('דניאל')).toContain('דניאל'))
  it('without context', () => expect(shapeNotFound()).toContain('לא מצאתי'))
})

describe('shapeToolError', () => {
  it('human, short', () => {
    const msg = shapeToolError()
    expect(msg).toContain('אני לא מצליחה לבדוק')
    expect(msg).toContain('נסי שוב')
  })
})

