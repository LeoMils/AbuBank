import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { shapeFamilyAnswer, shapeLocationAnswer, shapeCalendarAnswer, shapeNotFound, shapeToolError, shapeCreateConfirm } from './responseShaper'
import type { FamilyMember } from '../../services/familyLoader'

const makeMember = (overrides: Partial<FamilyMember> = {}): FamilyMember => ({
  canonicalName: 'Mor', hebrew: 'מור', aliases: ['מור'],
  relationship: 'daughter', relationshipHebrew: 'הבת, גרושה מרפי, בת זוג של יעל',
  ...overrides,
})

describe('shapeFamilyAnswer', () => {
  it('Mor: base role + details in separate sentences', () => {
    const answer = shapeFamilyAnswer(makeMember({
      children: ['אופיר', 'איילון', 'עילי', 'אדר'],
    }))
    expect(answer).toContain('מור היא הבת שלך.')
    expect(answer).toContain('היא גרושה מרפי, בת זוג של יעל.')
    expect(answer).toContain('הילדים שלה הם אופיר, איילון, עילי ואדר.')
    expect(answer).not.toContain('הבת, גרושה מרפי, בת זוג של יעל שלך')
  })

  it('grandson uses dash format', () => {
    const answer = shapeFamilyAnswer(makeMember({ relationshipHebrew: 'נכד (בן של מור ורפי)' }))
    expect(answer).toContain('מור —')
  })

  it('children list uses ו before last name', () => {
    const answer = shapeFamilyAnswer(makeMember({ children: ['א', 'ב', 'ג'] }))
    expect(answer).toContain('א, ב וג')
  })

  it('single child has no ו', () => {
    const answer = shapeFamilyAnswer(makeMember({ children: ['נועם'] }))
    expect(answer).toContain('הילדים שלה הם נועם')
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

describe('shapeCreateConfirm', () => {
  it('does not start with the formal "אני קובעת לך" phrasing', () => {
    const out = shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '10:00' })
    expect(out.startsWith('אני קובעת')).toBe(false)
  })

  it('renders header line + event line + לקבוע? question', () => {
    const out = shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '10:00' })
    const lines = out.split('\n')
    expect(lines[0]).toMatch(/—$/)
    expect(out).toContain('יש לך רופא.')
    expect(out.trim().endsWith('לקבוע?')).toBe(true)
  })

  it('uses Hebrew hour words for round hours', () => {
    expect(shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '10:00' })).toContain('בעשר')
    expect(shapeCreateConfirm({ title: 'אצל אופיר', date: '2026-05-06', time: '17:00' })).toContain('בחמש')
  })

  it('handles quarter / half / 45 minutes', () => {
    expect(shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '09:15' })).toContain('בתשע ורבע')
    expect(shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '16:30' })).toContain('בארבע וחצי')
    expect(shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '19:45' })).toContain('ברבע לשמונה')
  })

  it('uses "את" for אצל/עם titles, "יש לך" otherwise', () => {
    expect(shapeCreateConfirm({ title: 'אצל אופיר', date: '2026-05-06', time: '17:00' })).toContain('את אצל אופיר.')
    expect(shapeCreateConfirm({ title: 'עם דליה', date: '2026-05-06', time: '17:00' })).toContain('את עם דליה.')
    expect(shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '10:00' })).toContain('יש לך רופא.')
  })
})

describe('shapeCreateConfirm with location and notes', () => {
  it('includes location line and notes line in the right order', () => {
    const out = shapeCreateConfirm({
      title: 'תור אצל התופרת',
      date: '2026-05-01',
      time: '14:34',
      location: 'רחוב קוק 14, הרצליה',
      notes: 'חור במכנסיים',
    })
    expect(out).toContain('תור אצל התופרת')
    expect(out).toContain('ברחוב קוק 14, הרצליה.')
    expect(out).toContain('רשמתי גם: חור במכנסיים.')
    expect(out.trim().endsWith('לקבוע?')).toBe(true)
    const titleIdx = out.indexOf('תור אצל התופרת')
    const locIdx = out.indexOf('ברחוב קוק 14')
    const notesIdx = out.indexOf('רשמתי גם')
    expect(titleIdx).toBeLessThan(locIdx)
    expect(locIdx).toBeLessThan(notesIdx)
  })

  it('omits location and notes when not provided', () => {
    const out = shapeCreateConfirm({ title: 'רופא', date: '2026-05-01', time: '10:00' })
    expect(out).not.toContain('רשמתי גם')
    expect(out).not.toContain('ברחוב')
  })
})

describe('shapeCreateConfirm wiring', () => {
  it('is imported by the calendar screen', () => {
    const src = readFileSync(resolve(__dirname, '../AbuCalendar/index.tsx'), 'utf8')
    expect(src).toMatch(/import\s*\{\s*shapeCreateConfirm\s*\}\s*from\s*['"]\.\.\/AbuAI\/responseShaper['"]/)
    expect(src).toContain('shapeCreateConfirm({')
  })

  it('is rendered/spoken via VoiceCard confirmationText prop', () => {
    const calendarSrc = readFileSync(resolve(__dirname, '../AbuCalendar/index.tsx'), 'utf8')
    expect(calendarSrc).toMatch(/confirmationText=\{shapeCreateConfirm\(/)
    const voiceCardSrc = readFileSync(resolve(__dirname, '../AbuCalendar/VoiceCard.tsx'), 'utf8')
    expect(voiceCardSrc).toContain('confirmationText')
    expect(voiceCardSrc).toContain('speak(confirmationText)')
  })
})
