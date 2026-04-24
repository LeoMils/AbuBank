import { describe, it, expect } from 'vitest'
import { classifyPriority, classifyMeaning, sortByPriority, narrateDay, narrateRange, getPreEventHint, getSuggestion, getPostEventFollowUp, shouldSpeak, type EventMeaning } from './narration'
import { type Appointment } from './service'

const makeAppt = (title: string, date: string, time: string): Appointment => ({
  id: 'test', title, date, time, emoji: '📅', color: '#C9A84C',
})

describe('classifyMeaning', () => {
  const cases: [string, EventMeaning][] = [
    ['רופא שיניים', 'medical'],
    ['בדיקת דם', 'medical'],
    ['תרופות', 'medical'],
    ['פגישה עם חברה', 'social'],
    ['יום הולדת של מור', 'social'],
    ['ארוחת ערב', 'social'],
    ['עורך דין', 'administrative'],
    ['ביטוח לאומי', 'administrative'],
    ['תספורת', 'optional'],
    ['קניות בסופר', 'optional'],
    ['משהו', 'optional'],
  ]
  for (const [title, expected] of cases) {
    it(`"${title}" → ${expected}`, () => {
      expect(classifyMeaning(makeAppt(title, '2026-04-22', '10:00'))).toBe(expected)
    })
  }
})

describe('classifyPriority', () => {
  it('medical → critical', () => {
    expect(classifyPriority(makeAppt('רופא', '2026-04-22', '10:00'))).toBe('critical')
  })
  it('social → high', () => {
    expect(classifyPriority(makeAppt('פגישה', '2026-04-22', '14:00'))).toBe('high')
  })
  it('optional → normal', () => {
    expect(classifyPriority(makeAppt('קניות', '2026-04-22', '11:00'))).toBe('normal')
  })
})

describe('sortByPriority', () => {
  it('critical before high before normal', () => {
    const appts = [
      makeAppt('קניות', '2026-04-22', '09:00'),
      makeAppt('רופא', '2026-04-22', '14:00'),
      makeAppt('פגישה', '2026-04-22', '11:00'),
    ]
    const sorted = sortByPriority(appts)
    expect(sorted[0]!.title).toBe('רופא')
    expect(sorted[1]!.title).toBe('פגישה')
    expect(sorted[2]!.title).toBe('קניות')
  })

  it('same priority sorted by time', () => {
    const appts = [
      makeAppt('קניות ב', '2026-04-22', '14:00'),
      makeAppt('קניות א', '2026-04-22', '09:00'),
    ]
    const sorted = sortByPriority(appts)
    expect(sorted[0]!.title).toBe('קניות א')
  })
})

describe('narrateDay', () => {
  const today = '2026-04-22'
  const morning = new Date('2026-04-22T08:00:00')

  it('empty day', () => {
    expect(narrateDay([], today, today, morning)).toContain('פנוי')
  })

  it('single critical event says שימי לב', () => {
    const appts = [makeAppt('רופא שיניים', today, '10:00')]
    expect(narrateDay(appts, today, today, morning)).toContain('שימי לב')
  })

  it('multiple events — critical first', () => {
    const appts = [
      makeAppt('קניות', today, '09:00'),
      makeAppt('בדיקת דם', today, '14:00'),
    ]
    const result = narrateDay(appts, today, today, morning)
    expect(result.indexOf('בדיקת דם')).toBeLessThan(result.indexOf('קניות'))
  })

  it('tomorrow uses relative day', () => {
    expect(narrateDay([makeAppt('תספורת', '2026-04-23', '11:00')], '2026-04-23', today, morning)).toContain('מחר')
  })

  it('caps at 3 items + remainder', () => {
    const appts = Array.from({ length: 5 }, (_, i) => makeAppt(`דבר ${i}`, today, `${9 + i}:00`))
    expect(narrateDay(appts, today, today, morning)).toContain('ועוד 2')
  })

  it('evening mode shows remaining', () => {
    const eveningNow = new Date('2026-04-22T20:00:00')
    const appts = [makeAppt('דבר בערב', today, '21:00')]
    const result = narrateDay(appts, today, today, eveningNow)
    expect(result).toContain('הערב')
  })

  it('evening with all past says ערב שקט', () => {
    const eveningNow = new Date('2026-04-22T22:00:00')
    const appts = [makeAppt('דבר שעבר', today, '09:00')]
    const result = narrateDay(appts, today, today, eveningNow)
    expect(result).toContain('ערב שקט')
  })
})

describe('narrateRange', () => {
  const today = '2026-04-22'
  const morning = new Date('2026-04-22T08:00:00')

  it('empty range', () => {
    expect(narrateRange([], today, 7, morning)).toContain('אין לך כלום')
  })

  it('multi-day includes both', () => {
    const appts = [
      makeAppt('רופא', '2026-04-22', '10:00'),
      makeAppt('תספורת', '2026-04-24', '14:00'),
    ]
    const result = narrateRange(appts, today, 7, morning)
    expect(result).toContain('רופא')
    expect(result).toContain('תספורת')
  })
})

