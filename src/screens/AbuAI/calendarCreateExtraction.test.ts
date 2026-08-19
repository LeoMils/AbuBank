import { describe, it, expect } from 'vitest'
import { parseCreateIntent } from './calendarCreate'
import { shapeCreateConfirm } from './responseShaper'

describe('parseCreateIntent — rich extraction (person/location/subject) wired in', () => {
  it('captures all fields and keeps the title clean (production example)', () => {
    const r = parseCreateIntent('תקבעי לי פגישה עם אלכסנדרה מחר בשבע בערב בקפה גרג רעננה על הטיול לאיטליה')
    expect(r).not.toBeNull()
    const d = r!.draft
    expect(d.person).toBe('אלכסנדרה')
    expect(d.location).toBe('קפה גרג רעננה')
    expect(d.subject).toBe('טיול לאיטליה')
    expect(d.time).toBe('19:00')
    expect(d.date).toBeTruthy() // "מחר" resolved to a real YYYY-MM-DD
    expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Title must NOT swallow the venue or the subject.
    expect(d.title).toContain('אלכסנדרה')
    expect(d.title).not.toContain('קפה')
    expect(d.title).not.toContain('איטליה')
  })

  it('confirmation reads back location and subject', () => {
    const r = parseCreateIntent('תקבעי לי פגישה עם אלכסנדרה מחר בשבע בערב בקפה גרג רעננה על הטיול לאיטליה')
    const confirm = shapeCreateConfirm(r!.draft)
    expect(confirm).toContain('קפה גרג רעננה')
    expect(confirm).toContain('טיול לאיטליה')
    expect(confirm).toContain('נכון?')
  })

  it('still works for a simple appointment with no location/subject', () => {
    const r = parseCreateIntent('תקבעי לי תור לרופא מחר בארבע')
    expect(r).not.toBeNull()
    const d = r!.draft
    expect(d.location).toBeNull()
    expect(d.subject).toBeNull()
    expect(d.title).toContain('רופא')
    expect(d.time).toBe('16:00')
  })
})
