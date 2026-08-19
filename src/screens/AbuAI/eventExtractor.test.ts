import { describe, it, expect } from 'vitest'
import { extractEventDetails } from './eventExtractor'

describe('extractEventDetails — WHO / WHERE / SUBJECT / notes', () => {
  it('the production example: meeting Alexandra at Cafe Greg about the Italy trip', () => {
    const r = extractEventDetails('מחר בשבע בערב פגישה עם אלכסנדרה בקפה גרג רעננה על הטיול לאיטליה')
    expect(r.person).toBe('אלכסנדרה')
    expect(r.location).toBe('קפה גרג רעננה')
    expect(r.subject).toBe('טיול לאיטליה')
    // residual feeds the title extractor → keeps "פגישה עם אלכסנדרה", drops venue+subject
    expect(r.residualText).toContain('עם אלכסנדרה')
    expect(r.residualText).not.toContain('קפה')
    expect(r.residualText).not.toContain('איטליה')
  })

  it('captures the entity even after a long story preamble (WHO/WHERE priority)', () => {
    const r = extractEventDetails(
      'אז דיברתי עם השכנה והיא סיפרה לי על הבן שלה שחזר מחו"ל וחשבתי שיהיה נחמד, אז פגישה עם רותי במסעדה איטלקית על יום ההולדת',
    )
    expect(r.person).toBe('רותי')
    expect(r.location).toBe('מסעדה איטלקית')
    expect(r.subject).toBe('יום ההולדת')
  })

  it('person stops at the venue (does not swallow "בקפה")', () => {
    const r = extractEventDetails('פגישה עם מור בקפה')
    expect(r.person).toBe('מור')
    expect(r.location).toBe('קפה')
  })

  it('bare city is a location', () => {
    const r = extractEventDetails('ארוחה עם יעל ברעננה')
    expect(r.person).toBe('יעל')
    expect(r.location).toBe('רעננה')
  })

  it('office / clinic venues', () => {
    expect(extractEventDetails('פגישה עם דנה במשרד').location).toBe('משרד')
    expect(extractEventDetails('תור עם רופא במרפאה מחר').location).toBe('מרפאה')
  })

  it('extracts a reason clause as notes', () => {
    const r = extractEventDetails('פגישה עם רותי כי היא רוצה לדבר על הילדים')
    expect(r.person).toBe('רותי')
    expect(r.notes).toBe('היא רוצה לדבר על הילדים')
  })

  it('returns null for fields that are not present (never guesses)', () => {
    const r = extractEventDetails('תקבעי לי תור לרופא מחר בארבע')
    expect(r.person).toBeNull()
    expect(r.location).toBeNull()
    expect(r.subject).toBeNull()
    expect(r.notes).toBeNull()
  })

  it('does not mistake "על יד" (near) for a subject', () => {
    const r = extractEventDetails('פגישה עם מור על יד הבית')
    expect(r.subject).toBeNull()
  })

  it('does not treat time/date words as a location', () => {
    const r = extractEventDetails('פגישה עם מור מחר בערב בשעה שבע')
    expect(r.location).toBeNull()
    expect(r.person).toBe('מור')
  })
})
