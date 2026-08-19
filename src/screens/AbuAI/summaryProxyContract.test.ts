/*
 * Regression: generateLLMSummary must call /api/abuai-chat with the REAL proxy
 * contract ({ body, lang, stream }) and read the wrapped { ok, openai } shape.
 *
 * The previous implementation POSTed { model, messages, … } at the top level
 * (which the proxy rejects as BAD_REQUEST) and read res.choices (the proxy wraps
 * as { ok, openai }). Both bugs meant the LLM summary SILENTLY never ran and the
 * pattern fallback was always used. This test fails if either regression returns.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateLLMSummary } from './service'

const FOUR_MSGS = [
  { role: 'user', content: 'מי זאת מור?' },
  { role: 'assistant', content: 'מור, הבת שלך.' },
  { role: 'user', content: 'אני מתגעגעת לפאפי' },
  { role: 'assistant', content: 'אני יודעת, מרטיטה.' },
]

afterEach(() => { vi.unstubAllGlobals() })

describe('generateLLMSummary proxy contract', () => {
  it('posts the proxy { body, lang, stream } shape — not a bare OpenAI body', async () => {
    let captured: { url: string; body: unknown } | null = null
    const fakeFetch = vi.fn(async (url: string, init: { body: string }) => {
      captured = { url, body: JSON.parse(init.body) }
      return {
        ok: true,
        json: async () => ({ ok: true, openai: { choices: [{ message: { content: 'מרטיטה דיברה על מור ועל פאפי. מצב רגשי: געגוע.' } }] } }),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fakeFetch)

    const summary = await generateLLMSummary(FOUR_MSGS, null)

    expect(fakeFetch).toHaveBeenCalledOnce()
    expect(captured!.url).toContain('/api/abuai-chat')
    const sent = captured!.body as { body?: { model?: string; messages?: unknown[] }; lang?: string; stream?: boolean }
    // The OpenAI body is nested under `body` — the contract the proxy enforces.
    expect(sent.body).toBeDefined()
    expect(sent.body!.model).toBe('gpt-4o-mini')
    expect(Array.isArray(sent.body!.messages)).toBe(true)
    expect(sent.stream).toBe(false)
    // And the wrapped { ok, openai } answer is actually used.
    expect(summary.factsMentioned[0]).toContain('געגוע')
  })

  it('falls back to the pattern summary when the proxy returns an error', async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: false, errorCode: 'BAD_REQUEST', userMessage: 'לא הבנתי' }),
    } as unknown as Response))
    vi.stubGlobal('fetch', fakeFetch)

    const summary = await generateLLMSummary(FOUR_MSGS, null)
    // No LLM text injected — the single fact (if any) is never the error copy.
    expect(summary.factsMentioned.join(' ')).not.toContain('לא הבנתי')
  })

  it('falls back to the pattern summary when fetch rejects (network)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const summary = await generateLLMSummary(FOUR_MSGS, null)
    expect(summary).toBeDefined()
    expect(Array.isArray(summary.peopleDiscussed)).toBe(true)
  })
})
