/*
 * liveTrace.test.ts — the flight recorder + turn-health detectors (CODE).
 * Deterministic (injected clock). Proves the trace captures my/her speech + tool
 * calls, the SILENT-TURN detector (C.3), and the TRUNCATION-evidence detector (C.2).
 */
import { describe, it, expect } from 'vitest'
import { FlightRecorder } from './liveTrace'

const rec = () => { let t = 0; return new FlightRecorder(() => (t += 100)) }

describe('flight recorder — full trace', () => {
  it('captures my speech, her speech, and every tool call with args + result', () => {
    const r = rec()
    r.onUserText('מה יש לי מחר?')
    r.onToolCall('read_calendar', { date: '2026-08-11' })
    r.onToolResult('read_calendar', { count: 1 })
    r.onAudioDelta()
    r.onAbuText('יש לך תור לרופא בעשר')
    r.onTurnEnd()
    const txt = r.toText()
    expect(txt).toContain('מרטיטה: מה יש לי מחר?')
    expect(txt).toContain('אבו: יש לך תור לרופא בעשר')
    expect(txt).toContain('read_calendar')
    const exp = r.toExport()
    expect(exp.entries.map((e) => e.kind)).toEqual(['user_speech', 'tool_call', 'tool_result', 'abu_speech'])
  })
})

describe('silent-turn detector (C.3)', () => {
  it('flags a turn that ends after a tool call with NO Abu speech', () => {
    const r = rec()
    r.onUserText('תשלחי הודעה למור')
    r.onToolCall('whatsapp_draft', { recipient: 'מור' })
    r.onToolResult('whatsapp_draft', { status: 'READY_TO_SEND' })
    r.onTurnEnd() // no onAbuText / onAudioDelta between the tool and the end
    expect(r.silentTurnCount()).toBe(1)
    expect(r.toExport().silentTurns[0]!.toolsInTurn).toEqual(['whatsapp_draft'])
  })
  it('does NOT flag when Abu speaks the grounded result in the same turn', () => {
    const r = rec()
    r.onToolCall('read_calendar', {})
    r.onAudioDelta()
    r.onAbuText('היומן ריק מחר')
    r.onTurnEnd()
    expect(r.silentTurnCount()).toBe(0)
  })
  it('does NOT flag a turn with no tool call at all (plain chit-chat)', () => {
    const r = rec()
    r.onUserText('בוקר טוב')
    r.onAbuText('בוקר אור')
    r.onTurnEnd()
    expect(r.silentTurnCount()).toBe(0)
  })
})

describe('truncation-evidence detector (C.2)', () => {
  it('flags the mic opening WHILE Abu is speaking (VAD interrupt / self-hearing)', () => {
    const r = rec()
    r.onAudioDelta()          // Abu started speaking
    r.onUserSpeechStart()     // mic opened mid-speech → likely truncation
    expect(r.truncationCount()).toBe(1)
    expect(r.toText()).toContain('TRUNCATION')
  })
  it('does NOT flag speech starting while Abu is NOT speaking (normal listening)', () => {
    const r = rec()
    r.onUserSpeechStart()
    expect(r.truncationCount()).toBe(0)
  })
  it('resets speaking state at end of turn (no false truncation across turns)', () => {
    const r = rec()
    r.onAudioDelta()
    r.onAbuText('שלום')
    r.onTurnEnd()             // speaking resets
    r.onUserSpeechStart()     // new turn, Abu not speaking
    expect(r.truncationCount()).toBe(0)
  })
})
