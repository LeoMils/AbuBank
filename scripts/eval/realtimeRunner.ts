/*
 * scripts/eval/realtimeRunner.ts — drive the ACTUAL realtime model (gpt-realtime)
 * over its GA WebSocket with TEXT input, using Abu's OWN session path.
 * ════════════════════════════════════════════════════════════════════════════
 * This is the correct instrument (Phase 0). The chat-completions harness drove
 * gpt-4o and did NOT reproduce the device's announce-before-tool preamble. This one
 * uses the SAME model, the SAME buildSessionUpdate() instructions + tool schemas,
 * and the SAME LiveTools executor — only output is text instead of audio.
 *
 * Per turn it captures: response text, tool calls, ANY text emitted before a tool
 * result, time-to-first-token, and total latency.
 *
 * FIDELITY CAVEAT (reported, never hidden): this forces output_modalities:['text'].
 * It is the same model + instructions + tools as the device, but the device renders
 * AUDIO. Text-output realtime is the closest faithful reproduction without a mic; a
 * behavior that only appears with audio streaming may still differ. It is a large
 * step closer than the gpt-4o chat harness, not a perfect twin.
 */
import './nodeShim'
import WebSocket from 'ws'
import { buildSessionUpdate } from '../../src/services/liveSession'
import { LiveTools, type OnlineAnswer, type OnlineFetch, type LiveEvent, type LiveCalendarStore } from '../../src/services/liveTools'
import { safeParseArgs, type ParsedFunctionCall } from '../../src/screens/AbuAI/realtime/realtimeFunctionBridge'

export interface TurnRecord {
  user: string
  text: string
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>
  emittedTextBeforeToolResult: boolean
  preambleText: string
  ttftMs: number | null
  totalMs: number
  error?: string
}

export interface RealtimeOpts {
  openaiKey: string
  braveKey?: string
  model?: string
  nowMs?: number
  /** Inject the online seam (e.g. first-wins PAGE fetch). Defaults to the Brave snippet
   *  fetch below, so existing callers are unchanged. */
  onlineFetch?: OnlineFetch
}

function makeStore(): LiveCalendarStore {
  const items: LiveEvent[] = []
  let n = 0
  return {
    list: () => items.slice(),
    add: (e) => { const ev = { ...e, id: `ev${++n}` }; items.push(ev); return ev },
    update: (id, patch) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...patch }; return items[i]! },
  }
}

function braveOnlineFetch(braveKey: string | undefined) {
  return async (query: string): Promise<OnlineAnswer> => {
    if (!braveKey) return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&search_lang=he&count=6`
      const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey } })
      if (!res.ok) return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
      const d = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }
      const results = d.web?.results ?? []
      const sources = results.filter((r) => r.url).map((r) => ({ title: r.title, url: r.url! }))
      // CONTENT ONLY — no source titles in the payload (Phase 2A mandate). A compliant
      // provider adapter hands the model facts, not attributed snippets.
      const answer = results.slice(0, 5).map((r) => (r.description ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')
      return { ok: sources.length > 0, answer, sources }
    } catch { return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' } }
  }
}

interface Conn { ws: WebSocket; send: (o: unknown) => void }

function connect(model: string, key: string): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${model}`, { headers: { Authorization: `Bearer ${key}` } })
    const to = setTimeout(() => { ws.close(); reject(new Error('connect timeout')) }, 20000)
    ws.on('open', () => { clearTimeout(to); resolve({ ws, send: (o) => ws.send(JSON.stringify(o)) }) })
    ws.on('error', (e) => { clearTimeout(to); reject(e) })
  })
}

/** Drive ONE conversation (its turns share the same live session, like the device). */
export async function runConversationRealtime(turns: string[], opts: RealtimeOpts): Promise<TurnRecord[]> {
  const now = opts.nowMs ?? Date.parse('2026-08-14T09:00:00')
  const model = opts.model ?? 'gpt-realtime'
  const full = (buildSessionUpdate(now) as { session: Record<string, unknown> }).session
  // Send the BEHAVIOR-relevant fields verbatim (the real instructions + tool schemas +
  // tool_choice + reasoning effort). The audio/turn_detection transport config is dropped
  // for a text session (GA rejects it here) — it does not shape what Abu decides or says.
  const session: Record<string, unknown> = {
    type: 'realtime',
    output_modalities: ['text'],
    instructions: full.instructions,
    tools: full.tools,
    tool_choice: full.tool_choice ?? 'auto',
  }
  // NOTE: the device session carries reasoning:{effort:'low'} but the GA realtime WS
  // rejects it ("Unsupported option for this model") — dropped here. Fidelity gap:
  // reasoning effort can shape behavior; reported, not hidden.

  const store = makeStore()
  const outputs = new Map<string, string>()
  const sendToolOutputHolder = (event: Record<string, unknown>) => {
    if (event?.type === 'conversation.item.create') {
      const it = event.item as { type?: string; call_id?: string; output?: string } | undefined
      if (it?.type === 'function_call_output' && it.call_id) outputs.set(it.call_id, it.output ?? '{}')
    }
  }
  const liveTools = new LiveTools(sendToolOutputHolder, store, {}, opts.onlineFetch ?? braveOnlineFetch(opts.braveKey))

  const records: TurnRecord[] = []
  let conn: Conn
  try { conn = await connect(model, opts.openaiKey) } catch (e) { return turns.map((u) => ({ user: u, text: '', toolCalls: [], emittedTextBeforeToolResult: false, preambleText: '', ttftMs: null, totalMs: 0, error: `connect: ${(e as Error).message}` })) }
  const { ws, send } = conn
  send({ type: 'session.update', session })

  // One event router for the whole connection; each turn installs its own resolver.
  let onEvent: ((ev: Record<string, unknown>) => void) | null = null
  ws.on('message', (buf: Buffer) => { try { const ev = JSON.parse(buf.toString()); onEvent?.(ev) } catch { /* ignore */ } })

  try {
    for (const user of turns) {
      records.push(await driveTurn(send, user, liveTools, outputs, (h) => { onEvent = h }))
    }
  } finally {
    ws.close()
  }
  return records
}

