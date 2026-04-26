import { describe, it, expect } from 'vitest'
import { answerFromToolResult } from './groundedResponse'

describe('answerFromToolResult', () => {
  it('tool error returns safe message', () => {
    expect(answerFromToolResult('calendar_today', { ok: false })).toBe('אני לא מצליחה לבדוק את זה כרגע. נסי שוב.')
  })

  it('empty calendar passes through shaped summary', () => {
    const shaped = 'לא מצאתי משהו ביומן להיום.'
    expect(answerFromToolResult('calendar_today', { ok: true, events: [], summary: shaped })).toBe(shaped)
  })

  it('empty tomorrow passes through shaped summary', () => {
    const shaped = 'לא מצאתי משהו ביומן למחר.'
    expect(answerFromToolResult('calendar_tomorrow', { ok: true, events: [], summary: shaped })).toBe(shaped)
  })

  it('empty upcoming passes through shaped summary', () => {
    const shaped = 'לא מצאתי משהו ביומן קרוב.'
    expect(answerFromToolResult('calendar_upcoming', { ok: true, events: [], summary: shaped })).toBe(shaped)
  })

  it('calendar with events returns summary', () => {
    const result = answerFromToolResult('calendar_today', {
      ok: true,
      events: [{ id: '1', title: 'רופא', date: '2026-04-25', time: '10:00', emoji: '🏥', color: '#C9A84C' }],
      summary: 'היום:\n🏥 רופא ב-10:00',
    })
    expect(result).toContain('רופא')
    expect(result).toContain('10:00')
  })

  it('family not found returns "לא מצאתי"', () => {
    expect(answerFromToolResult('family_lookup', { ok: true, found: false, members: [], answer: '' })).toBe('לא מצאתי מידע על זה.')
  })

  it('family found returns answer from data', () => {
    const result = answerFromToolResult('family_lookup', {
      ok: true,
      found: true,
      members: [{ canonicalName: 'Mor', hebrew: 'מור', aliases: [], relationship: 'daughter', relationshipHebrew: 'הבת' }],
      answer: 'מור — הבת.',
    })
    expect(result).toBe('מור — הבת.')
  })
})
