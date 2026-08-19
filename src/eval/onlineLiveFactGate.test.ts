/*
 * onlineLiveFactGate.test.ts — /api/abuai-online live-fact freshness gate (§16: GROUNDED + FRESH).
 * Drives the REAL handler with a mocked fetch and proves:
 *   • weather → dated Open-Meteo answer (ok, answerPath=live-weather), keyless
 *   • fx      → dated frankfurter/ECB answer with its date (answerPath=live-fx), keyless
 *   • latest result → honest decline (no dated source), NO fabricated stale answer
 *   • office-holder (non-live-fact) → falls through to the existing OpenAI grounded path unchanged
 * Evidence class: CODE (handler run, mocked upstreams). Real freshness is PREVIEW (deployed matrix).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import handler from '../../api/abuai-online'

const URL = 'http://localhost/api/abuai-online'
const post = (body: unknown): Request => new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const TODAY = new Date().toISOString().slice(0, 10)   // keep mocked source dates fresh vs the handler's real clock

interface OnlineResp { ok: boolean; answer?: string; errorCode?: string; diag?: { answerPath?: string; sourceCount?: number } }

function routeFetch(handlerFn: (url: string) => { ok: boolean; json: unknown } | null) {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const res = handlerFn(String(input))
    if (!res) return { ok: false, status: 500, json: async () => ({}) } as unknown as Response
    return { ok: res.ok, status: 200, json: async () => res.json } as unknown as Response
  }))
}

afterEach(() => vi.restoreAllMocks())

describe('/api/abuai-online — live-fact freshness gate', () => {
  it('weather → dated Open-Meteo answer, keyless (no OPENAI_API_KEY needed)', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} }
    routeFetch((u) => u.includes('open-meteo') ? { ok: true, json: { utc_offset_seconds: 10800, current: { time: `${TODAY}T12:00`, temperature_2m: 27.4, weather_code: 1 } } } : null)
    const j = await (await handler(post({ query: 'מה מזג האוויר עכשיו בכפר סבא?', lang: 'he' }))).json() as OnlineResp
    expect(j.ok).toBe(true)
    expect(j.answer).toMatch(/27°/)
    expect(j.diag?.answerPath).toBe('live-weather')
  })

  it('fx → dated ECB rate WITH its date; the value is the authoritative rate, not a scraped number', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} }
    routeFetch((u) => u.includes('frankfurter') ? { ok: true, json: { base: 'USD', date: TODAY, rates: { ILS: 2.9496 } } } : { ok: true, json: { text: 'garbage 600 ₪ 2.10' } })
    const j = await (await handler(post({ query: 'מה שער הדולר היום?', lang: 'he' }))).json() as OnlineResp
    expect(j.ok).toBe(true)
    expect(j.answer).toMatch(/2\.95/)
    expect(j.answer).toContain(TODAY)
    expect(j.answer).not.toMatch(/600|2\.10/)
    expect(j.diag?.answerPath).toBe('live-fx')
  })

  it('latest RESULT → honest decline (no search provider / no dated source), never fabricated/stale', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: { OPENAI_API_KEY: 'k' } }
    routeFetch(() => null)
    const j = await (await handler(post({ query: 'מי ניצח בסופרבול האחרון?', lang: 'he' }))).json() as OnlineResp
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('ONLINE_NO_RESULTS')
    expect(j.answer).toBeUndefined()
    expect(j.diag?.answerPath).toBe('live-decline-result')
  })

  it('latest RESULT with a FRESH dated source → ANSWERS (dated-search capability), path=live-result-dated', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: { ONLINE_PROVIDER: 'tavily', TAVILY_API_KEY: 'k', OPENAI_API_KEY: 'k', ONLINE_DEEP_FETCH: '0' } }
    routeFetch((u) => {
      if (u.includes('api.tavily.com')) return { ok: true, json: { answer: '', results: [{ url: 'https://sports.example', title: 'Final score', content: 'Team A won 30-27', published_date: TODAY }] } }
      if (u.includes('api.openai.com')) return { ok: true, json: { choices: [{ message: { content: JSON.stringify({ status: 'answer', answer: 'קבוצה A ניצחה שלושים למול עשרים ושבע.' }) } }] } }
      return null
    })
    const j = await (await handler(post({ query: 'מי ניצח במשחק האחרון?', lang: 'he' }))).json() as OnlineResp
    expect(j.ok).toBe(true)
    expect(j.diag?.answerPath).toBe('live-result-dated')
  })

  it('latest RESULT with only a STALE dated source → honest decline (never certify stale)', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: { ONLINE_PROVIDER: 'tavily', TAVILY_API_KEY: 'k', OPENAI_API_KEY: 'k', ONLINE_DEEP_FETCH: '0' } }
    routeFetch((u) => u.includes('api.tavily.com') ? { ok: true, json: { results: [{ url: 'https://old.example', title: 'old', content: 'x', published_date: '2020-01-01' }] } } : null)
    const j = await (await handler(post({ query: 'מי ניצח בסופרבול האחרון?', lang: 'he' }))).json() as OnlineResp
    expect(j.ok).toBe(false)
    expect(j.diag?.answerPath).toBe('live-decline-result')
  })

  it('office-holder (non-live-fact) still uses the existing OpenAI grounded path', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: { OPENAI_API_KEY: 'k' } }
    routeFetch((u) => u.includes('openai.com') ? { ok: true, json: { output: [{ content: [{ type: 'output_text', text: 'ראש הממשלה הוא בנימין נתניהו.', annotations: [{ type: 'url_citation', url: 'https://example.gov', title: 'gov' }] }] }] } } : null)
    const j = await (await handler(post({ query: 'מי ראש הממשלה עכשיו?', lang: 'he' }))).json() as OnlineResp
    expect(j.ok).toBe(true)
    expect(j.diag?.answerPath).toBe('openai')
  })

  it('weather source down → honest decline (never invents a temperature)', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} }
    routeFetch(() => null)
    const j = await (await handler(post({ query: 'כמה מעלות עכשיו?', lang: 'he' }))).json() as OnlineResp
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('ONLINE_NO_RESULTS')
    expect(j.diag?.answerPath).toBe('live-decline-weather')
  })
})
