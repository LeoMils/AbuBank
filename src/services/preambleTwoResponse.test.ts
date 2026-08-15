import { describe, it, expect } from 'vitest'
import { TwoResponsePreamblePlanner } from './preambleTwoResponse'

/*
 * The two-response scheme must (a) make the decision response TEXT-ONLY when enabled (so a preamble
 * can never be voiced), (b) speak a grounded answer after a tool turn, (c) speak the plain answer
 * when no tool was called, and (d) be perfectly inert when disabled (default) — the live path is
 * unchanged. Pure decision logic; the audio-graph wiring is the device-validated remainder.
 */
describe('TwoResponsePreamblePlanner — enabled', () => {
  it('decision response is TEXT-ONLY (no preamble can be voiced)', () => {
    const p = new TwoResponsePreamblePlanner(true)
    expect(p.firstResponseModalities()).toEqual(['text'])
  })

  it('tool turn: function_call → await-tool → tool result → speak grounded answer (audio)', () => {
    const p = new TwoResponsePreamblePlanner(true)
    expect(p.onFunctionCall()).toBe('await-tool')
    expect(p.onDecisionDone()).toBe('await-tool')      // still waiting for the tool result
    expect(p.onToolResult()).toBe('speak-grounded-answer')
    expect(p.answerResponseModalities()).toEqual(['audio'])
  })

  it('plain turn: no function_call → decision done → speak the plain answer (audio)', () => {
    const p = new TwoResponsePreamblePlanner(true)
    expect(p.onDecisionDone()).toBe('speak-plain-answer')
    expect(p.answerResponseModalities()).toEqual(['audio'])
  })
})

describe('TwoResponsePreamblePlanner — disabled (default, live path unchanged)', () => {
  it('decision response keeps audio+text (current single-response behaviour)', () => {
    const p = new TwoResponsePreamblePlanner(false)
    expect(p.firstResponseModalities()).toEqual(['audio', 'text'])
  })

  it('every step is passthrough — the planner is inert', () => {
    const p = new TwoResponsePreamblePlanner(false)
    expect(p.onFunctionCall()).toBe('passthrough')
    expect(p.onDecisionDone()).toBe('passthrough')
    expect(p.onToolResult()).toBe('passthrough')
    expect(p.isEnabled).toBe(false)
  })
})
