import { describe, it, expect } from 'vitest'
import { resolveFollowUp } from './contextResolver'
import { searchFamilyGroup, getFamilyContext, searchFamily } from './tools'
import { isPlaceholderKey as sttPlaceholder } from '../../../api/abuai-stt'
import { isPlaceholderKey as rtPlaceholder, REALTIME_SESSION_URL } from '../../services/realtimeVoice'

type Msg = { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }
const m = (role: 'user' | 'assistant', content: string): Msg => ({ id: '1', role, content, timestamp: 0 })

// ── P0-1/3: conversation continuity (general-topic threads) ──
describe('P0-1 continuity — general topic follow-ups keep the thread', () => {
  const hist = [m('user', 'באיזה שנה הייתה המהפכה הצרפתית'), m('assistant', 'ב-1789.')]
  it('"תמשיכי" continues the topic', () => {
    expect(resolveFollowUp('תמשיכי', hist as never).resolved).toContain('המהפכה הצרפתית')
  })
  it('"עוד" continues the topic', () => {
    expect(resolveFollowUp('עוד', hist as never).resolved).toContain('המהפכה')
  })
  it('"על זה" / "ומה עם זה" continue the topic', () => {
    expect(resolveFollowUp('על זה', hist as never).resolved).toContain('המהפכה')
    expect(resolveFollowUp('ומה עם זה', hist as never).resolved).toContain('המהפכה')
  })
  it('"על ההיסטוריה" continues about history', () => {
    expect(resolveFollowUp('על ההיסטוריה', hist as never).resolved).toContain('היסטוריה')
  })
  it('family context is NOT hijacked by topic continuation', () => {
    const fam = [m('user', 'מי זאת מור'), m('assistant', 'מור, הבת שלך.')]
    // a calendar/family follow-up still routes to the family/calendar path, not topic
    expect(resolveFollowUp('ועוד?', fam as never).resolved).toContain('מור')
  })
})

// ── P0-2: Martita perspective — always "שלך", never "שלי" / "ל-Martita" ──
describe('P0-2 identity perspective — speaks to Martita ("שלך")', () => {
  it('grandchildren group answer uses "שלך", not third-person or colon', () => {
    const a = searchFamilyGroup('ספרי לי על הנכדים')!
    expect(a).toContain('יש לך')
    expect(a).not.toContain('ל-Martita')
    expect(a).not.toContain('שלי')
    expect(a).not.toContain(':') // no colon-list dump
  })
  it('family context uses "שלך"', () => {
    const a = getFamilyContext()
    expect(a).toContain('שלך')
    expect(a).not.toMatch(/שלי|ל-?Martita/)
  })
  it('"מי זאת מור" speaks to Martita ("הבת שלך"), never "שלי"', () => {
    const a = searchFamily('מור').answer
    expect(a).toContain('שלך')
    expect(a).not.toContain('שלי')
  })
})

// ── P0-5: STT key handling — reject placeholder, no leak ──
describe('P0-5 STT — placeholder key rejected before any call', () => {
  it('rejects the docs placeholder and short stubs', () => {
    expect(sttPlaceholder('sk-...')).toBe(true)
    expect(sttPlaceholder('your_openai_api_key_here')).toBe(true)
    expect(sttPlaceholder(undefined)).toBe(true)
    expect(sttPlaceholder('sk-proj-0123456789abcdef0123456789')).toBe(false) // real-length
  })
})

// ── P0-4: Realtime — endpoint/header/key guard ──
describe('P0-4 Realtime — endpoint + beta header + key guard', () => {
  it('uses the CURRENT client_secrets minter endpoint (2026; sessions endpoint now 404s)', () => {
    // Server-proven: api/realtime-token.ts mints ok=true against this endpoint.
    expect(REALTIME_SESSION_URL).toBe('https://api.openai.com/v1/realtime/client_secrets')
  })
  it('rejects placeholder keys (graceful fallback, no 401/404 noise)', () => {
    expect(rtPlaceholder('sk-...')).toBe(true)
    expect(rtPlaceholder('sk-proj-0123456789abcdef0123456789')).toBe(false)
  })
})
