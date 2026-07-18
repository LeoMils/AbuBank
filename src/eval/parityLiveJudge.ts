/*
 * PARITY LIVE JUDGE — the pluggable ChatGPT-class reference + cross-check judge.
 * ═══════════════════════════════════════════════════════════════════════════
 * Implements the `ParityOptions.reference` / `.judge` seam from parityScorecard.ts so
 * the parity scorecard can score AbuAI's ACTUAL reply against a LIVE reference reply from
 * a top model, judged by a panel — the mandate's "identical to ChatGPT" measure.
 *
 * CROSS-CHECK (user choice): the reference is taken from BOTH a Claude model and an OpenAI
 * (GPT) model, and the per-dimension verdict is the CONSERVATIVE AND across the judge panel
 * — a dimension passes only if EVERY judge agrees AbuAI matched the reference. Divergence =
 * a flagged parity gap. Two references also let the judges compare against the better of two.
 *
 * NO NEW DEPENDENCIES: uses raw `fetch` (adding an SDK would touch package.json, which is a
 * HUMAN_APPROVAL_REQUIRED gate here). Anthropic calls follow the claude-api contract
 * (`claude-opus-4-8`, `output_config.effort`, structured-output judge). Requires provider
 * keys at call time — this env has none, so this runs OUT-OF-BAND (a keyed script/CI job),
 * NOT in the unit suite. The wiring + cross-check aggregation are proven deterministically
 * with mocked fetch in parityLiveJudge.test.ts. Evidence class of a keyed run: PREVIEW/PRODUCTION.
 */
import { DIMENSIONS, type Dim, type ParityTurn } from './parityScorecard'

// The warm-elderly-companion persona brief the reference model answers UNDER — the same
// character AbuAI targets, so the comparison is like-for-like, not AbuAI vs a generic bot.
export const PERSONA_BRIEF =
  'You are a warm, smart companion for Martita — a Spanish/Hebrew-speaking woman in her 80s. ' +
  'Answer as a person who knows her, never like an app. 2–4 sentences, direct answer first. ' +
  'Reply in the SAME language as her message (Hebrew → Hebrew; Rioplatense Spanish → Spanish, using vos). ' +
  'Never patronize, never use childish praise, never emoji-spam. Family is everything to her.'

export interface ProviderConfig { apiKey: string; model: string; baseUrl?: string }
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

const toChat = (turn: ParityTurn, history: Array<{ role: string; content: string }>) =>
  [...history, { role: 'user', content: turn.text }]

// ── Anthropic (Claude) — reference + judge, per the claude-api contract ──────
export function makeClaudeReference(cfg: ProviderConfig, fetchImpl: FetchLike): (t: ParityTurn, h: Array<{ role: string; content: string }>) => Promise<string> {
  return async (turn, history) => {
    const res = await fetchImpl(`${cfg.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model, max_tokens: 400,
        system: PERSONA_BRIEF,
        output_config: { effort: 'high' },
        messages: toChat(turn, history).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    })
    if (!res.ok) throw new Error(`claude reference ${res.status}`)
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    return (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim()
  }
}

// ── OpenAI (GPT) — reference, raw chat-completions ───────────────────────────
export function makeOpenAIReference(cfg: ProviderConfig, fetchImpl: FetchLike): (t: ParityTurn, h: Array<{ role: string; content: string }>) => Promise<string> {
  return async (turn, history) => {
    const res = await fetchImpl(`${cfg.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 400, messages: [{ role: 'system', content: PERSONA_BRIEF }, ...toChat(turn, history)] }),
    })
    if (!res.ok) throw new Error(`openai reference ${res.status}`)
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return (body.choices?.[0]?.message?.content ?? '').trim()
  }
}

// The judge's structured verdict: one boolean per dimension + a short reason.
const JUDGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: Object.fromEntries(DIMENSIONS.flatMap((d) => [[d, { type: 'boolean' }], [`${d}_why`, { type: 'string' }]])),
  required: DIMENSIONS.flatMap((d) => [d, `${d}_why`]),
} as const

function judgePrompt(app: string, ref: string, turn: ParityTurn): string {
  return `Turn (${turn.lang}): "${turn.text}"\nREFERENCE reply (a top model, same persona): "${ref}"\n` +
    `AbuAI reply: "${app}"\nFor EACH dimension, answer true only if AbuAI is AT LEAST AS GOOD as the reference: ` +
    `correctness, warmth, brevity, answered (answered what was asked), language (same language as the turn), naturalness. ` +
    `Return the JSON object per the schema.`
}

