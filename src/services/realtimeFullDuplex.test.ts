/*
 * FULL-DUPLEX Realtime config contract — ChatGPT Advanced-Voice behavior.
 * The live audio loop is device-only, but the SESSION CONFIG that produces
 * hands-free turn-taking + barge-in is pure and locked here.
 */
import { describe, it, expect } from 'vitest'
import { buildRealtimeSessionUpdate } from './realtimeVoice'

type TD = { type?: string; create_response?: boolean; interrupt_response?: boolean; eagerness?: string } | null
function td(cfg: Record<string, unknown>): TD {
  return ((cfg.session as any)?.audio?.input?.turn_detection ?? null) as TD
}

describe('REALTIME full-duplex session config', () => {
  const base = { instructions: 'שלום', voice: 'shimmer' }

  it('default (quiet) → semantic_vad, hands-free, BARGE-IN enabled', () => {
    const cfg = buildRealtimeSessionUpdate({ ...base, pushToTalk: false, listenMode: false })
    expect(cfg.type).toBe('session.update')
    const t = td(cfg)
    expect(t?.type).toBe('semantic_vad')      // natural turn-taking (like ChatGPT live)
    expect(t?.create_response).toBe(true)      // auto-respond when she finishes
    expect(t?.interrupt_response).toBe(true)   // she can cut the AI off mid-sentence
  })

  it('input transcription is enabled (user words are captured)', () => {
    const cfg = buildRealtimeSessionUpdate({ ...base, pushToTalk: false, listenMode: false })
    expect(((cfg.session as any).audio.input.transcription.model)).toMatch(/transcribe|whisper/)
  })

  it('spoken voice is carried through', () => {
    const cfg = buildRealtimeSessionUpdate({ ...base, pushToTalk: false, listenMode: false, voice: 'marin' })
    expect(((cfg.session as any).audio.output.voice)).toBe('marin')
  })

  it('noisy (push-to-talk) → no auto VAD (manual commit)', () => {
    const cfg = buildRealtimeSessionUpdate({ ...base, pushToTalk: true, listenMode: false })
    expect(td(cfg)).toBeNull()
  })

  it('listen mode → transcribe only, never auto-responds', () => {
    const cfg = buildRealtimeSessionUpdate({ ...base, pushToTalk: false, listenMode: true })
    expect(td(cfg)?.create_response).toBe(false)
    expect(td(cfg)?.interrupt_response).toBe(true)
  })
})