/** Drive a single user turn to completion (through any tool calls) and record it. */
function driveTurn(
  send: (o: unknown) => void,
  user: string,
  liveTools: LiveTools,
  outputs: Map<string, string>,
  setHandler: (h: (ev: Record<string, unknown>) => void) => void,
): Promise<TurnRecord> {
  return new Promise((resolve) => {
    const rec: TurnRecord = { user, text: '', toolCalls: [], emittedTextBeforeToolResult: false, preambleText: '', ttftMs: null, totalMs: 0 }
    const t0 = Date.now()
    let textBuf = ''
    let curResponseText = '' // text within the CURRENT response, before any function call
    let sawFunctionCallThisResponse = false
    const pendingFc: Array<{ callId: string; name: string; args: string }> = []
    const done = () => { rec.text = textBuf.trim(); rec.totalMs = Date.now() - t0; setHandler(() => {}); resolve(rec) }
    const hardTimeout = setTimeout(() => { rec.error = rec.error ?? 'turn timeout'; done() }, 45000)

    setHandler((ev) => {
      const type = ev.type as string
      if (type === 'error' || type === 'response.error') { rec.error = JSON.stringify((ev as { error?: unknown }).error ?? ev).slice(0, 200); clearTimeout(hardTimeout); done(); return }
      if (type === 'response.output_text.delta' || type === 'response.text.delta') {
        const delta = (ev as { delta?: string }).delta ?? ''
        // ttft = time to first SPOKEN token. The FIRST output-text delta of the turn is the
        // first thing Martita would hear — whether it lands before a tool (a preamble, which
        // the product forbids) or after the tool result returns (the grounded answer). It is
        // NOT set on a function_call event (that is a silent decision, not speech).
        if (rec.ttftMs === null) rec.ttftMs = Date.now() - t0
        textBuf += delta; curResponseText += delta
        return
      }
      if (type === 'response.function_call_arguments.done') {
        const name = (ev as { name?: string }).name ?? 'unknown'
        const callId = (ev as { call_id?: string }).call_id ?? (ev as { item_id?: string }).item_id ?? `c${pendingFc.length}`
        // NOTE: a tool call is NOT a spoken token — do not set ttft here (ttft = first spoken
        // token only). The tool round-trip time is correctly INCLUDED in ttft because the first
        // spoken delta only arrives after the tool result returns on a no-preamble turn.
        // Any text accumulated in this response BEFORE the tool call is a preamble.
        if (curResponseText.trim()) { rec.emittedTextBeforeToolResult = true; rec.preambleText += curResponseText.trim() + ' ' }
        sawFunctionCallThisResponse = true
        pendingFc.push({ callId, name, args: (ev as { arguments?: string }).arguments ?? '{}' })
        return
      }
      if (type === 'response.done') {
        if (pendingFc.length > 0) {
          // Execute the tools, feed results back, ask for the next response.
          const toExec = pendingFc.splice(0)
          void (async () => {
            for (const fc of toExec) {
              rec.toolCalls.push({ name: fc.name, args: safeParseArgs(fc.args) })
              const out = await execTool({ name: fc.name, callId: fc.callId, argsJson: fc.args }, liveTools, outputs)
              send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: fc.callId, output: out } })
            }
            curResponseText = ''
            sawFunctionCallThisResponse = false
            send({ type: 'response.create' })
          })()
          return
        }
        // No pending tool → the turn is complete.
        clearTimeout(hardTimeout)
        done()
      }
      void sawFunctionCallThisResponse
    })

    // Send the user turn + request a response.
    send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: user }] } })
    send({ type: 'response.create' })
  })
}

async function execTool(fc: ParsedFunctionCall, liveTools: LiveTools, outputs: Map<string, string>): Promise<string> {
  if (fc.name === 'wait_for_user') return '{"status":"waiting"}'
  if (!LiveTools.owns(fc.name)) return JSON.stringify({ error: 'unknown_tool', name: fc.name })
  liveTools.handleFunctionCall(fc)
  for (let i = 0; i < 240; i++) { const o = outputs.get(fc.callId); if (o !== undefined) return o; await new Promise((r) => setTimeout(r, 50)) }
  return '{"status":"no_result"}'
}
