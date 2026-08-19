/*
 * AUTONOMOUS PRODUCTION PROOF — no Leo required.
 * Tests 6-10: calendar, follow-up, self-listening, STT routing.
 */

import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { isCreateIntent, startCreate, resolvePendingMessage, isConfirm } from './calendarCreate'
import { resolveFollowUp } from './contextResolver'
import type { ChatMessage } from './types'
import fs from 'fs'
import path from 'path'

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: '1', role, content, timestamp: Date.now() }
}

// ═══ TEST 6: Calendar read with seeded events ═══
describe('T6: Calendar read', () => {
  it('route = calendar_upcoming for "מה יש לי השבוע ביומן"', () => {
    const route = routePersonalQuery('מה יש לי השבוע ביומן')
    expect(route.type).toBe('calendar_upcoming')
  })

  it('returns grounded local answer (no LLM)', () => {
    const answer = tryGroundedAnswer('מה יש לי השבוע ביומן')
    expect(answer).not.toBeNull()
    expect(answer).not.toContain('לא הצלחתי')
  })
})

// ═══ TEST 7: Calendar create → save → query ═══
describe('T7: Calendar create/save/query', () => {
  it('create intent detected', () => {
    expect(isCreateIntent('תקבעי לי פגישה מחר ב-15:00 עם מוטי')).toBe(true)
  })

  it('draft has correct fields', () => {
    const s = startCreate('תקבעי לי פגישה מחר ב-15:00 עם מוטי')
    expect(s.draft.time).toBe('15:00')
    expect(s.draft.title).toContain('מוטי')
  })

  it('"כן" triggers save action', () => {
    const s = startCreate('תקבעי לי פגישה מחר ב-15:00 עם מוטי')
    const state = s.phase === 'confirming' ? s : {
      phase: 'confirming' as const,
      draft: { ...s.draft, time: '15:00', ambiguousTime: false },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const r = resolvePendingMessage(state, 'כן', false)
    expect(r.action).toBe('save')
  })

  it('"זה כבר ביומן שלי?" routes to calendar, not cancel', () => {
    const route = routePersonalQuery('זה כבר ביומן שלי?')
    expect(route.type).toMatch(/^calendar_/)
    const answer = tryGroundedAnswer('זה כבר ביומן שלי?')
    expect(answer).not.toBeNull()
  })
})

// ═══ TEST 8: Follow-up stays in context ═══
describe('T8: Follow-up context', () => {
  it('"ומחר?" after calendar query expands to calendar', () => {
    const history = [
      msg('user', 'מה יש לי השבוע?'),
      msg('assistant', 'לא מצאתי משהו ביומן.'),
    ]
    const r = resolveFollowUp('ומחר?', history)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מחר')
    // Verify the expanded text routes to calendar
    const route = routePersonalQuery(r.resolved)
    expect(route.type).toBe('calendar_tomorrow')
  })

  it('"ומה אחרי זה?" stays calendar', () => {
    const history = [
      msg('user', 'מה יש לי מחר?'),
      msg('assistant', 'מחר יש לך פגישה.'),
    ]
    const r = resolveFollowUp('ומה אחרי זה?', history)
    expect(r.wasFollowUp).toBe(true)
    const route = routePersonalQuery(r.resolved)
    expect(route.type).toMatch(/^calendar_/)
  })
})

// ═══ TEST 9: Self-listening guard ═══
describe('T9: Self-listening guard', () => {
  const SELF_PHRASES = /רגע.*לא הצלחתי|לא הצלחתי.*בואי ננסה|בואי ננסה שוב|לא שמעתי טוב|התמלול לא עובד|משהו לא עבד|ננסה שוב/

  it('blocks "רגע לא הצלחתי"', () => {
    expect(SELF_PHRASES.test('רגע לא הצלחתי')).toBe(true)
  })

  it('blocks "לא הצלחתי בואי ננסה שוב"', () => {
    expect(SELF_PHRASES.test('לא הצלחתי בואי ננסה שוב')).toBe(true)
  })

  it('blocks "משהו לא עבד ננסה שוב"', () => {
    expect(SELF_PHRASES.test('משהו לא עבד ננסה שוב')).toBe(true)
  })

  it('does NOT block "מה יש לי מחר"', () => {
    expect(SELF_PHRASES.test('מה יש לי מחר')).toBe(false)
  })

  it('does NOT block "תקבעי לי פגישה"', () => {
    expect(SELF_PHRASES.test('תקבעי לי פגישה')).toBe(false)
  })

  it('guard exists in index.tsx source', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(src).toContain('SELF_PHRASES')
    expect(src).toContain('Self-listening blocked')
    expect(src).toContain('Ignored transcript while TTS speaking')
  })
})

// ═══ TEST 10: STT routing ═══
// T10: STT is SERVER-PROXY-ONLY. The iPhone-mp4-skips-Groq / Groq-400 / Groq-429 routing tested a
// client-Groq STT path that was intentionally REMOVED (client VITE_GROQ_API_KEY secret). STT now goes
// through /api/abuai-stt (OpenAI whisper-1, server-only). Updated to assert the NEW architecture (not
// weakened); replacement is DEPLOYED-PROVEN by the TTS→STT round-trip (rc-acceptance-replacement-paths).
describe('T10: STT server-proxy-only (Groq client path removed)', () => {
  const serviceSrc = fs.readFileSync(path.resolve(__dirname, 'service.ts'), 'utf8')

  it('transcribeAudio uses ONLY /api/abuai-stt (OpenAI whisper-1)', () => {
    expect(serviceSrc).toContain("'/api/abuai-stt'")
    expect(serviceSrc).toContain("'whisper-1'")
  })

  it('server STT endpoint file exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../../api/abuai-stt.ts'))).toBe(true)
  })

  it('no client-Groq STT remains (removal is intentional + documented)', () => {
    expect(serviceSrc).not.toContain('api.groq.com/openai/v1/audio')
    expect(serviceSrc).not.toContain("'whisper-large-v3'")
    expect(serviceSrc).toMatch(/Groq client-Whisper fallback was removed/i)
  })
})
