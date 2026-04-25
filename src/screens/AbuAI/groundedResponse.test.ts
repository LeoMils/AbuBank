import { describe, it, expect } from 'vitest'
import { answerFromToolResult } from './groundedResponse'

describe('answerFromToolResult', () => {
  it('tool error returns safe message', () => {
    expect(answerFromToolResult('calendar_today', { ok: false })).toBe('אני לא מצליחה לבדוק כרגע.')
  })

  it('empty today returns "אין לך כלום היום"', () => {
    expect(answerFromToolResult('calendar_today', { ok: true, events: [], summary: '' })).toBe('אין לך כלום היום.')
  })

  it('empty tomorrow returns "אין לך כלום מחר"', () => {
    expect(answerFromToolResult('calendar_tomorrow', { ok: true, events: [], summary: '' })).toBe('אין לך כלום מחר.')
  })

  it('empty upcoming returns "אין אירועים קרובים"', () => {
    expect(answerFromToolResult('calendar_upcoming', { ok: true, events: [], summary: '' })).toBe('אין אירועים קרובים.')
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
    expect(answerFromToolResult('family_lookup', { ok: true, found: false, members: [], answer: '' })).toBe('לא מצאתי.')
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
