import { describe, it, expect } from 'vitest'
import { checkSpendAllowed, emptyUsage, SPEND_LIMITS } from './aiSpendGuard'

describe('Spend limits', () => {
  it('exposes the three caps', () => {
    expect(SPEND_LIMITS.maxOnlineSearchesPerDay).toBe(30)
    expect(SPEND_LIMITS.maxVoiceMinutesPerDay).toBe(20)
    expect(SPEND_LIMITS.maxEstimatedSpendPerDayUSD).toBe(3)
  })
})

describe('checkSpendAllowed — allowed paths', () => {
  it('fresh usage allows everything', () => {
    const r = checkSpendAllowed({ operation: 'online_search', usage: emptyUsage() })
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('allowed')
  })
  it('chat is allowed when within daily spend', () => {
    const r = checkSpendAllowed({ operation: 'chat', usage: emptyUsage() })
    expect(r.allowed).toBe(true)
  })
})

describe('checkSpendAllowed — blocked paths', () => {
  it('blocks online_search after cap', () => {
    const r = checkSpendAllowed({
      operation: 'online_search',
      usage: { onlineSearchesToday: 30, voiceMinutesToday: 0, estimatedSpendUsdToday: 0 },
    })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('online_searches_limit')
    // User copy is generic and warm — no USD, no internal cost detail.
    expect(/\$/.test(r.safeUserMessage)).toBe(false)
  })
  it('blocks voice after minutes cap', () => {
    const r = checkSpendAllowed({
      operation: 'voice',
      usage: { onlineSearchesToday: 0, voiceMinutesToday: 20, estimatedSpendUsdToday: 0 },
      lang: 'es',
    })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('voice_minutes_limit')
  })
  it('blocks anything once daily spend cap is reached', () => {
    const r = checkSpendAllowed({
      operation: 'chat',
      usage: { onlineSearchesToday: 0, voiceMinutesToday: 0, estimatedSpendUsdToday: 3 },
      lang: 'en',
    })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('daily_spend_limit')
  })
})

describe('checkSpendAllowed — safety + privacy', () => {
  it('never exposes USD or internal cost in safeUserMessage', () => {
    for (const lang of ['he', 'es', 'en', 'mixed'] as const) {
      const r = checkSpendAllowed({
        operation: 'online_search',
        usage: { onlineSearchesToday: 30, voiceMinutesToday: 0, estimatedSpendUsdToday: 0 },
        lang,
      })
      expect(/USD|\$|dolar|דולר/i.test(r.safeUserMessage)).toBe(false)
    }
  })
  it('invalid usage input is blocked safely', () => {
    const r = checkSpendAllowed({ operation: 'online_search', usage: {} as never })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('invalid_usage_input')
  })
})
