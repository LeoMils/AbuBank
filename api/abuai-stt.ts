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

import { rateLimited, circuitTripped, clientKey } from './_rateLimit'
import { guardBillable } from './_session'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), { status: 405 })
  }
  // Server-verifiable auth (when configured): an unauthenticated caller gets 401 BEFORE any provider call.
  { const denied = await guardBillable(req); if (denied) return denied }
  // A7/B rate + cost protection (defense-in-depth). Envelope: ~1 STT/turn, a few turns/min → 30/min/IP generous; abusive
  // above. Circuit: 600 STT/min/instance (Whisper is the most expensive call class here).
  if (rateLimited(`stt:${clientKey(req)}`, 30, 60_000) || circuitTripped('stt', 600, 60_000)) {
    return new Response(JSON.stringify({ ok: false, error: 'RATE_LIMITED' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
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
    // A7/B cost cap tied to the LEGITIMATE envelope (not the provider hard max): a voice turn is a few
    // seconds and well under 1 MB; 5 MB covers minutes of compressed audio yet rejects an abuse payload
    // (a cap near Whisper's 25 MB max barely constrains cost — this one does). FALSE_REJECTION_RISK: a
    // real turn is ~50-500 KB, so 5 MB has a >10× headroom over legitimate use.
    const size = (file as { size?: number }).size ?? 0
    if (size > 5_000_000) {
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
