/*
 * RESPONSE LIFECYCLE (ADR-0001 §5 — explicit response + audio state machine).
 * ════════════════════════════════════════════════════════════════════════════
 * Replaces the boolean response lease that had device-recreating holes:
 *   • it released on transcript-done (text ≠ audible completion — audio still plays);
 *   • it reset on a new transcript (a new input during output is an INTERRUPTION,
 *     not permission for a parallel response);
 *   • it deduped by transcript TEXT (two turns can share identical text).
 *
 * A new response may START only when the previous ResponseState is terminal AND the
 * previous AudioState is STOPPED/SILENT. Turn identity is a provider INPUT ITEM ID +
 * session generation (never text). Terminal events for the WRONG response id are
 * rejected. Pure + deterministic → unit-testable; wired into RealtimeVoiceSession.
 */

export type ResponseState = 'IDLE' | 'REQUESTED' | 'ACTIVE' | 'CANCELLING' | 'COMPLETED' | 'FAILED'
export type AudioState = 'SILENT' | 'STARTING' | 'PLAYING' | 'DRAINING' | 'STOPPED'
export type ResponseSource =
  | 'AUTO_MODEL_RESPONSE' | 'POST_TOOL_GROUNDED_RESPONSE' | 'MANUAL_LEGACY_SPEAK'
  | 'FALLBACK_RESPONSE' | 'TRUTH_REPAIR_RESPONSE' | 'GREETING_RESPONSE' | 'ERROR_RECOVERY_RESPONSE'

export interface StartDecision { granted: boolean; reason: string }
export interface InputDecision { kind: 'new_turn' | 'duplicate' | 'interruption'; reason: string }

const TERMINAL_RESPONSE: ResponseState[] = ['IDLE', 'COMPLETED', 'FAILED']
const AUDIO_QUIET: AudioState[] = ['SILENT', 'STOPPED']

export class ResponseLifecycle {
  private responseState: ResponseState = 'IDLE'
  private audioState: AudioState = 'SILENT'
  private generation = 0
  private turnSeq = 0
  private turnId: string | null = null
  private inputItemId: string | null = null
  private responseId: string | null = null
  private source: ResponseSource | null = null

  get response(): ResponseState { return this.responseState }
  get audio(): AudioState { return this.audioState }
  get currentTurnId(): string | null { return this.turnId }
  get currentResponseId(): string | null { return this.responseId }
  get gen(): number { return this.generation }

  /** A session (re)start bumps the generation — pre-restart terminal events are stale. */
  bumpGeneration(): void { this.generation += 1 }

  /** True only when a new response may start: previous terminal AND audio quiet. */
  canStartNewResponse(): boolean {
    return TERMINAL_RESPONSE.includes(this.responseState) && AUDIO_QUIET.includes(this.audioState)
  }

  /**
   * Classify an accepted user input by its PROVIDER item id (never text):
   *  • same item id → duplicate (one turn);
   *  • new item id while a response is live → INTERRUPTION (must cancel+drain, not reset);
   *  • new item id when the previous is terminal → a new turn.
   */
  onAcceptedInput(inputItemId: string, generation: number): InputDecision {
    if (generation !== this.generation) return { kind: 'duplicate', reason: `stale generation ${generation}/${this.generation}` }
    if (inputItemId && inputItemId === this.inputItemId) return { kind: 'duplicate', reason: 'same input item id → one turn' }
    if (!this.canStartNewResponse()) {
      // A new input while output is still active is an interruption request.
      this.inputItemId = inputItemId
      return { kind: 'interruption', reason: `input during ${this.responseState}/${this.audioState}` }
    }
    this.turnSeq += 1; this.turnId = `turn_${this.turnSeq}`; this.inputItemId = inputItemId
    this.responseId = null; this.source = null
    return { kind: 'new_turn', reason: 'ok' }
  }

  /** Request to START a response — granted only when the previous is fully terminal. */
  requestResponseStart(source: ResponseSource): StartDecision {
    if (!this.canStartNewResponse()) {
      return { granted: false, reason: `blocked: response=${this.responseState} audio=${this.audioState}` }
    }
    this.responseState = 'REQUESTED'; this.source = source; this.audioState = 'STARTING'
    return { granted: true, reason: 'ok' }
  }

  // ─── Provider lifecycle events ───────────────────────────────────────────
  onResponseCreated(responseId: string): void { this.responseId = responseId; if (this.responseState === 'REQUESTED') this.responseState = 'ACTIVE' }
  onAudioStarted(): void { if (this.audioState === 'STARTING' || this.audioState === 'SILENT') this.audioState = 'PLAYING' }
  /** Transcript-done is NOT terminal — audio may still be heard. Intentionally a no-op. */
  onTranscriptDone(): void { /* not a terminal event */ }

  /** A terminal response event — ignored if it names a DIFFERENT response id. */
  onResponseDone(responseId?: string): boolean {
    if (responseId && this.responseId && responseId !== this.responseId) return false // stale/wrong id
    this.responseState = 'COMPLETED'
    // audio completes with the response unless still draining; mark quiet.
    if (this.audioState !== 'DRAINING') this.audioState = 'STOPPED'
    return true
  }
  onResponseFailed(responseId?: string): boolean {
    if (responseId && this.responseId && responseId !== this.responseId) return false
    this.responseState = 'FAILED'; this.audioState = 'STOPPED'; return true
  }
  /** Interruption/barge-in: begin cancel + drain. Not terminal until drained. */
  beginCancel(): void { if (this.responseState === 'ACTIVE' || this.responseState === 'REQUESTED') this.responseState = 'CANCELLING'; this.audioState = 'DRAINING' }
  onAudioStopped(): void { this.audioState = 'STOPPED'; if (this.responseState === 'CANCELLING') this.responseState = 'COMPLETED' }

  /** Reset for a fresh session (generation bumped separately). */
  reset(): void {
    this.responseState = 'IDLE'; this.audioState = 'SILENT'
    this.turnId = null; this.inputItemId = null; this.responseId = null; this.source = null
  }

  /** Snapshot for the privacy-safe live trace (ids only, no content). */
  view() {
    return {
      responseState: this.responseState, audioState: this.audioState, generation: this.generation,
      turnId: this.turnId, inputItemId: this.inputItemId, responseId: this.responseId, source: this.source,
    }
  }
}
