/*
 * AbuBank /api/realtime-token — server-side OpenAI Realtime session minter.
 *
 * The long-lived OPENAI_API_KEY lives server-side ONLY and never reaches the
 * client. This endpoint mints a SHORT-LIVED ephemeral session (client_secret)
 * which IS safe to use in the browser for the WebRTC SDP exchange. On any
 * key/provider problem we return a JSON error so the client falls back to the
 * free pipeline — never a raw provider error, never the long-lived key.
 */
export const config = { runtime: 'edge' }

// 2026 Realtime API: the ephemeral-secret minter moved from the deprecated
// /v1/realtime/sessions (now 404) to /v1/realtime/client_secrets, the model
// family is gpt-realtime* (gpt-4o-realtime-preview is gone), the OpenAI-Beta
// header is no longer required, and the token is returned at data.value.
const REALTIME_SESSION_URL = 'https://api.openai.com/v1/realtime/client_secrets'
const REALTIME_MODEL = 'gpt-realtime'
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError('BAD_REQUEST', 405)

  let payload: { instructions?: string; voice?: string; turnDetection?: unknown }
  try {
    payload = (await req.json()) as typeof payload
  } catch {
    return jsonError('BAD_REQUEST', 400)
  }

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}
  const apiKey = env.OPENAI_API_KEY
  if (isPlaceholderKey(apiKey)) return jsonError('OPENAI_API_KEY_MISSING')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let upstream: Response
  try {
    upstream = await fetch(REALTIME_SESSION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      // 2026 shape: config is wrapped in a `session` object with an explicit
      // type. Fine-grained turn detection / transcription are configured
      // client-side via session.update over the data channel after connect.
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions: typeof payload.instructions === 'string' ? payload.instructions : '',
          audio: { output: { voice: typeof payload.voice === 'string' ? payload.voice : 'shimmer' } },
        },
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    return jsonError((err as { name?: string } | null)?.name === 'AbortError' ? 'REALTIME_TIMEOUT' : 'REALTIME_PROVIDER_FAILED')
  }
  clearTimeout(timeout)

  if (!upstream.ok) {
    const isAuth = upstream.status === 401 || upstream.status === 403
    const isQuota = upstream.status === 429
    // A 400/404 here means the request shape/model is outdated (the Realtime
    // API evolved) rather than an account problem — the status tells Leo which
    // fix path applies. For a 4xx we include a SHORT sanitized snippet of the
    // provider's validation message (never a secret) to pinpoint the shape bug.
    let hint = `upstream_http_${upstream.status}`
    if (upstream.status >= 400 && upstream.status < 500) {
      try {
        const body = await upstream.text()
        const msg = (JSON.parse(body) as { error?: { message?: string } })?.error?.message
        if (msg) hint += `: ${msg.slice(0, 160)}`
      } catch { /* non-JSON body — status alone */ }
    }
    return jsonError(
      isAuth ? 'OPENAI_API_KEY_INVALID' : isQuota ? 'REALTIME_QUOTA' : 'REALTIME_PROVIDER_FAILED',
      200,
      hint,
    )
  }

  let data: unknown
  try { data = await upstream.json() } catch { return jsonError('REALTIME_PROVIDER_FAILED') }
  // 2026: token is at top-level `value`. Keep the legacy nested read as a
  // fallback so an older provider response still works.
  const d = data as { value?: string; client_secret?: { value?: string } } | null
  const clientSecret = d?.value ?? d?.client_secret?.value
  if (!clientSecret) return jsonError('REALTIME_PROVIDER_FAILED', 200, 'no_secret_in_response')

  // Return ONLY the ephemeral secret (safe for browser use) — never the long-lived key.
  return new Response(JSON.stringify({ ok: true, client_secret: clientSecret }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
