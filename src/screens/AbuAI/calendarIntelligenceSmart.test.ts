/*
 * Smart Calendar Intelligence — the mission's flagship Ofir utterance is the
 * primary regression, plus general cases proving the extraction is cue-driven,
 * not patched to one sentence.
 */
import { describe, it, expect } from 'vitest'
import {
  understandMeetingSmart, extractDuration, extractImportantDetails, resolveContextualLocation,
} from './calendarIntelligence'

const OFIR = 'ביום שלישי אופיר אמרה לי שהיא תחזור קצת יותר מאוחר כי היא צריכה לסיים את העבודה, אז אם אני יכול להגיע אליה בשעה שבע ולא שבע וחצי, כי גלעד לא יוכל להגיע, והיא רוצה שאני אהיה אצלה שעתיים.'

describe('Ofir utterance — full semantic extraction', () => {
  const m = understandMeetingSmart(OFIR)
  it('who = אופיר (subject person, no עם/אצל cue)', () => expect(m.who).toBe('אופיר'))
  it('when = a real date', () => expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/))
  it('time inferred to evening 19:00 (late/return cue)', () => {
    expect(m.time).toBe('19:00')
    expect(m.inferredEvening).toBe(true)
  })
  it('where = אצל אופיר (pronoun venue resolved)', () => expect(m.location).toContain('אופיר'))
  it('duration = שעתיים', () => {
    expect(m.durationLabel).toBe('שעתיים')
    expect(m.durationMinutes).toBe(120)
  })
  it('important details capture the 3 real cues', () => {
    const joined = m.importantDetails.join(' | ')
    expect(joined).toMatch(/גלעד/)      // Gilad can't come
    expect(joined).toMatch(/מאוחר/)     // Ofir returns late
    expect(joined).toMatch(/שבע/)       // come at 7 not 7:30
  })
})

describe('extractDuration — general, not clock-time', () => {
  it('שעתיים → 120', () => expect(extractDuration('נהיה שם שעתיים').minutes).toBe(120))
  it('חצי שעה → 30', () => expect(extractDuration('רק חצי שעה').label).toBe('חצי שעה'))
  it('שלוש שעות → 180', () => expect(extractDuration('שלוש שעות').minutes).toBe(180))
  it('45 דקות → 45', () => expect(extractDuration('45 דקות').minutes).toBe(45))
  it('"בשעה שבע" is NOT a duration', () => expect(extractDuration('פגישה בשעה שבע').minutes).toBeNull())
})

describe('extractImportantDetails — general cues', () => {
  it('captures an absent person', () => {
    expect(extractImportantDetails('פגישה מחר, רפי לא יוכל להגיע').join(' ')).toMatch(/רפי/)
  })
  it('empty for a plain request', () => {
    expect(extractImportantDetails('תקבעי פגישה עם דני מחר בעשר')).toEqual([])
  })
})

describe('resolveContextualLocation', () => {
  it('אצלה + known person → אצל <person>', () => {
    expect(resolveContextualLocation('אני אהיה אצלה', 'אופיר')).toBe('אצל אופיר')
  })
  it('no venue pronoun → null', () => {
    expect(resolveContextualLocation('פגישה עם דני', 'דני')).toBeNull()
  })
})
