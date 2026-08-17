/*
 * AbuAI server STT proxy — OpenAI Whisper fallback.
 *
 * When Groq STT rejects iPhone audio/mp4, the client falls back to
 * this endpoint which forwards to OpenAI Whisper (whisper-1).
 * The OPENAI_API_KEY lives server-side only.
 */

export const config = { runtime: 'edge' }

// A real OpenAI key is sk-... with length >> 20. Reject the docs placeholder and
// obvious stubs BEFORE calling OpenAI, so an unconfigured server never produces a
// raw 401 (and never leaks the provider error).
export function isPlaceholderKey(k: string | undefined): boolean {
  return !k || k.length < 20 || /^(sk-\.\.\.|sk-xxx|your_|placeholder|example|<)/i.test(k)
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), { status: 405 })
  }

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'OPENAI_API_KEY_MISSING' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (isPlaceholderKey(apiKey)) {
    // Placeholder/invalid key configured on the server — don't call OpenAI (it
    // would 401). Safe, non-leaking message for the UI.
    return new Response(JSON.stringify({ ok: false, error: 'OPENAI_API_KEY_INVALID', userMessage: 'יש בעיה בהגדרת השירות. דברי עם לאו והוא יסדר.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Forward the multipart form data directly to OpenAI
    const formData = await req.formData()

    // Rebuild FormData for OpenAI (ensure model is whisper-1)
    const openaiForm = new FormData()
    const file = formData.get('file')
    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: 'no file' }), { status: 400 })
    }
    // A7 cost-amplification cap: Whisper bills per audio minute. A voice turn is a few seconds / well
    // under 1 MB; cap at 20 MB (below Whisper's 25 MB hard limit) to reject an abuse payload before the
    // billable call. (No user auth on this PWA — bounded per-request limit; auth/rate-limit = owner decision.)
    const size = (file as { size?: number }).size ?? 0
    if (size > 20_000_000) {
      return new Response(JSON.stringify({ ok: false, error: 'AUDIO_TOO_LARGE' }), { status: 413, headers: { 'Content-Type': 'application/json' } })
    }
    openaiForm.append('file', file)
    openaiForm.append('model', 'whisper-1')
    const lang = formData.get('language')
    if (lang) openaiForm.append('language', lang as string)
    const prompt = formData.get('prompt')
    if (prompt) openaiForm.append('prompt', prompt as string)

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: openaiForm,
    })

    if (!res.ok) {
      // NEVER leak the raw provider error to the UI. Map to a safe shape.
      await res.text().catch(() => '')
      const isAuth = res.status === 401 || res.status === 403
      return new Response(JSON.stringify({
        ok: false,
        error: isAuth ? 'OPENAI_API_KEY_INVALID' : 'STT_PROVIDER_FAILED',
        userMessage: isAuth ? 'יש בעיה בהגדרת השירות. דברי עם לאו.' : 'לא הצלחתי להבין את ההקלטה. ננסה שוב?',
      }), {
        status: isAuth ? 503 : 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    return new Response(JSON.stringify({ ok: true, text: data?.text ?? '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // Never leak the raw provider/internal error to the client (matches the other
    // routes). Log server-side only; return a fixed typed code.
    console.error('[abuai-stt] failed:', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ ok: false, error: 'STT_PROVIDER_FAILED' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
