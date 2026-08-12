/*
 * liveTrace.test.ts — the flight recorder + turn-health detectors (CODE).
 * Deterministic (injected clock). Proves the trace captures my/her speech + tool
 * calls, the SILENT-TURN detector (C.3), and the TRUNCATION-evidence detector (C.2).
 */
import { describe, it, expect } from 'vitest'
import { FlightRecorder } from './liveTrace'

const rec = () => { let t = 0; return new FlightRecorder(() => (t += 100)) }

describe('flight recorder — connection lifecycle (a failed connect still produces a trace)', () => {
  it('records the attempt + failure with a reason, and toText leads with the CONNECTION section', () => {
    const r = rec()
    r.onConnectAttempt()
    r.onFailure('OPENAI_API_KEY_MISSING', 'החיבור לשרת לא מוגדר')
    expect(r.hasFailure()).toBe(true)
    const txt = r.toText()
    // Even with ZERO conversation turns, the trace says WHY, at the top.
    expect(txt).toContain('## CONNECTION')
    expect(txt).toContain('מנסה להתחבר')
    expect(txt).toContain('code=OPENAI_API_KEY_MISSING')
    expect(txt).toContain('החיבור לשרת לא מוגדר')
    // The export carries the machine-readable connection events too.
    const exp = r.toExport()
    expect(exp.connection.map((c) => c.kind)).toEqual(['attempt', 'failed'])
    expect(exp.connection[1]!.code).toBe('OPENAI_API_KEY_MISSING')
  })
  it('records a successful connect (attempt → ok) with the model', () => {
    const r = rec()
    r.onConnectAttempt()
    r.onConnectOk('gpt-realtime-2.1')
    expect(r.hasFailure()).toBe(false)
    expect(r.toText()).toContain('מחוברת (gpt-realtime-2.1)')
  })

  it('records the session.update payload SIZE on the connect line (so an over-limit field shows as a number in the trace)', () => {
    const r = rec()
    r.onConnectAttempt()
    r.onConnectOk('gpt-realtime-2.1', { chars: 19315, bytes: 22750 })
    const exp = r.toExport()
    const ok = exp.connection.find((c) => c.kind === 'ok')!
    expect(ok.payloadChars).toBe(19315)
    expect(ok.payloadBytes).toBe(22750)
    expect(r.toText()).toContain('session.update 19315 תווים / 22750 bytes')
  })
})

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

describe('silent-turn detector exempts wait_for_user (finding #4)', () => {
  it('does NOT flag a turn that ends after ONLY wait_for_user (contractually silent)', () => {
    const r = rec()
    r.onToolCall('wait_for_user', {})
    r.onTurnEnd()
    expect(r.silentTurnCount()).toBe(0)
  })
  it('STILL flags a grounded tool (phone_call) that ends with no spoken continuation', () => {
    const r = rec()
    r.onToolCall('phone_call', { recipient: 'לאו' })
    r.onTurnEnd()
    expect(r.silentTurnCount()).toBe(1)
    expect(r.toExport().silentTurns[0]!.toolsInTurn).toEqual(['phone_call'])
  })
  it('a grounded tool FOLLOWED by speech in the same turn is not silent', () => {
    const r = rec()
    r.onToolCall('phone_call', { recipient: 'לאו' })
    r.onAudioDelta(); r.onAbuText('הכרטיס מוכן, תלחצי כדי להתקשר')
    r.onTurnEnd()
    expect(r.silentTurnCount()).toBe(0)
  })
})

describe('confirmation source on confirm_calendar_event (trace provenance)', () => {
  const confirmEntry = (r: ReturnType<typeof rec>) =>
    r.toExport().entries.find((e) => e.tool === 'confirm_calendar_event')!

  it('voice: a spoken user turn after the read-back → confirmed by voice', () => {
    const r = rec()
    r.onAudioDelta(); r.onAbuText('לקבוע תור לרופא מחר בעשר?')   // Abu reads the draft back
    r.onUserText('כן תשמרי')                                       // Martita confirms by voice
    r.onToolCall('confirm_calendar_event', { forRevision: 1 })
    expect(confirmEntry(r).confirmationSource).toBe('voice')
    expect(r.toText()).toContain('confirmed by: voice')
  })

  it('typed: the card Confirm tap (a typed turn) → confirmed by typed', () => {
    const r = rec()
    r.onAbuText('הכרטיס מוכן — לאשר ולשמור?')
    r.onUserTypedText('כן, תשמרי')
    r.onToolCall('confirm_calendar_event', {})
    expect(confirmEntry(r).confirmationSource).toBe('typed')
  })

  it('inferred: the model confirms with NO user input since Abu spoke → inferred', () => {
    const r = rec()
    r.onAudioDelta(); r.onAbuText('קבעתי לך')   // Abu speaks, then the model confirms on its own
    r.onToolCall('confirm_calendar_event', {})
    expect(confirmEntry(r).confirmationSource).toBe('inferred')
  })

  it('only confirm_calendar_event carries a source — other tools do not', () => {
    const r = rec()
    r.onUserText('כן')
    r.onToolCall('read_calendar', {})
    expect(r.toExport().entries.find((e) => e.tool === 'read_calendar')!.confirmationSource).toBeUndefined()
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
