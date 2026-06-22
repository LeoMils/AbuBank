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

const REALTIME_SESSION_URL = 'https://api.openai.com/v1/realtime/sessions'
const REALTIME_MODEL = 'gpt-4o-realtime-preview'
const REQUEST_TIMEOUT_MS = 10_000

function isPlaceholderKey(k: string | undefined): boolean {
  return !k || k.length < 20 || /^(sk-\.\.\.|sk-xxx|your_|placeholder|example|<)/i.test(k)
}

function jsonError(error: string, status = 200): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
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
        'OpenAI-Beta': 'realtime=v1', // required — without it the endpoint 404s
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: typeof payload.voice === 'string' ? payload.voice : 'shimmer',
        instructions: typeof payload.instructions === 'string' ? payload.instructions : '',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: payload.turnDetection ?? null,
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
    return jsonError(isAuth ? 'OPENAI_API_KEY_INVALID' : isQuota ? 'REALTIME_QUOTA' : 'REALTIME_PROVIDER_FAILED')
  }

  let data: unknown
  try { data = await upstream.json() } catch { return jsonError('REALTIME_PROVIDER_FAILED') }
  const clientSecret = (data as { client_secret?: { value?: string } } | null)?.client_secret?.value
  if (!clientSecret) return jsonError('REALTIME_PROVIDER_FAILED')

  // Return ONLY the ephemeral secret (safe for browser use) — never the long-lived key.
  return new Response(JSON.stringify({ ok: true, client_secret: clientSecret }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
