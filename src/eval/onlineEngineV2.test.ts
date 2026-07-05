/*
 * Online Engine v2 — classify + retry + cache + honest failure, never hallucinate.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { classifyInformationNeed, runOnlineV2, onlineFailureMessage, clearOnlineCache } from '../screens/AbuAI/onlineEngineV2'

beforeEach(() => clearOnlineCache())

describe('Online Engine v2 — information-need classification', () => {
  it('live info', () => { expect(classifyInformationNeed('איזה משחקים יש היום')).toBe('live'); expect(classifyInformationNeed('מה הסרטים בכפר סבא')).toBe('live') })
  it('calendar is NOT online', () => { expect(classifyInformationNeed('מה יש לי היום')).toBe('calendar') })
  it('family is NOT online', () => { expect(classifyInformationNeed('מה לאו עבור אופיר')).toBe('family') })
  it('personal is NOT online', () => { expect(classifyInformationNeed('אני קצת בודדה')).toBe('personal') })
})

describe('Online Engine v2 — retry / cache / honest failure', () => {
  it('a non-live query never hits the provider (no hallucinated live fact)', async () => {
    let n = 0
    const r = await runOnlineV2('מה יש לי היום', async () => { n++; return { ok: true, answer: 'x' } })
    expect(n).toBe(0); expect(r.need).toBe('calendar'); expect(r.ok).toBe(false); expect(r.reason).toBe('not_live')
  })
  it('retries a transient failure once, then succeeds', async () => {
    let n = 0
    const r = await runOnlineV2('איזה משחקים יש היום', async () => { n++; return n === 1 ? { ok: false, answer: '', reason: 'timeout' } : { ok: true, answer: 'משחק ב-20:00' } })
    expect(r.ok).toBe(true); expect(r.attempts).toBe(2); expect(r.answer).toBe('משחק ב-20:00')
  })
  it('a persistent failure returns a clear reason (never generic)', async () => {
    const r = await runOnlineV2('איזה משחקים יש היום', async () => ({ ok: false, answer: '', reason: 'provider_failed' }))
    expect(r.ok).toBe(false)
    expect(onlineFailureMessage(r.reason)).toMatch(/נפל|ננסה/)
    expect(onlineFailureMessage(r.reason)).not.toMatch(/אין לי אפשרות/)
  })
  it('caches a successful live answer within TTL', async () => {
    let n = 0
    const provider = async () => { n++; return { ok: true, answer: 'משחק ב-20:00' } }
    await runOnlineV2('איזה משחקים יש היום', provider, 1_000)
    const r2 = await runOnlineV2('איזה משחקים יש היום', provider, 2_000)
    expect(r2.cached).toBe(true); expect(n).toBe(1)
  })
})
