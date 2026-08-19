/*
 * textHarness/drivers.ts — the model seam (the ONLY place a model is reached).
 * ════════════════════════════════════════════════════════════════════════════
 * Three drivers:
 *   • openAIChatDriver — REAL: sends the SHARED instructions + tools to the same
 *       family of model over TEXT (Chat Completions), so the harness exercises the
 *       actual reasoning/tool layer at scale. Available only when an API key is set.
 *   • blockedDriver    — HONEST no-op: available=false, so every scenario is recorded
 *       BLOCKED (never faked) when no key is present.
 *   • scriptedDriver   — TEST-ONLY: replays a fixed list of ModelSteps to prove the
 *       harness PLUMBING (turn loop, tool routing, assertions) deterministically. It
 *       is NOT Abu and never stands in for real behaviour in the reported pass count.
 */
import type { DriverToolCall, HarnessSession, ModelDriver, ModelStep } from './types'

// ─── blocked (no key) ────────────────────────────────────────────────────────
export function blockedDriver(reason: string): ModelDriver {
  return {
    available: false,
    label: reason,
    begin() { /* no-op */ },
    userSays() { /* no-op */ },
    async next(): Promise<ModelStep> { return { kind: 'speech', text: '', phase: 'final_answer' } },
    toolResult() { /* no-op */ },
  }
}

// ─── scripted (tests only) ───────────────────────────────────────────────────
/** Replays `steps` in order across the whole run. `userSays`/`toolResult` are
 *  recorded so tests can assert the harness fed inputs back correctly. */
export function scriptedDriver(steps: ModelStep[]): ModelDriver & {
  users: string[]; toolResults: Array<{ callId: string; output: string }>
} {
  let i = 0
  const users: string[] = []
  const toolResults: Array<{ callId: string; output: string }> = []
  return {
    available: true,
    label: 'scripted (test plumbing only — NOT Abu)',
    users,
    toolResults,
    begin(_session: HarnessSession) { void _session },
    userSays(t: string) { users.push(t) },
    async next(): Promise<ModelStep> {
      const step = steps[i++]
      if (!step) return { kind: 'speech', text: '', phase: 'final_answer' }
      return step
    },
    toolResult(callId: string, output: string) { toolResults.push({ callId, output }) },
  }
}

// ─── real OpenAI Chat Completions driver ─────────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

/** Convert a Realtime-format tool ({type,name,description,parameters}) to the Chat
 *  Completions tool shape ({type:'function', function:{...}}). Same schema, same
 *  registry — only the envelope differs between the two OpenAI surfaces. */
function toChatTools(tools: unknown[]): unknown[] {
  return tools.map((t) => {
    const tool = t as { name: string; description?: string; parameters?: unknown }
    return { type: 'function', function: { name: tool.name, description: tool.description ?? '', parameters: tool.parameters ?? { type: 'object', properties: {} } } }
  })
}

export interface OpenAIChatDriverOptions {
  apiKey: string
  model?: string
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
  endpoint?: string
}

export function openAIChatDriver(opts: OpenAIChatDriverOptions): ModelDriver {
  const model = opts.model ?? 'gpt-4o'
  const fetchImpl = opts.fetchImpl ?? fetch
  const endpoint = opts.endpoint ?? 'https://api.openai.com/v1/chat/completions'
  let messages: ChatMessage[] = []
  let tools: unknown[] = []

  return {
    available: !!opts.apiKey,
    label: `openAIChatDriver(${model})`,
    begin(session: HarnessSession) {
      messages = [{ role: 'system', content: session.instructions }]
      tools = toChatTools(session.tools)
    },
    userSays(t: string) { messages.push({ role: 'user', content: t }) },
    async next(): Promise<ModelStep> {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', temperature: 0.4 }),
      })
      if (!res.ok) throw new Error(`chat.completions HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data = (await res.json()) as { choices?: Array<{ message?: ChatMessage }> }
      const msg = data.choices?.[0]?.message
      if (!msg) throw new Error('chat.completions returned no message')
      messages.push(msg)
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const calls: DriverToolCall[] = msg.tool_calls.map((c) => ({
          name: c.function.name, callId: c.id, argsJson: c.function.arguments || '{}',
        }))
        return { kind: 'tool_calls', calls }
      }
      return { kind: 'speech', text: msg.content ?? '', phase: 'final_answer' }
    },
    toolResult(callId: string, output: string) {
      messages.push({ role: 'tool', tool_call_id: callId, content: output })
    },
  }
}

/** Resolve the default driver from the environment: the real OpenAI driver when a
 *  key is present, otherwise an honest blocked driver (never a fake). */
export function resolveDefaultDriver(env: Record<string, string | undefined> = process.env): ModelDriver {
  const apiKey = env.OPENAI_API_KEY
  if (apiKey) return openAIChatDriver({ apiKey, model: env.TEXT_HARNESS_MODEL ?? 'gpt-4o' })
  return blockedDriver('no model driver — OPENAI_API_KEY is not set (scenarios BLOCKED, never faked)')
}
