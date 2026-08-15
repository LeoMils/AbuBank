/*
 * preambleGate.ts — M1: suppress the spoken PREAMBLE before a tool call ("רגע, אני בודקת").
 * ════════════════════════════════════════════════════════════════════════════
 * THE PROBLEM (device: 5/5 tool calls). In this WebRTC realtime architecture the tool-selecting
 * response STREAMS its audio as it is generated, so by the time the client sees the function_call
 * event the preamble has already begun playing — there is no server-side pre-delivery interception
 * point (the same finding as M2).
 *
 * APPROACHES considered (owner amendment):
 *   1. TWO-RESPONSE (server) — make the tool-selecting response text-only, speak in a second
 *      response after the tool result. Possible with output_modalities per response, BUT with
 *      create_response:true the SERVER auto-creates the turn using the SESSION modalities, so this
 *      needs create_response:false + client-driven turns — a bigger change AND an extra round-trip
 *      (text-decision → tool → audio) that ADDS latency to every turn. Rejected as the primary.
 *   2. CLIENT COMMIT WINDOW (chosen) — the CLIENT owns playback. Delay the response's audio by a
 *      short window; if a function_call arrives inside the window, this response was a preamble →
 *      discard it (play nothing); the tool-result response plays normally. Provider-independent,
 *      works regardless of stream ordering. Cost: the window is added to first-audio latency on a
 *      NON-tool turn (a plain answer); a tool turn pays nothing extra (its preamble is discarded
 *      and the grounded answer is the next response). This module is that decision logic, PURE and
 *      testable; the audio-graph wiring (a WebAudio DelayNode buffering the remote track) is the
 *      device-validated remainder — audibility is the owner's ear.
 *
 * LATENCY (measured by construction): +windowMs to the first heard word of a PLAIN answer (default
 * 400ms). A tool turn's grounded answer is NOT delayed (the gate only holds the preamble response).
 * 400ms keeps a plain answer well inside the 4s first-token budget. Tunable.
 */

export type GateAction = 'hold' | 'play' | 'suppress'
export type GatePhase = 'idle' | 'holding' | 'playing' | 'suppressed'

export const DEFAULT_PREAMBLE_WINDOW_MS = 400

/**
 * One response's playback decision. Feed it the lifecycle in order; it decides whether the buffered
 * audio is RELEASED (a real answer) or SUPPRESSED (a preamble that preceded a tool call).
 *   onResponseCreated()  → a new response begins
 *   onAudioDelta(now)    → audio arrived; the FIRST delta starts the commit window (returns 'hold')
 *   onFunctionCall()     → this response is a tool turn → its audio so far is a preamble → 'suppress'
 *   tick(now)            → call on a timer; releases to 'play' once the window elapses with no tool call
 *   onResponseDone()     → reset for the next response
 * Idempotent and monotonic: once 'suppressed' it stays suppressed for this response; once 'playing'
 * it stays playing (a tool call AFTER real speech has begun does not retro-mute the answer).
 */
export class PreambleGate {
  private phaseVal: GatePhase = 'idle'
  private audioStartedAt: number | null = null
  constructor(private readonly windowMs: number = DEFAULT_PREAMBLE_WINDOW_MS) {}

  get phase(): GatePhase { return this.phaseVal }

  onResponseCreated(): void { this.phaseVal = 'idle'; this.audioStartedAt = null }

  /** Audio arrived. The first delta of a response begins the HOLD (buffer, do not play yet). */
  onAudioDelta(now: number): GateAction {
    if (this.phaseVal === 'idle') { this.phaseVal = 'holding'; this.audioStartedAt = now }
    return this.phaseVal === 'holding' ? 'hold' : this.phaseVal === 'suppressed' ? 'suppress' : 'play'
  }

  /** A function call for THIS response → the audio buffered so far was a preamble. Suppress it —
   *  UNLESS real audio was already released (a tool call after a genuine answer is not a preamble). */
  onFunctionCall(): GateAction {
    if (this.phaseVal === 'playing') return 'play' // already speaking a real answer; do not retro-mute
    this.phaseVal = 'suppressed'
    return 'suppress'
  }

  /** Timer tick: once the window elapses with NO function call, release the buffered audio to play. */
  tick(now: number): GateAction {
    if (this.phaseVal === 'holding' && this.audioStartedAt !== null && now - this.audioStartedAt >= this.windowMs) {
      this.phaseVal = 'playing'
    }
    return this.phaseVal === 'holding' ? 'hold' : this.phaseVal === 'suppressed' ? 'suppress' : 'play'
  }

  onResponseDone(): void { this.phaseVal = 'idle'; this.audioStartedAt = null }
}
