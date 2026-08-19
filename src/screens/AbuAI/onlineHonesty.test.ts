import { describe, it, expect } from 'vitest'
import { answerOnlineCurrentInfo } from './onlineProvider'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'

// A fabricated "current fact" must NEVER appear when the network fails.
const FABRICATED = /\b(2[0-9]|1[0-9])°|ניצח|won \d|today's headline|הכותרת היום/i

describe('online — intent detection', () => {
  it('detects current-info queries', () => {
    expect(isOnlineCurrentInfoQuery('מה מזג האוויר היום?')).toBe(true)
    expect(isOnlineCurrentInfoQuery('מה חדש בעולם?')).toBe(true)
    expect(isOnlineCurrentInfoQuery('איזה סרטים יש עכשיו?')).toBe(true)
  })
  it('does NOT treat family/calendar as online', () => {
    expect(isOnlineCurrentInfoQuery('מי זאת מור?')).toBe(false)
    expect(shouldBlockOnlineForPersonal('מי זאת מור?')).toBe(true)
    expect(shouldBlockOnlineForPersonal('מה יש לי מחר?')).toBe(true)
  })
})

describe('online — honest fallback, NO fake current facts', () => {
  it('network throw → ok:false, honest message, no fabricated fact', async () => {
    const r = await answerOnlineCurrentInfo('מה מזג האוויר מחר?', { fetchImpl: (async () => { throw new Error('offline') }) as never })
    expect(r.ok).toBe(false)
    expect(r.userMessage.length).toBeGreaterThan(0)
    expect(FABRICATED.test(r.userMessage)).toBe(false)
  })

  it('non-ok response → ok:false, honest, no fabrication', async () => {
    const r = await answerOnlineCurrentInfo('מי ניצח אתמול?', { fetchImpl: (async () => ({ ok: false, status: 500, json: async () => ({}) })) as never })
    expect(r.ok).toBe(false)
    expect(FABRICATED.test(r.userMessage)).toBe(false)
  })

  it('personal query is NEVER sent online (blocked before any fetch)', async () => {
    let called = false
    const r = await answerOnlineCurrentInfo('מי זאת מור?', { fetchImpl: (async () => { called = true; return { ok: true, json: async () => ({}) } }) as never })
    expect(called).toBe(false)              // no network call for family
    expect(r.ok).toBe(false)
  })

  it('no provider/network available → honest, not a fabricated answer', async () => {
    const r = await answerOnlineCurrentInfo('מה חדש בעולם?', { fetchImpl: null as never })
    expect(r.ok).toBe(false)
    expect(r.userMessage.length).toBeGreaterThan(0)
    expect(FABRICATED.test(r.userMessage)).toBe(false)
  })
})
