/*
 * scripts/eval/runner.ts — drive ONE case through the REAL live pipeline in text mode.
 * ════════════════════════════════════════════════════════════════════════════
 * Same instructions, same tools, no microphone. It reads the EXACT session payload
 * the voice path sends (buildSessionUpdate → buildLiveInstructions + tool schemas),
 * runs a Chat-Completions turn loop, and executes tool calls through the SAME
 * LiveTools executor the voice path uses. The online tool is wired to the live Brave
 * provider so online cases get real grounded content.
 *
 * THE KEY MEASUREMENT the unit tests cannot make: it captures any assistant TEXT
 * emitted in the SAME assistant turn as a tool call — i.e. text spoken BEFORE the
 * tool result returned. That is the announce-before-checking preamble a string-grep
 * test can never see. (The production text-harness driver DISCARDS this text; we keep it.)
 */
import { buildSessionUpdate } from '../../src/services/liveSession'
import { LiveTools, type OnlineAnswer, type LiveEvent, type LiveCalendarStore } from '../../src/services/liveTools'
import { safeParseArgs, type ParsedFunctionCall } from '../../src/screens/AbuAI/realtime/realtimeFunctionBridge'

export interface EvalCase {
  id: string
  category: string
  user: string
  expect: { behavior: string; answer: string }
}

export interface CaseRun {
  id: string
  category: string
  user: string
  expected: { behavior: string; answer: string }
  /** Every assistant text segment, in the order spoken. */
  spokenSegments: string[]
  /** Assistant text emitted in the SAME turn as a tool call (before the result). */
  preambleSegments: string[]
  /** The final spoken answer (last assistant turn, no tool call). */
  finalText: string
  /** Everything Abu said, joined — what the judge scores. */
  fullSpoken: string
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>
  /** GROUND TRUTH: was any assistant text emitted before a tool result returned? */
  emittedTextBeforeToolResult: boolean
  latencyMs: number
  error?: string
}

export interface RunnerOpts {
  openaiKey: string
  braveKey?: string
  model?: string
  fetchImpl?: typeof fetch
  /** Fixed clock so the "# Today" instruction line is deterministic. */
  nowMs?: number
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

function toChatTools(tools: unknown[]): unknown[] {
  return tools.map((t) => {
    const tool = t as { name: string; description?: string; parameters?: unknown }
    return { type: 'function', function: { name: tool.name, description: tool.description ?? '', parameters: tool.parameters ?? { type: 'object', properties: {}, required: [] } } }
  })
}

/** Minimal in-memory calendar store (LiveCalendarStore) — no browser, no IndexedDB. */
function makeStore(): LiveCalendarStore {
  const items: LiveEvent[] = []
  let n = 0
  return {
    list: () => items.slice(),
    add: (e) => { const ev = { ...e, id: `ev${++n}` }; items.push(ev); return ev },
    update: (id, patch) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...patch }; return items[i]! },
  }
}

/** The online seam, wired to the LIVE Brave provider (Tavily key is dead). Returns the
 *  grounded-endpoint shape LiveTools expects; a miss becomes an honest ok:false. */
