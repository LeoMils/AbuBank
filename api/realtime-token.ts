/*
 * AbuBank /api/realtime-token — server-side OpenAI Realtime session minter.
 *
 * The long-lived OPENAI_API_KEY lives server-side ONLY and never reaches the
 * client. This endpoint mints a SHORT-LIVED ephemeral session (client_secret)
 * which IS safe to use in the browser for the WebRTC SDP exchange. On any
 * key/provider problem we return a JSON error so the client falls back to the
 * free pipeline — never a raw provider error, never the long-lived key.
 */
import { REALTIME_MODEL, REALTIME_MODEL_CANDIDATES } from '../src/services/realtimeModel'

export const config = { runtime: 'edge' }

// 2026 Realtime API: the ephemeral-secret minter moved from the deprecated
// /v1/realtime/sessions (now 404) to /v1/realtime/client_secrets, the model
// family is gpt-realtime* (gpt-4o-realtime-preview is gone), the OpenAI-Beta
// header is no longer required, and the token is returned at data.value.
// REALTIME_MODEL is imported from the ONE shared source so the mint and the
// client SDP call can never drift (Defect 3).
const REALTIME_SESSION_URL = 'https://api.openai.com/v1/realtime/client_secrets'
const REQUEST_TIMEOUT_MS = 10_000

function isPlaceholderKey(k: string | undefined): boolean {
  return !k || k.length < 20 || /^(sk-\.\.\.|sk-xxx|your_|placeholder|example|<)/i.test(k)
}

function jsonError(error: string, status = 200, detail?: string): Response {
  // `detail` carries a NON-SENSITIVE diagnostic hint (upstream HTTP status /
  // reason) so the Product Truth report can say WHY Realtime is blocked — never
  // the long-lived key, never the raw provider body.
  return new Response(JSON.stringify(detail ? { ok: false, error, detail } : { ok: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

import { guardBillable } from './_session'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError('BAD_REQUEST', 405)
  // Server-verifiable auth (when configured): this endpoint MINTS a billable OpenAI Realtime session,
  // so it must NEVER do so for an unauthenticated caller. 401 before any provider call / token mint.
  { const denied = await guardBillable(req); if (denied) return denied }

  let payload: { instructions?: string; voice?: string; turnDetection?: unknown }
  try {
    payload = (await req.json()) as typeof payload
  } catch {
    return jsonError('BAD_REQUEST', 400)
  }

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}
  const apiKey = env.OPENAI_API_KEY
  if (isPlaceholderKey(apiKey)) return jsonError('OPENAI_API_KEY_MISSING')

  // §0 GPT-Live parity: try the STRONGEST available Realtime model first
  // (gpt-realtime-2.1), then fall back through the candidate list. A model that is
  // unavailable to THIS project returns a 400/404 → we try the next candidate and
  // record the provider response. Auth/quota errors stop immediately. We NEVER
  // silently skip a stronger model; the chosen model + the ladder are reported.
  const attempts: Array<{ model: string; status: number | 'network'; note?: string }> = []
  let clientSecret: string | undefined
  let chosenModel: string | undefined
  for (const model of REALTIME_MODEL_CANDIDATES) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let upstream: Response
    try {
      upstream = await fetch(REALTIME_SESSION_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model,
            instructions: typeof payload.instructions === 'string' ? payload.instructions : '',
            audio: { output: { voice: typeof payload.voice === 'string' ? payload.voice : 'shimmer' } },
          },
        }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeout)
      attempts.push({ model, status: 'network', note: (err as { name?: string } | null)?.name === 'AbortError' ? 'timeout' : 'network' })
      continue // try the next candidate on a network/timeout error
    }
    clearTimeout(timeout)

    if (upstream.ok) {
      let data: unknown
      try { data = await upstream.json() } catch { attempts.push({ model, status: upstream.status, note: 'bad_json' }); continue }
      const d = data as { value?: string; client_secret?: { value?: string } } | null
      const secret = d?.value ?? d?.client_secret?.value
      if (secret) { clientSecret = secret; chosenModel = model; attempts.push({ model, status: upstream.status, note: 'ok' }); break }
      attempts.push({ model, status: upstream.status, note: 'no_secret' }); continue
    }

    // Auth/quota are account problems — stop and report (do not keep trying).
    if (upstream.status === 401 || upstream.status === 403) return jsonError('OPENAI_API_KEY_INVALID', 200, `model=${model}`)
    if (upstream.status === 429) return jsonError('REALTIME_QUOTA', 200, `model=${model}`)
    // 400/404 = this model is not available to the project → record + try the next.
    let note = `http_${upstream.status}`
    if (upstream.status >= 400 && upstream.status < 500) {
      try { const b = await upstream.text(); const m = (JSON.parse(b) as { error?: { message?: string } })?.error?.message; if (m) note += `: ${m.slice(0, 120)}` } catch { /* */ }
    }
    attempts.push({ model, status: upstream.status, note })
  }

  if (!clientSecret || !chosenModel) {
    return jsonError('REALTIME_PROVIDER_FAILED', 200, `no model minted: ${attempts.map((a) => `${a.model}=${a.status}`).join(', ')}`)
  }

  // Return ONLY the ephemeral secret + the CHOSEN model (client asserts SDP uses it)
  // + the selection ladder (which stronger models were unavailable, if any).
  return new Response(JSON.stringify({ ok: true, client_secret: clientSecret, model: chosenModel, modelSelection: { chosen: chosenModel, tried: attempts } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
