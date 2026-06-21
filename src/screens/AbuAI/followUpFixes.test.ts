import { describe, it, expect } from 'vitest'
import { resolveFollowUp } from './contextResolver'

type Msg = { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }
const m = (role: 'user' | 'assistant', content: string): Msg => ({ id: '1', role, content, timestamp: 0 })

describe('follow-up fixes', () => {
  it('FIX 1: "תמשיכי" after "על ההיסטוריה" resolves cleanly (no "על על")', () => {
    const h = [
      m('user', 'באיזה שנה הייתה המהפכה הצרפתית'), m('assistant', 'ב-1789.'),
      m('user', 'על ההיסטוריה'), m('assistant', '…'),
    ]
    const r = resolveFollowUp('תמשיכי', h as never).resolved
    expect(r).toBe('ספרי לי עוד על ההיסטוריה')
    expect(r).not.toContain('על על')
  })

  it('FIX 1b: "עוד" likewise has no double "על"', () => {
    const h = [m('user', 'על ההיסטוריה'), m('assistant', '…')]
    expect(resolveFollowUp('עוד', h as never).resolved).not.toContain('על על')
  })

  it('FIX 2: "ומה ביום הבא" after a week query → tomorrow', () => {
    const h = [m('user', 'מה יש לי השבוע'), m('assistant', 'יום שלישי 🏥 רופא…')]
    const r = resolveFollowUp('ומה ביום הבא', h as never)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי מחר?')
  })
})
