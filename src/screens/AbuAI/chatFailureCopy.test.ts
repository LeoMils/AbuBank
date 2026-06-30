/**
 * CHAT FAILURE COPY — the terminal "all providers failed" message must reach the
 * user in HER language and tell her if it's an offline problem. Previously a
 * hardcoded Hebrew string (a dead-end for a Spanish-speaking or offline user).
 * HIGH evidence: invokes the real helper, not a source grep.
 */
import { describe, it, expect } from 'vitest'
import { chatTerminalFallback } from './service'
import type { ChatMessage } from './types'

const msg = (content: string): ChatMessage[] => [{ id: '1', role: 'user', content, timestamp: 0 }]

describe('chatTerminalFallback — localized', () => {
  it('Spanish last message → Rioplatense Spanish (not Hebrew)', () => {
    const out = chatTerminalFallback(msg('no funciona, dale'), { offline: false })
    expect(out).toMatch(/Prob[áa] de nuevo|No puedo responder/)
    expect(out).not.toMatch(/[֐-׿]/) // contains NO Hebrew
  })
  it('English-detected message → English (best-effort; he/es are primary)', () => {
    const out = chatTerminalFallback(msg('what time is it'), { offline: false })
    expect(out).toMatch(/try again|couldn/i)
    expect(out).not.toMatch(/[֐-׿]/)
  })
  it('Hebrew last message → the existing Hebrew line (back-compat)', () => {
    expect(chatTerminalFallback(msg('זה לא עובד'), { offline: false })).toBe('לא הצלחתי עכשיו — תנסי שוב עוד רגע.')
  })
})

describe('chatTerminalFallback — offline-aware', () => {
  it('offline + Spanish → Spanish "no connection" copy', () => {
    const out = chatTerminalFallback(msg('hola, qué hora es'), { offline: true })
    expect(out).toMatch(/conexión|internet/i)
    expect(out).not.toMatch(/[֐-׿]/)
  })
  it('offline + Hebrew → Hebrew "no connection" copy (distinct from provider-down)', () => {
    const out = chatTerminalFallback(msg('מה השעה'), { offline: true })
    expect(out).toMatch(/חיבור|אינטרנט/)
    expect(out).not.toBe('לא הצלחתי עכשיו — תנסי שוב עוד רגע.') // offline ≠ provider-down
  })
  it('offline + English → English "no connection" copy', () => {
    expect(chatTerminalFallback(msg('what time is it'), { offline: true })).toMatch(/connection|internet/i)
  })
})

describe('chatTerminalFallback — robustness', () => {
  it('empty/no-user messages → safe Hebrew default', () => {
    expect(chatTerminalFallback([], { offline: false })).toBe('לא הצלחתי עכשיו — תנסי שוב עוד רגע.')
  })
  it('uses the LAST user message for language (mid-conversation switch)', () => {
    const conv: ChatMessage[] = [
      { id: '1', role: 'user', content: 'שלום', timestamp: 0 },
      { id: '2', role: 'assistant', content: 'היי', timestamp: 1 },
      { id: '3', role: 'user', content: 'che, no anda nada', timestamp: 2 },
    ]
    expect(chatTerminalFallback(conv, { offline: false })).not.toMatch(/[֐-׿]/)
  })
})
