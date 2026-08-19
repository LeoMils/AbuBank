/*
 * toolSequencingOracle.test.ts — the AbuAI tool-backed interaction contract, graded from RAW events.
 * Proves the clean contract passes and every device-reported violation is caught — including on the
 * REAL FlightRecorder output (not a bespoke fixture), so the oracle runs over an actual session trace.
 */
import { describe, it, expect } from 'vitest'
import { evaluateToolSequencing, type SeqEvent } from './toolSequencingOracle'
import { FlightRecorder } from './liveTrace'

let n = 0
const ev = (kind: SeqEvent['kind'], extra: Partial<SeqEvent> = {}): SeqEvent => ({ seq: ++n, kind, ...extra })
const reset = () => { n = 0 }

describe('tool-backed contract: tool_call → silence → tool_result → final answer', () => {
  it('a CLEAN tool turn passes (no speech between call and result; grounded answer after)', () => {
    reset()
    const entries = [
      ev('user_speech', { text: 'מה מזג האוויר היום?' }),
      ev('tool_call', { tool: 'get_current_info' }),
      ev('tool_result', { tool: 'get_current_info' }),
      ev('abu_speech', { text: 'עכשיו בכפר סבא עשרים וחמש מעלות, מעונן חלקית.' }),
    ]
    const r = evaluateToolSequencing({ entries })
    expect(r.pass).toBe(true)
    expect(r.violations).toEqual([])
    expect(r.toolTurns).toBe(1)
  })

  it('SPOKEN_PREAMBLE — "רגע אני בודקת" before the lookup is a FAIL (the 9/9 device defect)', () => {
    reset()
    const entries = [
      ev('user_speech', { text: 'מה השער של הדולר?' }),
      ev('abu_speech', { text: 'רגע, אני בודקת לך.' }),      // filler before the tool call
      ev('tool_call', { tool: 'get_current_info' }),
      ev('tool_result', { tool: 'get_current_info' }),
      ev('abu_speech', { text: 'הדולר עומד על שלושה שקלים.' }),
    ]
    const r = evaluateToolSequencing({ entries })
    expect(r.pass).toBe(false)
    expect(r.violations.some((v) => v.type === 'SPOKEN_PREAMBLE')).toBe(true)
  })

  it('SPOKEN_PREAMBLE — a nonzero recorder preamble gap is a FAIL even with no filler text', () => {
    reset()
    const entries = [ev('user_speech', { text: 'x' }), ev('tool_call', { tool: 't' }), ev('tool_result', { tool: 't' }), ev('abu_speech', { text: 'answer here now' })]
    const r = evaluateToolSequencing({ entries, preambleGaps: [520] })
    expect(r.violations.some((v) => v.type === 'SPOKEN_PREAMBLE')).toBe(true)
  })

  it('INTERLEAVE_SEMANTIC — assistant speech while the tool_call is still open is a FAIL', () => {
    reset()
    const entries = [
      ev('user_speech', { text: 'x' }),
      ev('tool_call', { tool: 't' }),
      ev('abu_speech', { text: 'בינתיים אני מספרת לך משהו' }), // spoke before the result
      ev('tool_result', { tool: 't' }),
      ev('abu_speech', { text: 'התשובה היא כך וכך' }),
    ]
    const r = evaluateToolSequencing({ entries })
    expect(r.violations.some((v) => v.type === 'INTERLEAVE_SEMANTIC')).toBe(true)
  })

  it('PENDING_AFTER_RESULT — claiming "still checking" after the result returned is a FAIL', () => {
    reset()
    const entries = [
      ev('user_speech', { text: 'x' }),
      ev('tool_call', { tool: 't' }),
      ev('tool_result', { tool: 't' }),
      ev('abu_speech', { text: 'שנייה, אני עוד בודקת את זה בשבילך' }),
    ]
    const r = evaluateToolSequencing({ entries })
    expect(r.violations.some((v) => v.type === 'PENDING_AFTER_RESULT')).toBe(true)
  })

  it('REPEATED_SENTENCE — the same spoken sentence twice in a session is a FAIL', () => {
    reset()
    const line = 'אני כל כך שמחה לדבר איתך היום'
    const entries = [
      ev('abu_speech', { text: line }),
      ev('user_speech', { text: 'ומה עוד?' }),
      ev('abu_speech', { text: line }),
    ]
    const r = evaluateToolSequencing({ entries })
    expect(r.violations.some((v) => v.type === 'REPEATED_SENTENCE')).toBe(true)
    expect(r.repeatedSentences).toContain(line)
  })

  it('MASKED_FALLBACK — watchdog/fallback on the clean path is counted and flagged', () => {
    reset()
    const entries = [ev('note', { text: 'REALTIME_AUDIO_TIMEOUT watchdog fired — using pipeline TTS fallback' }), ev('abu_speech', { text: 'שלום חמודה' })]
    const r = evaluateToolSequencing({ entries, recoverableCount: 1 })
    expect(r.watchdogFallbackCount).toBeGreaterThanOrEqual(2)
    expect(r.violations.some((v) => v.type === 'MASKED_FALLBACK')).toBe(true)
  })
})

describe('oracle over the REAL FlightRecorder output (actual session trace shape)', () => {
  it('a clean recorded tool turn passes the oracle', () => {
    const rec = new FlightRecorder(() => 0)
    rec.onUserText('מה מזג האוויר?')
    rec.onToolCall('get_current_info', { q: 'weather' })
    rec.onToolResult('get_current_info', { temp: 25 })
    rec.onAbuText('עכשיו עשרים וחמש מעלות בכפר סבא.')
    rec.onTurnEnd()
    const exp = rec.toExport()
    const r = evaluateToolSequencing({ entries: exp.entries, preambleGaps: rec.getPreambleGaps(), recoverableCount: rec.recoverableErrorCount(), toolIssueCount: rec.toolIssueCount() })
    expect(r.pass).toBe(true)
  })

  it('a recorded preamble (onPreambleGap) is caught by the oracle on real recorder output', () => {
    const rec = new FlightRecorder(() => 0)
    rec.onUserText('מה השער של הדולר?')
    rec.onAudioDelta()
    rec.onPreambleGap(480)                 // recorder measured 480ms of speech before the function_call
    rec.onToolCall('get_current_info', { q: 'usd' })
    rec.onToolResult('get_current_info', { rate: 2.95 })
    rec.onAbuText('הדולר עומד על שתיים תשעים וחמש.')
    rec.onTurnEnd()
    const exp = rec.toExport()
    const r = evaluateToolSequencing({ entries: exp.entries, preambleGaps: rec.getPreambleGaps() })
    expect(r.pass).toBe(false)
    expect(r.violations.some((v) => v.type === 'SPOKEN_PREAMBLE')).toBe(true)
  })
})
