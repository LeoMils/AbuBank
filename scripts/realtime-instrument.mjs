/*
 * scripts/realtime-instrument.mjs — drive the REAL gpt-realtime model over the WebSocket
 * transport in TEXT mode (no mic, no device). This is the Layer-3 instrument: it exercises the
 * actual model Martita hears, not a gpt-4o proxy. Node 22+ native WebSocket. Reads the server key
 * from .env (never printed). Paces calls and backs off on 429.
 *
 * Exports a small toolkit; individual probes import it. Run a probe directly, e.g.:
 *   node scripts/probes/two-response.mjs
 */
import fs from 'node:fs'

export function loadKey() {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/)
    if (m) return m[1].replace(/^["']|["']$/g, '')
  }
  throw new Error('no OPENAI_API_KEY in .env')
}

const MODEL = process.env.REALTIME_MODEL || 'gpt-realtime'
const WS_URL = `wss://api.openai.com/v1/realtime?model=${MODEL}`

/** Open ONE realtime session. Returns a controller with send/close and an event stream.
 *  `sessionUpdate` is merged into the session.update sent on open. */
export function openSession(key, sessionUpdate = {}) {
  const ws = new WebSocket(WS_URL, { headers: { Authorization: `Bearer ${key}` } })
  const listeners = new Set()
  const state = { open: false, credit: true, lastError: null }
  ws.onopen = () => {
    state.open = true
    ws.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', ...sessionUpdate } }))
  }
  ws.onmessage = (e) => {
    let msg; try { msg = JSON.parse(e.data) } catch { return }
    if (msg.type === 'error') {
      state.lastError = msg.error
      if (msg.error?.code === 'credit_balance_exhausted' || msg.error?.code === 'insufficient_quota') state.credit = false
    }
    for (const l of listeners) l(msg)
  }
  return {
    ws, state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    send(obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)) },
    close() { try { ws.close() } catch {} },
    waitOpen(ms = 8000) {
      return new Promise((res, rej) => {
        if (state.open) return res()
        const t = setTimeout(() => rej(new Error('ws open timeout')), ms)
        ws.addEventListener('open', () => { clearTimeout(t); res() })
        ws.addEventListener('error', (ev) => { clearTimeout(t); rej(new Error('ws error ' + (ev.message || ''))) })
      })
    },
  }
}

/** Add a user text message to the conversation. */
export function userText(session, text) {
  session.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })
}

/** Provide a function_call result back to the model. */
export function toolResult(session, callId, output) {
  session.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output } })
}

/** Create one response and collect it to completion. Returns { text, functionCalls[], ms, usage, err }.
 *  `responseOverride` (e.g. { output_modalities:['text'] }) is passed through to response.create. */
export function runResponse(session, responseOverride = {}, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    let text = ''
    let firstTokenMs = null
    const functionCalls = []
    const off = session.on((msg) => {
      switch (msg.type) {
        case 'response.output_text.delta':
        case 'response.text.delta':
          if (firstTokenMs === null) firstTokenMs = Date.now() - t0
          text += msg.delta || ''
          break
        case 'response.output_audio_transcript.delta':
        case 'response.audio_transcript.delta':
          if (firstTokenMs === null) firstTokenMs = Date.now() - t0
          text += msg.delta || ''
          break
        case 'response.function_call_arguments.done':
          functionCalls.push({ name: msg.name, callId: msg.call_id, args: msg.arguments })
          break
        case 'response.done': {
          clearTimeout(timer); off()
          const status = msg.response?.status
          const err = status === 'failed' ? (msg.response?.status_details?.error?.code || 'failed') : null
          resolve({ text: text.trim(), functionCalls, ms: Date.now() - t0, firstTokenMs, usage: msg.response?.usage || null, err })
          break
        }
        // NOTE: session-level 'error' events (e.g. an unsupported session.update field) are NOT a
        // response failure — a response.create still completes with response.done. We therefore do
        // NOT resolve on 'error' here; only response.done (or the timeout) ends a runResponse.
      }
    })
    const timer = setTimeout(() => { off(); resolve({ text: text.trim(), functionCalls, ms: Date.now() - t0, firstTokenMs, usage: null, err: 'timeout' }) }, timeoutMs)
    session.send({ type: 'response.create', response: responseOverride })
  })
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Minimal session for the TEXT instrument: instructions + tools only. The full shipping config
 *  carries WebRTC/audio-input fields (transcription, noise_reduction, server_vad) the WS text
 *  transport rejects ("Unsupported option for this model") — those belong to the device path, not
 *  the instrument. This keeps the REAL instructions + tools (the thing being tested) and drops only
 *  the audio-plumbing the text harness does not use. */
export function minimalSession(fullSession) {
  return {
    instructions: fullSession.instructions,
    tools: fullSession.tools,
    tool_choice: fullSession.tool_choice || 'auto',
  }
}
