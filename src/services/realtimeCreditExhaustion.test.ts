import { describe, it, expect, vi } from 'vitest'
import { RealtimeVoiceSession } from './realtimeVoice'

/*
 * REGRESSION — credit-exhaustion must fail LOUDLY, not silently (overnight run, item 2).
 * ────────────────────────────────────────────────────────────────────────────
 * FIRST DIVERGENCE (proven against the real account this night): the Realtime
 * ephemeral MINT returns 200 even at zero credit — the session opens — and the
 * 429 only arrives LATER, as a session event:
 *     { type: 'error', error: { code: 'credit_balance_exhausted',
 *                               message: 'You have no credits remaining...' } }
 * The old error handler passed `error.message` (raw ENGLISH) straight to onError
 * (Martita would hear/see a technical English string — violates plain-Hebrew) and
 * gave the operator NO distinct signal — so a session that spent ~$0 looked like a
 * mysterious "transport failure" instead of an empty wallet. Three sessions burned
 * on that ambiguity.
 *
 * Contract now: on insufficient_quota / credit_balance_exhausted the session must
 *   1. surface a PLAIN-HEBREW message to the user (never the raw English), and
 *   2. fall back to the pipeline (onFatalError) — no retry loop (credit will not
 *      return mid-session), so it is NOT treated like session_expired.
 * A non-credit error must still take the ordinary path (no false fallback).
 */
type ErrHandler = { handleEvent: (e: unknown) => void }

function makeCb(over: Record<string, unknown> = {}) {
  return {
    onStateChange: vi.fn(),
    onUserTranscript: vi.fn(),
    onAssistantTranscript: vi.fn(),
    onAssistantDelta: vi.fn(),
    onError: vi.fn(),
    ...over,
  }
}

const HEBREW = /[֐-׿]/

describe('Realtime credit exhaustion — loud, not silent', () => {
  for (const code of ['credit_balance_exhausted', 'insufficient_quota']) {
    it(`surfaces plain Hebrew (not raw English) and falls back on ${code}`, () => {
      const cb = makeCb()
      const onFatal = vi.fn()
      const s = new RealtimeVoiceSession(cb as never, 'instr', onFatal) as unknown as ErrHandler
      s.handleEvent({ type: 'error', error: { code, message: 'You have no credits remaining. Add credits to continue using the API.' } })

      expect(cb.onError).toHaveBeenCalledTimes(1)
      const shown = cb.onError.mock.calls[0]![0] as string
      expect(shown).toMatch(HEBREW)                       // plain Hebrew, senior-appropriate
      expect(shown).not.toMatch(/credits|API|remaining/i) // never the raw English
      expect(onFatal).toHaveBeenCalledTimes(1)            // fell back to the pipeline
    })
  }

  it('a NON-credit server error still takes the ordinary path (no false fallback)', () => {
    const cb = makeCb()
    const onFatal = vi.fn()
    const s = new RealtimeVoiceSession(cb as never, 'instr', onFatal) as unknown as ErrHandler
    s.handleEvent({ type: 'error', error: { code: 'server_error', message: 'transient' } })
    expect(onFatal).not.toHaveBeenCalled()
  })
})
