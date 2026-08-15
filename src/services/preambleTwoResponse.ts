/*
 * preambleTwoResponse.ts — M1b: the TWO-RESPONSE path that structurally CANNOT voice a preamble.
 * ════════════════════════════════════════════════════════════════════════════
 * WHY (owner's ~4s device evidence). The existing PreambleGate delays audio by a short client
 * COMMIT WINDOW (default 400ms) and discards it if a function_call arrives inside the window. That
 * works only when the preamble is SHORT: if the model narrates "רגע, אני בודקת…" for ~4s BEFORE it
 * emits the function_call, the 400ms window has long since released the audio → the preamble plays.
 * You cannot widen the window to 4s without adding 4s to every PLAIN answer. So for a LONG preamble
 * the commit-window is the wrong tool — the owner's own conclusion: two-response beats a client delay.
 *
 * THE TWO-RESPONSE PLAN (this module — PURE decision logic, no I/O, no timers):
 *   • The tool-selecting ("decision") response is requested TEXT-ONLY → it can emit a function_call
 *     but produces NO audio, so a preamble is structurally impossible to hear.
 *   • Tool turn  → after the tool result, a SECOND response speaks the grounded answer (audio).
 *   • Plain turn → the text decision WAS the answer → a second response speaks it (audio).
 * COST (honest): a PLAIN answer pays one extra decision→audio round-trip (the latency the primary
 * commit-window path avoids). That trade is only worth taking if the owner's ear confirms the ~4s
 * preamble is gone and the extra round-trip is acceptable — hence this ships behind a DEVICE-GATED
 * flag (LIVE_PREAMBLE_TWO_RESPONSE), default OFF, promoted only after AUDIO_CHECK #5 on device.
 *
 * The Realtime session wiring (output_modalities per response + create_response:false client-driven
 * turns) is the DEVICE-VALIDATED remainder — deliberately NOT wired into the live path here, because
 * it cannot be verified against the real model while the account has no credit, and an unverifiable
 * change to the hot voice path is a regression risk. This module is the tested decision core it will use.
 */

/** The modality plan for a single response. */
export type ResponseModality = 'text' | 'audio'

/** What to do at each step of a turn. */
export type TwoResponseStep =
  | 'await-tool'            // the decision response called a tool → wait for its result
  | 'speak-grounded-answer' // tool result is in → speak the grounded answer (2nd, audio) response
  | 'speak-plain-answer'    // no tool was called → the text decision is the answer → speak it (audio)
  | 'passthrough'           // flag OFF → single-response current behaviour, no 2nd response

/**
 * Plans the responses for ONE user turn under the two-response scheme. Deterministic and total;
 * feed it the lifecycle in order. When disabled it is inert (every step is 'passthrough') so the
 * live path is byte-for-byte the current single-response behaviour.
 *
 *   firstResponseModalities() → modalities for the decision response (text-only when enabled)
 *   onFunctionCall()          → the decision response is calling a tool (records a tool turn)
 *   onDecisionDone()          → the decision response finished → what to do next
 *   onToolResult()            → the tool result arrived → speak the grounded answer
 *   answerResponseModalities()→ modalities for the 2nd (spoken) response
 */
export class TwoResponsePreamblePlanner {
  private toolTurn = false
  private done = false
  constructor(private readonly enabled: boolean) {}

  get isEnabled(): boolean { return this.enabled }

  /** The decision response is TEXT-ONLY when enabled (no preamble can be voiced), else audio+text. */
  firstResponseModalities(): ResponseModality[] {
    return this.enabled ? ['text'] : ['audio', 'text']
  }

  /** The decision response emitted a function_call → this is a tool turn. */
  onFunctionCall(): TwoResponseStep {
    if (!this.enabled) return 'passthrough'
    this.toolTurn = true
    return 'await-tool'
  }

  /** The decision response finished. A tool turn waits for its result; a plain turn must now be
   *  SPOKEN (its text was never voiced). */
  onDecisionDone(): TwoResponseStep {
    if (!this.enabled) return 'passthrough'
    this.done = true
    return this.toolTurn ? 'await-tool' : 'speak-plain-answer'
  }

  /** The tool result arrived → speak the grounded answer. Only meaningful on a tool turn. */
  onToolResult(): TwoResponseStep {
    if (!this.enabled) return 'passthrough'
    return this.toolTurn ? 'speak-grounded-answer' : 'passthrough'
  }

  /** The 2nd (spoken) response is always audio (its text was already produced by the decision). */
  answerResponseModalities(): ResponseModality[] {
    return ['audio']
  }
}
