/*
 * PARITY LIVE JUDGE — wiring + cross-check aggregation (deterministic, mocked fetch).
 * ════════════════════════════════════════════════════════════════════════════════════
 * The KEYED live run is out-of-band (no provider keys in this env). This suite proves the
 * parts that CAN be proven deterministically: (1) the request wiring matches the provider
 * contracts (Anthropic /v1/messages with claude-opus-4-8 + output_config.effort + the
 * structured-output judge schema; OpenAI /v1/chat/completions), and (2) the cross-check
 * aggregation — AND across judges, OR across references — is correct. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import {
  makeClaudeReference, makeOpenAIReference, makeClaudeJudge, makeOpenAIJudge,
  makeCrossCheckJudge, makeCrossCheckReference, makeCrossCheckSeamJudge,
  type FetchLike,
} from './parityLiveJudge'
import { DIMENSIONS, type Dim, type ParityTurn } from './parityScorecard'

const TURN: ParityTurn = { text: 'מה שלומך?', lang: 'he', cat: 'chitchat' }
const allTrue = () => Object.fromEntries(DIMENSIONS.map((d) => [d, true]))
const okJson = (obj: unknown): { ok: boolean; status: number; json: () => Promise<unknown> } => ({ ok: true, status: 200, json: async () => obj })

/** A fetch spy that records requests and returns a canned body per URL substring. */
function spy(routes: Array<{ match: string; body: unknown }>): { fetch: FetchLike; calls: Array<{ url: string; body: any }> } {
  const calls: Array<{ url: string; body: any }> = []
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    const r = routes.find((x) => url.includes(x.match))
    if (!r) throw new Error(`no route for ${url}`)
    return okJson(r.body)
  }
  return { fetch, calls }
}

describe('parity live judge — request wiring', () => {
  it('Claude reference posts to /v1/messages with claude-opus-4-8 + effort + persona system', async () => {
    const { fetch, calls } = spy([{ match: '/v1/messages', body: { content: [{ type: 'text', text: 'בסדר גמור, תודה!' }] } }])
    const ref = makeClaudeReference({ apiKey: 'k', model: 'claude-opus-4-8' }, fetch)
    const out = await ref(TURN, [])
    expect(out).toBe('בסדר גמור, תודה!')
    expect(calls[0]!.url).toContain('api.anthropic.com/v1/messages')
    expect(calls[0]!.body.model).toBe('claude-opus-4-8')
    expect(calls[0]!.body.output_config.effort).toBe('high')
    expect(String(calls[0]!.body.system)).toContain('Martita')
  })

  it('OpenAI reference posts to /v1/chat/completions and reads choices[0].message.content', async () => {
    const { fetch, calls } = spy([{ match: '/v1/chat/completions', body: { choices: [{ message: { content: 'Todo bien, gracias.' } }] } }])
    const ref = makeOpenAIReference({ apiKey: 'k', model: 'gpt-x' }, fetch)
    expect(await ref({ text: '¿cómo estás?', lang: 'es', cat: 'chitchat' }, [])).toBe('Todo bien, gracias.')
    expect(calls[0]!.url).toContain('api.openai.com/v1/chat/completions')
    expect(calls[0]!.body.messages[0]).toEqual({ role: 'system', content: expect.stringContaining('Martita') })
  })

  it('Claude judge requests a structured json_schema verdict over all 6 dimensions', async () => {
    const { fetch, calls } = spy([{ match: '/v1/messages', body: { content: [{ type: 'text', text: JSON.stringify(allTrue()) }] } }])
    const judge = makeClaudeJudge({ apiKey: 'k', model: 'claude-opus-4-8' }, fetch)
    const v = await judge('app reply', 'ref reply', TURN)
    expect(v.correctness).toBe(true)
    const schema = calls[0]!.body.output_config.format.schema
    for (const d of DIMENSIONS) expect(schema.properties[d]).toEqual({ type: 'boolean' })
    expect(calls[0]!.body.output_config.format.type).toBe('json_schema')
  })

  it('OpenAI judge requests a json_object and parses per-dim booleans', async () => {
    const verdict = { ...allTrue(), warmth: false }
    const { fetch, calls } = spy([{ match: '/v1/chat/completions', body: { choices: [{ message: { content: JSON.stringify(verdict) } }] } }])
    const judge = makeOpenAIJudge({ apiKey: 'k', model: 'gpt-x' }, fetch)
    const v = await judge('app', 'ref', TURN)
    expect(v.warmth).toBe(false)
    expect(v.correctness).toBe(true)
    expect(calls[0]!.body.response_format).toEqual({ type: 'json_object' })
  })
})

describe('parity live judge — cross-check aggregation', () => {
  const judgeReturning = (v: Partial<Record<Dim, boolean>>) => async () => v

  it('AND across judges: a dimension passes only if EVERY judge agrees', async () => {
    const cross = makeCrossCheckJudge([judgeReturning({ correctness: true, warmth: true }), judgeReturning({ correctness: true, warmth: false })])
    const v = await cross('app', ['ref'], TURN)
    expect(v.correctness).toBe(true)  // both said true
    expect(v.warmth).toBe(false)      // one said false → AND fails
  })

  it('OR across references: passes if it holds against EITHER reference (stronger one wins)', async () => {
    // Judge says warmth=false vs a weak ref, warmth=true vs a strong ref.
    const perRef: Record<string, Partial<Record<Dim, boolean>>> = { weak: { warmth: false }, strong: { warmth: true } }
    const judge = async (_app: string, ref: string) => perRef[ref]!
    const cross = makeCrossCheckJudge([judge])
    const v = await cross('app', ['weak', 'strong'], TURN)
    expect(v.warmth).toBe(true) // OR across refs → the stronger reference lets it pass
  })

  it('seam adapters carry BOTH references through the single ref channel', async () => {
    const claudeRef = async () => 'CLAUDE_REF'
    const openaiRef = async () => 'OPENAI_REF'
    const refFn = makeCrossCheckReference(claudeRef, openaiRef)
    const encoded = await refFn(TURN, [])
    expect(JSON.parse(encoded)).toEqual({ claude: 'CLAUDE_REF', openai: 'OPENAI_REF' })
    // The seam judge decodes both and runs the cross-check; here one ref fails correctness,
    // the other passes → OR across refs → passes.
    const seamJudge = makeCrossCheckSeamJudge([async (_a, ref) => ({ correctness: ref === 'OPENAI_REF' })])
    expect((await seamJudge('app', encoded, TURN)).correctness).toBe(true)
  })
})
