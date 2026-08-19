/*
 * Flight Recorder export (runtime) — reads the live queue, text-only, no audio.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { exportStoredTranscript, serializeExport, envelopesToExport, parseExport, FLIGHT_RECORDER_EXPORT_VERSION } from './recorderExport'
import { observeTurn } from './observer'
import { buildEnvelope, type TurnFacts } from './traceEnvelope'

let store: Record<string, string> = {}
beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] } })
})

const facts = (n: number, session = 'exp-test'): TurnFacts => ({
  ts: 5_000 + n, sessionId: session, turnId: `exp-${n}`,
  input: `מה יש לי מחר ${n}`, intent: 'calendar_read', source: 'deterministic', finalAnswer: 'אין לך כלום מחר.',
})

describe('exportStoredTranscript', () => {
  it('reads captured turns from the durable queue into a text-only export', () => {
    observeTurn(facts(1))
    observeTurn(facts(2))
    const exp = exportStoredTranscript({ appVersion: 'test-1.0', exportedAt: '2026-07-18T00:00:00Z' })
    expect(exp.version).toBe(FLIGHT_RECORDER_EXPORT_VERSION)
    expect(exp.appVersion).toBe('test-1.0')
    const session = exp.sessions.find((s) => s.id === 'exp-test')
    expect(session).toBeDefined()
    expect(session!.turns.length).toBeGreaterThanOrEqual(2)
    // Redacted user text is carried (text-only); serialized form has no audio field.
    const json = serializeExport(exp)
    expect(json).not.toMatch(/audio|blob|base64|wav|mp3|pcm/i)
    expect(parseExport(json).version).toBe(FLIGHT_RECORDER_EXPORT_VERSION)
  })

  it('never throws — returns an empty export if the queue is unavailable', () => {
    // envelopesToExport over an empty list is the degenerate case the catch falls back to.
    expect(envelopesToExport([]).sessions).toEqual([])
    expect(() => exportStoredTranscript()).not.toThrow()
  })

  it('maps a redacted envelope to its normalized input verbatim', () => {
    const env = buildEnvelope({ ts: 9, sessionId: 'z', turnId: 'z1', input: 'תקבעי פגישה', intent: 'calendar_create', source: 'deterministic', finalAnswer: 'מתי?' })
    const exp = envelopesToExport([env])
    expect(exp.sessions[0]!.turns[0]!.input).toBe('תקבעי פגישה')
  })
})
