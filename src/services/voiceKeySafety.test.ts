/*
 * Voice readiness WITHOUT a device: the safety contracts that decide whether the
 * realtime/STT path even attempts the network, so a missing/placeholder/invalid
 * key produces a quiet fallback (no noisy 401 retry storm) instead of a raw error.
 *
 * Real mic capture / realtime audio / TTS playback remain LEO-ONLY device gates —
 * this only validates the code-path classification that runs before any audio.
 */
import { describe, it, expect } from 'vitest'
import { isPlaceholderKey } from './realtimeVoice'

describe('realtime/STT key classification (account-access gate)', () => {
  it('rejects missing / empty keys (→ quiet fallback, no network)', () => {
    expect(isPlaceholderKey(undefined)).toBe(true)
    expect(isPlaceholderKey('')).toBe(true)
  })

  it('rejects the docs placeholder and obvious stubs', () => {
    expect(isPlaceholderKey('sk-...')).toBe(true)
    expect(isPlaceholderKey('sk-xxx')).toBe(true)
    expect(isPlaceholderKey('your_key_here')).toBe(true)
    expect(isPlaceholderKey('placeholder')).toBe(true)
    expect(isPlaceholderKey('<your-key>')).toBe(true)
  })

  it('rejects too-short keys (cannot be a real OpenAI key)', () => {
    expect(isPlaceholderKey('sk-short')).toBe(true)
  })

  it('accepts a real-length, non-placeholder key (does not over-reject real usage)', () => {
    const realLike = 'sk-proj-' + 'A1b2C3d4'.repeat(20) // 168 chars, no stub prefix
    expect(isPlaceholderKey(realLike)).toBe(false)
  })
})

describe('realtime session declares bounded retries (no infinite loop)', () => {
  it('source bounds realtime retries to a small constant', async () => {
    const src = await import('fs').then((fs) => fs.readFileSync(new URL('./realtimeVoice.ts', import.meta.url), 'utf-8'))
    // A bounded maxRetries (single digit) must exist — never an unbounded loop.
    const m = src.match(/maxRetries\s*=\s*(\d+)/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(1)
    expect(Number(m![1])).toBeLessThanOrEqual(3)
    // The realtime session is now minted SERVER-SIDE (/api/realtime-token); the
    // client never reads the long-lived OpenAI key. The server validates the key.
    expect(src).toMatch(/\/api\/realtime-token/)
    expect(src).not.toMatch(/import\.meta\.env\.VITE_OPENAI_API_KEY/)
  })
})