describe('getPreEventHint', () => {
  it('returns hint for medical event within 2 hours', () => {
    const appt = makeAppt('רופא', '2026-04-22', '12:00')
    const now = new Date('2026-04-22T10:30:00')
    const hint = getPreEventHint(appt, now)
    expect(hint).toContain('להתכונן')
  })

  it('returns null for event more than 3 hours away', () => {
    const appt = makeAppt('רופא', '2026-04-22', '18:00')
    const now = new Date('2026-04-22T10:00:00')
    expect(getPreEventHint(appt, now)).toBeNull()
  })

  it('returns null for optional event', () => {
    const appt = makeAppt('קניות', '2026-04-22', '12:00')
    const now = new Date('2026-04-22T10:30:00')
    expect(getPreEventHint(appt, now)).toBeNull()
  })

  it('returns hint for social event within 2 hours', () => {
    const appt = makeAppt('פגישה עם חברה', '2026-04-22', '12:00')
    const now = new Date('2026-04-22T10:30:00')
    const hint = getPreEventHint(appt, now)
    expect(hint).toContain('מתקרב')
  })
})

describe('getSuggestion — preparation intelligence', () => {
  it('generic medical → ask doctor + has action button', () => {
    const s = getSuggestion(makeAppt('רופא', '2026-04-22', '10:00'))
    expect(s).not.toBeNull()
    expect(s!.text).toContain('לשאול')
    expect(s!.action).toBe('prepare_list')
    expect(s!.actionLabel).toBeTruthy()
  })

  it('blood test → bring ID', () => {
    const s = getSuggestion(makeAppt('בדיקת דם', '2026-04-22', '08:00'))
    expect(s!.text).toContain('תעודת זהות')
  })

  it('dentist → list of pain', () => {
    expect(getSuggestion(makeAppt('רופא שיניים', '2026-04-22', '10:00'))!.text).toContain('כואב')
  })

  it('birthday → greeting (no action button)', () => {
    const s = getSuggestion(makeAppt('יום הולדת של מור', '2026-04-22', '18:00'))
    expect(s!.text).toContain('ברכה')
    expect(s!.actionLabel).toBeNull()
  })

  it('visit → notify with contact name', () => {
    const s = getSuggestion(makeAppt('ביקור אצל אופיר', '2026-04-22', '16:00'))
    expect(s!.action).toBe('notify_contact')
    expect(s!.actionLabel).toBeTruthy()
  })

  it('dinner → buy something', () => {
    expect(getSuggestion(makeAppt('ארוחת ערב עם משפחה', '2026-04-22', '19:00'))!.text).toContain('לקנות')
  })

  it('lawyer → documents', () => {
    expect(getSuggestion(makeAppt('עורך דין', '2026-04-22', '10:00'))!.text).toContain('מסמכים')
  })

  it('bank → ID (no action needed)', () => {
    const s = getSuggestion(makeAppt('בנק', '2026-04-22', '10:00'))
    expect(s!.text).toContain('תעודת זהות')
    expect(s!.actionLabel).toBeNull()
  })

  it('insurance → papers', () => {
    expect(getSuggestion(makeAppt('ביטוח', '2026-04-22', '10:00'))!.text).toContain('ניירות')
  })

  it('optional → null', () => {
    expect(getSuggestion(makeAppt('קניות', '2026-04-22', '10:00'))).toBeNull()
  })

  it('generic social with no keyword → null', () => {
    expect(getSuggestion(makeAppt('פגישה', '2026-04-22', '14:00'))).toBeNull()
  })
})

describe('getPostEventFollowUp', () => {
  it('medical event 1 hour ago → ask what doctor said + log action', () => {
    const appt = makeAppt('רופא', '2026-04-22', '09:00')
    const now = new Date('2026-04-22T10:00:00')
    const f = getPostEventFollowUp(appt, now)
    expect(f).not.toBeNull()
    expect(f!.text).toContain('רופא')
    expect(f!.action).toBe('log_outcome')
    expect(f!.actionLabel).toBeTruthy()
  })

  it('administrative event 2 hours ago → follow-up action', () => {
    const appt = makeAppt('עורך דין', '2026-04-22', '10:00')
    const now = new Date('2026-04-22T12:00:00')
    const f = getPostEventFollowUp(appt, now)
    expect(f!.action).toBe('set_reminder')
  })

  it('event more than 4 hours ago → null', () => {
    const appt = makeAppt('רופא', '2026-04-22', '08:00')
    const now = new Date('2026-04-22T14:00:00')
    expect(getPostEventFollowUp(appt, now)).toBeNull()
  })

  it('future event → null', () => {
    const appt = makeAppt('רופא', '2026-04-22', '16:00')
    const now = new Date('2026-04-22T10:00:00')
    expect(getPostEventFollowUp(appt, now)).toBeNull()
  })

  it('optional event → null', () => {
    const appt = makeAppt('קניות', '2026-04-22', '09:00')
    const now = new Date('2026-04-22T10:00:00')
    expect(getPostEventFollowUp(appt, now)).toBeNull()
  })
})

describe('shouldSpeak', () => {
  const today = '2026-04-22'

  it('true for critical today', () => {
    expect(shouldSpeak([makeAppt('רופא', today, '10:00')], today, today)).toBe(true)
  })

  it('false for empty today', () => {
    expect(shouldSpeak([], today, today)).toBe(false)
  })

  it('false for only optional today', () => {
    expect(shouldSpeak([makeAppt('קניות', today, '10:00')], today, today)).toBe(false)
  })

  it('true for non-today (always narrate future)', () => {
    expect(shouldSpeak([], '2026-04-23', today)).toBe(true)
  })
})
