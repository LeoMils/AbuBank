/*
 * Regression: the /api/abuai-online endpoint must NOT return a confident answer for a
 * current-info query when web_search produced ZERO sources.
 *
 * Real device incident (build 0.74.0, iPhone): "who won the World Cup match yesterday"
 * returned fabricated fixtures as ok:true. Root cause: the endpoint returned
 * `ok:true` with the model's free text whenever an answer existed, attaching sources
 * only when present — so an ungrounded (memory / hallucinated) answer with 0 sources was
 * surfaced as fact. §47 release gate + "NO TOOL RESULT = NO CLAIM": a current-info answer
 * with no evidence of retrieval must be an HONEST failure, never a confident claim.
 *
 * Evidence class: CODE / AUTOMATED_TEST (endpoint handler run with a mocked provider).
 * PREVIEW re-verification (redeploy + real probe) is a separate, stronger step.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import handler from '../../api/abuai-online'

function req(body: unknown): Request {
  return new Request('http://localhost/api/abuai-online', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function openaiResponse(text: string, sources: Array<{ url: string; title?: string }>) {
  const annotations = sources.map(s => ({ type: 'url_citation', url: s.url, ...(s.title ? { title: s.title } : {}) }))
  return { output: [{ content: [{ type: 'output_text', text, annotations }] }] }
}

describe('online grounding gate — no sources ⇒ honest failure, never a confident answer', () => {
  beforeEach(() => { (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: { OPENAI_API_KEY: 'test-key' } } })
  afterEach(() => { vi.restoreAllMocks() })

  it('a GROUNDED answer (with a source) is returned ok:true with its sources', async () => {
    // A non-live-fact current query (office-holder) — this exercises the OpenAI grounded path.
    // (weather/fx now have dedicated dated live-fact sources, see liveFacts.ts / onlineLiveFactGate.)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(
      openaiResponse('ראש עיריית תל אביב הוא רון חולדאי.', [{ url: 'https://tel-aviv.example/mayor', title: 'City' }]),
    ), { status: 200 })))
    const res = await handler(req({ query: 'who is the mayor of Tel Aviv', lang: 'he' }))
    const j = await res.json() as { ok: boolean; answer?: string; sources?: unknown[] }
    expect(j.ok).toBe(true)
    expect(j.sources?.length).toBeGreaterThan(0)
    expect(j.answer).toContain('חולדאי')
  })

  it('an UNGROUNDED answer (zero sources) is REJECTED as ONLINE_NO_RESULTS — never surfaced', async () => {
    // The model "answers" but web_search returned nothing → no citations. The fabricated
    // free text must be discarded, not returned as ok:true.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(
      openaiResponse('נבחרת ארגנטינה ניצחה 2-1 אתמול במונדיאל.', []),
    ), { status: 200 })))
    const res = await handler(req({ query: 'מי ניצח במשחקי המונדיאל אתמול', lang: 'he' }))
    const j = await res.json() as { ok: boolean; errorCode?: string; userMessage?: string; answer?: string }
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('ONLINE_NO_RESULTS')
    expect(j.answer).toBeUndefined()            // the fabricated text is NOT leaked
    expect(j.userMessage).not.toContain('ארגנטינה')
    expect(j.userMessage).toMatch(/לא מצאתי/)   // honest Hebrew message
  })
})
