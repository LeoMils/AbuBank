/*
 * AbuBank /api/abuai-tts — server-side OpenAI Text-to-Speech proxy.
 *
 * The OpenAI key lives server-side ONLY (OPENAI_API_KEY) — it must never reach
 * the client bundle. The client posts the OpenAI audio/speech body; we forward
 * it with the server key and stream the audio bytes back. On any key/provider
 * problem we return a small JSON error so the client falls back to a free TTS
 * tier (Gemini / Web Speech) — never a raw provider error, never the key.
 */
export const config = { runtime: 'edge' }

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech'
const REQUEST_TIMEOUT_MS = 12_000

// Reject the docs placeholder / obvious stubs before any network call.
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

  let body: Record<string, unknown>
  try {
    const parsed = (await req.json()) as { body?: Record<string, unknown> }
    body = parsed.body && typeof parsed.body === 'object' ? parsed.body : {}
  } catch {
    return jsonError('BAD_REQUEST', 400)
  }
  if (!body.input || typeof body.input !== 'string') return jsonError('BAD_REQUEST', 400)
  // A7 cost-amplification cap: OpenAI TTS bills per input character. A single reply is a few hundred
  // chars; cap well above that but far below an abuse payload. (No user auth on this PWA — a bounded
  // per-request limit is the machine-closable mitigation; a rate-limit/auth policy is an owner decision.)
  if (body.input.length > 2000) return jsonError('BAD_REQUEST', 400)

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}
  const apiKey = env.OPENAI_API_KEY
  if (isPlaceholderKey(apiKey)) return jsonError('OPENAI_API_KEY_MISSING')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let upstream: Response
  try {
    upstream = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      // Force a safe response_format; pass through model/voice/instructions/speed/input.
      body: JSON.stringify({ response_format: 'mp3', ...body }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    return jsonError((err as { name?: string } | null)?.name === 'AbortError' ? 'TTS_TIMEOUT' : 'TTS_PROVIDER_FAILED')
  }
  clearTimeout(timeout)

  if (!upstream.ok || !upstream.body) {
    // 401/403 → key invalid; 429/402 → quota (client backs off); else provider
    // failure. Never leak the upstream body.
    const isAuth = upstream.status === 401 || upstream.status === 403
    const isQuota = upstream.status === 429 || upstream.status === 402
    return jsonError(isAuth ? 'OPENAI_API_KEY_INVALID' : isQuota ? 'TTS_QUOTA' : 'TTS_PROVIDER_FAILED')
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
