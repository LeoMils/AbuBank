import { describe, it, expect } from 'vitest'
import { shapeFamilyAnswer, shapeLocationAnswer, shapeCalendarAnswer, shapeNotFound, shapeToolError } from './responseShaper'
import type { FamilyMember } from '../../services/familyLoader'

const makeMember = (overrides: Partial<FamilyMember> = {}): FamilyMember => ({
  canonicalName: 'Mor', hebrew: 'מור', aliases: ['מור'],
  relationship: 'daughter', relationshipHebrew: 'הבת, גרושה מרפי, בת זוג של יעל',
  ...overrides,
})

describe('shapeFamilyAnswer', () => {
  it('daughter uses "היא X שלך"', () => {
    const answer = shapeFamilyAnswer(makeMember())
    expect(answer).toContain('מור היא')
    expect(answer).toContain('שלך')
    expect(answer).not.toContain('—')
  })

  it('grandson uses dash format', () => {
    const answer = shapeFamilyAnswer(makeMember({ relationshipHebrew: 'נכד (בן של מור ורפי)' }))
    expect(answer).toContain('מור —')
  })

  it('includes children count naturally', () => {
    const answer = shapeFamilyAnswer(makeMember({ children: ['א', 'ב', 'ג'] }))
    expect(answer).toContain('ילדים: א, ב, ג')
  })

  it('includes notes', () => {
    const answer = shapeFamilyAnswer(makeMember({ notes: 'גרה בהוד השרון.' }))
    expect(answer).toContain('גרה בהוד השרון')
  })

  it('never produces empty answer', () => {
    expect(shapeFamilyAnswer(makeMember()).length).toBeGreaterThan(5)
  })

  it('does not hallucinate — only uses provided fields', () => {
    const m = makeMember()
    delete (m as any).children
    delete (m as any).notes
    delete (m as any).spouse
    const answer = shapeFamilyAnswer(m)
    expect(answer).not.toContain('ילדים')
    expect(answer).not.toContain('בן/בת הזוג')
  })
})

describe('shapeLocationAnswer', () => {
  it('includes city name', () => {
    expect(shapeLocationAnswer('מור', 'הוד השרון')).toContain('הוד השרון')
  })

  it('includes notes when provided', () => {
    expect(shapeLocationAnswer('מור', 'הוד השרון', 'וילה עם יעל')).toContain('וילה עם יעל')
  })

  it('works without notes', () => {
    const answer = shapeLocationAnswer('עדי', 'תל אביב')
    expect(answer).toContain('תל אביב')
    expect(answer).not.toContain('undefined')
  })
})

describe('shapeCalendarAnswer', () => {
  it('empty today', () => {
    const answer = shapeCalendarAnswer([], 'today')
    expect(answer).toContain('לא מצאתי')
    expect(answer).toContain('להיום')
  })

  it('empty tomorrow', () => {
    expect(shapeCalendarAnswer([], 'tomorrow')).toContain('למחר')
  })

  it('single event', () => {
    const answer = shapeCalendarAnswer(
      [{ id: '1', title: 'רופא', date: '2026-04-26', time: '10:00', emoji: '🏥', color: '#C9A84C' }],
      'today'
    )
    expect(answer).toContain('רופא')
    expect(answer).toContain('10:00')
    expect(answer).toContain('היום')
  })

  it('multiple events', () => {
    const events = [
      { id: '1', title: 'רופא', date: '2026-04-26', time: '10:00', emoji: '🏥', color: '#C9A84C' },
      { id: '2', title: 'קניות', date: '2026-04-26', time: '14:00', emoji: '🛒', color: '#C9A84C' },
    ]
    const answer = shapeCalendarAnswer(events, 'today')
    expect(answer).toContain('2 דברים')
    expect(answer).toContain('רופא')
    expect(answer).toContain('קניות')
  })

  it('never returns empty string', () => {
    expect(shapeCalendarAnswer([], 'today').length).toBeGreaterThan(5)
    expect(shapeCalendarAnswer([], 'week').length).toBeGreaterThan(5)
  })
})

describe('shapeNotFound', () => {
  it('with context', () => {
    expect(shapeNotFound('דניאל')).toContain('דניאל')
  })

  it('without context', () => {
    expect(shapeNotFound()).toContain('לא מצאתי')
  })
})

describe('shapeToolError', () => {
  it('returns human message', () => {
    const msg = shapeToolError()
    expect(msg).toContain('לא מצליחה')
    expect(msg).toContain('נסי שוב')
  })
})
