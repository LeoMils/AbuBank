import { describe, it, expect } from 'vitest'
import { extractCalendarIntentLocally } from './semanticIntent'

const TODAY = '2026-05-20'

describe('semanticIntent extraction matrix', () => {
  it('1) direct command extraction', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'תקבעי פגישה עם אופיר בפתח תקווה מחר בעשר בבוקר', todayISO: TODAY })
    expect(r.intent).toBe('create_calendar_event')
    expect(r.confidence).toBe('high')
    expect(r.extractedTitle).toBe('פגישה עם אופיר')
    expect(r.extractedLocation).toBe('פתח תקווה')
    expect(r.extractedDate).toBe('2026-05-21')
    expect(r.extractedStartTime).toBe('10:00')
    expect(r.canAutoCreate).toBe(true)
  })

  it('2) long babysitting story extraction', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'אופיר התקשרה אליי כי גלעדי יצא למילואים ומחר היא הולכת לסרט והיא רוצה שאני אשמור על הילדים מחר בין שבע לעשר אצלה', todayISO: TODAY })
    expect(r.extractedTitle).toBe('לשמור על הילדים אצל אופיר')
    expect(r.extractedDate).toBe('2026-05-21')
    expect(r.extractedStartTime).toBe('19:00')
    expect(r.extractedEndTime).toBe('22:00')
    expect(r.extractedLocation).toBe('אצל אופיר')
    expect(r.extractedPeople).toContain('אופיר')
    expect(r.extractedNotes ?? '').toContain('גלעדי יצא למילואים')
    expect(r.extractedNotes ?? '').toContain('הולכת לסרט')
    expect(r.canAutoCreate).toBe(r.confidence === 'high')
  })

  it('3) short babysitting story extraction', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'אני צריך לשמור על הילדים אצל אופיר מחר בין שבע לעשר', todayISO: TODAY })
    expect(r.intent).toBe('create_calendar_event')
    expect(r.extractedStartTime).toBe('19:00')
    expect(r.extractedEndTime).toBe('22:00')
    expect(r.canAutoCreate).toBe(true)
  })

  it('4) doctor extraction', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'יש לי תור לרופא בכפר סבא מחר בארבע אחר הצהריים', todayISO: TODAY })
    expect(r.extractedTitle).toBe('תור לרופא')
    expect(r.extractedLocation).toBe('כפר סבא')
    expect(r.extractedDate).toBe('2026-05-21')
    expect(r.extractedStartTime).toBe('16:00')
  })

  it('5) pickup extraction with next Sunday', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'לקחת את הילדים מאופיר ביום ראשון בשש בערב', todayISO: TODAY })
    expect(r.extractedTitle).toBe('לקחת את הילדים מאופיר')
    expect(r.extractedPeople).toContain('אופיר')
    expect(r.extractedDate).toBe('2026-05-24')
    expect(r.extractedStartTime).toBe('18:00')
  })

  it('6) missing time', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'פגישה עם אופיר מחר', todayISO: TODAY })
    expect(r.missingFields).toContain('time')
    expect(r.clarificationQuestion).toBe('באיזו שעה לקבוע את זה?')
    expect(r.canAutoCreate).toBe(false)
  })

  it('7) missing date/time', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'לשמור על הילדים אצל אופיר', todayISO: TODAY })
    expect(r.missingFields).toEqual(expect.arrayContaining(['date', 'time']))
    expect(r.canAutoCreate).toBe(false)
  })

  it('8) missing title/time', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'מחר אצל אופיר', todayISO: TODAY })
    expect(r.missingFields).toEqual(expect.arrayContaining(['title', 'time']))
    expect(r.canAutoCreate).toBe(false)
  })

  it('9) between seven and ten only', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'בין שבע לעשר', todayISO: TODAY })
    expect(r.canAutoCreate).toBe(false)
    expect(r.missingFields).toEqual(expect.arrayContaining(['title', 'date']))
  })

  it('10-13) no false positives', () => {
    for (const text of ['אופיר סיפרה לי על סרט יפה', 'גלעד יצא למילואים', 'אופיר התקשרה אליי', 'מחר יש סרט יפה']) {
      const r = extractCalendarIntentLocally({ correctedTranscript: text, todayISO: TODAY })
      expect(['not_calendar', 'unclear']).toContain(r.intent)
      expect(r.canAutoCreate).toBe(false)
    }
  })

  it('low ASR confidence never auto creates', () => {
    const r = extractCalendarIntentLocally({ correctedTranscript: 'תקבעי פגישה עם אופיר מחר בעשר בבוקר', todayISO: TODAY, asr: { avgLogprob: -1.9, noSpeechProb: 0.9 } })
    expect(r.confidence).toBe('low')
    expect(r.validationResult).toBe('low_confidence')
    expect(r.canAutoCreate).toBe(false)
  })
})
