/*
 * HONEST-FAILURE regression (P0 remediation): removing the Gemini/Groq client fallbacks must NOT
 * create silent wrong answers. When the ONLY model provider (the server OpenAI proxy) fails, the
 * composer degrades to the DETERMINISTIC, fact-preserving local composer — never a fabricated
 * model answer. This proves the "fail honestly" property the removal must preserve.
 */
import { describe, it, expect, vi } from 'vitest'

// The server proxy always fails here — there is NO client model fallback anymore.
vi.mock('./serverChatProvider', () => ({
  sendServerChat: vi.fn(async () => ({ ok: false, errorCode: 'OPENAI_API_KEY_MISSING' })),
}))

import { composeWhatsAppMessageDetailed, understandWhatsAppCommand, type WhatsAppComposeCommand } from './whatsappCompose'

function cmd(intent: string): WhatsAppComposeCommand {
  const base = understandWhatsAppCommand('לאדר ' + intent)
  return { ...base, style: 'normal', plan: { ...base.plan, requestedTone: 'normal' } }
}

describe('whatsapp compose — honest fallback with the server proxy down (no client model provider)', () => {
  it('degrades to the deterministic local composer (path=local-fallback), never a fabricated model answer', async () => {
    const r = await composeWhatsAppMessageDetailed(cmd('שאני מאחר בעשר דקות'))
    expect(r.path).toBe('local-fallback')
    expect(r.message.trim().length).toBeGreaterThan(0)
    // The local composer is fact-preserving — the "עשר דקות"/numeric fact must survive.
    expect(r.verdict.ok).toBe(true)
  })

  it('the local fallback preserves a numeric fact (no silent fact loss)', async () => {
    const r = await composeWhatsAppMessageDetailed(cmd('שיש פגישה ב 4'))
    expect(r.path).toBe('local-fallback')
    expect(r.message).toContain('4')
  })
})
