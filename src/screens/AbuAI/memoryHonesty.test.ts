/**
 * Regression: AbuAI must be HONEST about memory. Device incident
 * (docs/DEVICE_P0_ROOT_CAUSE.md): it verbally implied it has memory it doesn't
 * ("sometimes I miss things") — a trust-breaking behavior for Martita.
 *
 * The truth of the wiring: the app passes the CURRENT conversation to the model
 * (fullTurnBridge → sendMessage(messages)), so it can reference what was just said —
 * but there is NO cross-session memory. The system prompt must forbid claiming a
 * persistent memory and must forbid deflecting with "I sometimes forget / miss things"
 * (which implies a fallible memory); if something was not said in this conversation it
 * must honestly say it does not know.
 *
 * This is a source-contract test on SYSTEM_PROMPT (the prompt shapes LLM behavior; the
 * real model is not run here). Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT } from './service'

describe('SYSTEM_PROMPT is honest about memory', () => {
  it('states there is no memory between conversations (only the current one is visible)', () => {
    expect(SYSTEM_PROMPT).toMatch(/אין לך זיכרון בין שיחות/)
    expect(SYSTEM_PROMPT).toMatch(/השיחה הזו|השיחה הנוכחית/)
  })
  it('forbids implying a fallible memory ("sometimes I miss/forget") instead of honest "I don\'t know"', () => {
    // The instruction must explicitly name the dishonest phrasings so the model avoids them
    // and says "לא יודעת" for anything not stated in this conversation.
    expect(SYSTEM_PROMPT).toMatch(/מפספסת|שכחתי/)
    expect(SYSTEM_PROMPT).toMatch(/לא יודעת/)
  })
})
