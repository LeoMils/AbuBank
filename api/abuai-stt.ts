/*
 * AbuAI server STT proxy — OpenAI Whisper fallback.
 *
 * When Groq STT rejects iPhone audio/mp4, the client falls back to
 * this endpoint which forwards to OpenAI Whisper (whisper-1).
 * The OPENAI_API_KEY lives server-side only.
 */

export const config = { runtime: 'edge' }

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

  try {
    // Forward the multipart form data directly to OpenAI
    const formData = await req.formData()

    // Rebuild FormData for OpenAI (ensure model is whisper-1)
    const openaiForm = new FormData()
    const file = formData.get('file')
    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: 'no file' }), { status: 400 })
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
      const errText = await res.text().catch(() => '')
      return new Response(JSON.stringify({ ok: false, error: `OpenAI STT ${res.status}`, detail: errText.slice(0, 200) }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    return new Response(JSON.stringify({ ok: true, text: data?.text ?? '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