function braveOnlineFetch(braveKey: string | undefined, fetchImpl: typeof fetch) {
  return async (query: string): Promise<OnlineAnswer> => {
    if (!braveKey) return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&search_lang=he&count=6`
      const res = await fetchImpl(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey } })
      if (!res.ok) return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
      const d = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }
      const results = d.web?.results ?? []
      const sources = results.filter((r) => r.url).map((r) => ({ title: r.title, url: r.url! }))
      const answer = results.slice(0, 5).map((r) => `${r.title ?? ''}: ${(r.description ?? '').replace(/\s+/g, ' ').trim()}`).join(' | ')
      return { ok: sources.length > 0, answer, sources }
    } catch { return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' } }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function chatOnce(messages: ChatMessage[], tools: unknown[], opts: RunnerOpts): Promise<ChatMessage> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const model = opts.model ?? 'gpt-4o'
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', temperature: 0.4 }),
    })
    if (res.status === 429 || res.status >= 500) { await sleep(2500 * (attempt + 1)); continue }
    if (!res.ok) throw new Error(`chat.completions HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`)
    const data = (await res.json()) as { choices?: Array<{ message?: ChatMessage }> }
    const msg = data.choices?.[0]?.message
    if (!msg) throw new Error('chat.completions returned no message')
    return msg
  }
  throw new Error('chat.completions failed after retries (429/5xx)')
}

const MAX_STEPS = 8

/** Run one case end-to-end. Never throws — an error is captured on the result. */
export async function runCase(tc: EvalCase, opts: RunnerOpts): Promise<CaseRun> {
  const now = opts.nowMs ?? Date.parse('2026-08-14T09:00:00')
  const base: CaseRun = {
    id: tc.id, category: tc.category, user: tc.user, expected: tc.expect,
    spokenSegments: [], preambleSegments: [], finalText: '', fullSpoken: '',
    toolCalls: [], emittedTextBeforeToolResult: false, latencyMs: 0,
  }
  const t0 = Date.now()
  try {
    const update = (buildSessionUpdate(now) as { session: { instructions: string; tools: unknown[] } }).session
    const tools = toChatTools(update.tools)
    const store = makeStore()
    const outputs = new Map<string, string>()
    const send = (event: Record<string, unknown>) => {
      if (event?.type === 'conversation.item.create') {
        const it = event.item as { type?: string; call_id?: string; output?: string } | undefined
        if (it?.type === 'function_call_output' && it.call_id) outputs.set(it.call_id, it.output ?? '{}')
      }
    }
    const liveTools = new LiveTools(send, store, {}, braveOnlineFetch(opts.braveKey, opts.fetchImpl ?? fetch))

    const messages: ChatMessage[] = [
      { role: 'system', content: update.instructions },
      { role: 'user', content: tc.user },
    ]

    for (let step = 0; step < MAX_STEPS; step++) {
      const msg = await chatOnce(messages, tools, opts)
      messages.push(msg)
      const content = (msg.content ?? '').trim()
      const hasTools = !!(msg.tool_calls && msg.tool_calls.length > 0)

      if (hasTools) {
        if (content) { base.preambleSegments.push(content); base.spokenSegments.push(content); base.emittedTextBeforeToolResult = true }
        for (const c of msg.tool_calls!) {
          const fc: ParsedFunctionCall = { name: c.function.name, callId: c.id, argsJson: c.function.arguments || '{}' }
          base.toolCalls.push({ name: fc.name, args: safeParseArgs(fc.argsJson) })
          const out = await execTool(fc, liveTools, outputs)
          messages.push({ role: 'tool', tool_call_id: c.id, content: out })
        }
        continue
      }
      base.finalText = content
      if (content) base.spokenSegments.push(content)
      break
    }
  } catch (err) {
    base.error = (err as Error)?.message ?? String(err)
  }
  base.latencyMs = Date.now() - t0
  base.fullSpoken = base.spokenSegments.join('\n')
  return base
}

async function execTool(fc: ParsedFunctionCall, liveTools: LiveTools, outputs: Map<string, string>): Promise<string> {
  if (fc.name === 'wait_for_user') return '{"status":"waiting"}'
  if (!LiveTools.owns(fc.name)) return JSON.stringify({ error: 'unknown_tool', name: fc.name })
  liveTools.handleFunctionCall(fc)
  // Local tools set the output synchronously; the online tool is async (a real Brave
  // round-trip) and replies via `send` when it returns — poll up to ~12s.
  for (let i = 0; i < 240; i++) {
    const o = outputs.get(fc.callId)
    if (o !== undefined) return o
    await sleep(50)
  }
  return '{"status":"no_result"}'
}