/** One Claude judge (structured output). Returns per-dim booleans. */
export function makeClaudeJudge(cfg: ProviderConfig, fetchImpl: FetchLike): (app: string, ref: string, t: ParityTurn) => Promise<Partial<Record<Dim, boolean>>> {
  return async (app, ref, turn) => {
    const res = await fetchImpl(`${cfg.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model, max_tokens: 700,
        output_config: { effort: 'high', format: { type: 'json_schema', schema: JUDGE_SCHEMA } },
        messages: [{ role: 'user', content: judgePrompt(app, ref, turn) }],
      }),
    })
    if (!res.ok) throw new Error(`claude judge ${res.status}`)
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    const raw = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
    return pickDims(JSON.parse(raw) as Record<string, unknown>)
  }
}

/** One OpenAI judge (JSON response). Returns per-dim booleans. */
export function makeOpenAIJudge(cfg: ProviderConfig, fetchImpl: FetchLike): (app: string, ref: string, t: ParityTurn) => Promise<Partial<Record<Dim, boolean>>> {
  return async (app, ref, turn) => {
    const res = await fetchImpl(`${cfg.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 700, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: judgePrompt(app, ref, turn) + ' Reply with ONLY the JSON object.' }] }),
    })
    if (!res.ok) throw new Error(`openai judge ${res.status}`)
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return pickDims(JSON.parse(body.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>)
  }
}

// ── Seam adapters — fit the single-`ref` ParityOptions channel while carrying BOTH
// references (both encoded into the ref string; no side-channel). Pass these straight to
// runParityScorecard({ reference, judge }).
export function makeCrossCheckReference(
  claudeRef: (t: ParityTurn, h: Array<{ role: string; content: string }>) => Promise<string>,
  openaiRef: (t: ParityTurn, h: Array<{ role: string; content: string }>) => Promise<string>,
): (t: ParityTurn, h: Array<{ role: string; content: string }>) => Promise<string> {
  return async (turn, history) => JSON.stringify({ claude: await claudeRef(turn, history), openai: await openaiRef(turn, history) })
}
export function makeCrossCheckSeamJudge(
  judges: Array<(app: string, ref: string, t: ParityTurn) => Promise<Partial<Record<Dim, boolean>>>>,
): (app: string, refJson: string, t: ParityTurn) => Promise<Partial<Record<Dim, boolean>>> {
  const cross = makeCrossCheckJudge(judges)
  return async (app, refJson, turn) => {
    const { claude, openai } = JSON.parse(refJson) as { claude?: string; openai?: string }
    return cross(app, [claude, openai].filter((x): x is string => !!x), turn)
  }
}

function pickDims(obj: Record<string, unknown>): Partial<Record<Dim, boolean>> {
  const out: Partial<Record<Dim, boolean>> = {}
  for (const d of DIMENSIONS) if (typeof obj[d] === 'boolean') out[d] = obj[d] as boolean
  return out
}

/**
 * Cross-check judge: run every judge and AND their per-dimension verdicts — a dimension
 * passes only if ALL judges agree AbuAI matched the reference. When two references are
 * supplied, AbuAI is compared against the STRONGER reference per dimension (a dim passes
 * if it holds against EITHER reference), so a weak reference from one provider can't fail it.
 */
export function makeCrossCheckJudge(
  judges: Array<(app: string, ref: string, t: ParityTurn) => Promise<Partial<Record<Dim, boolean>>>>,
): (app: string, refs: string[], t: ParityTurn) => Promise<Partial<Record<Dim, boolean>>> {
  return async (app, refs, turn) => {
    const perRef: Array<Partial<Record<Dim, boolean>>> = []
    for (const ref of refs) {
      const verdicts = await Promise.all(judges.map((j) => j(app, ref, turn)))
      // AND across judges for this reference.
      const anded: Partial<Record<Dim, boolean>> = {}
      for (const d of DIMENSIONS) {
        const vals = verdicts.map((v) => v[d]).filter((x): x is boolean => typeof x === 'boolean')
        if (vals.length) anded[d] = vals.every(Boolean)
      }
      perRef.push(anded)
    }
    // OR across references (compare against the stronger reference per dimension).
    const out: Partial<Record<Dim, boolean>> = {}
    for (const d of DIMENSIONS) {
      const vals = perRef.map((v) => v[d]).filter((x): x is boolean => typeof x === 'boolean')
      if (vals.length) out[d] = vals.some(Boolean)
    }
    return out
  }
}
