/*
 * Speech Delivery Runtime v2
 * ══════════════════════════
 * The ONE canonical, deterministic owner of code-side speech delivery: the full DISPLAY
 * answer, the speech-safe chunks derived from it, the chunk cursor, and the
 * continue / replay / complete / interrupt / error modes. Serializable to/from Memory
 * Engine v2 so speech state is memory-backed (and appears in Copy-Last-20).
 *
 * This owns LOGIC only — NOT physical TTS voice feel or mic/STT quality (device-only).
 *
 * Hard rules: full display text always preserved; speech derived from display (never
 * invented); markdown/URLs never spoken; "תמשיכי" → exact next chunk; "לא שמעתי" →
 * replay the last spoken chunk; "תשלימי" → the remaining answer; interruptions preserve
 * the cursor; a speech failure never loses the (complete, resumable) display answer.
 */
import { planDelivery } from './conversationDeliveryEngine'

export interface SpeechSnapshot {
  displayText: string
  chunks: string[]
  index: number        // last chunk marked spoken (-1 = none yet)
  interrupted: boolean
  error: boolean
}

export interface SpeechPlanOptions { chunks?: string[] }

export class SpeechPlanV2 {
  private displayText: string
  private chunks: string[]
  private index: number
  private interrupted: boolean
  private error: boolean

  constructor(displayText: string, options?: SpeechPlanOptions) {
    this.displayText = displayText ?? ''
    // speech is DERIVED from display: planDelivery chunks + strips markdown/URLs.
    this.chunks = options?.chunks?.length ? options.chunks : planDelivery(this.displayText).chunks
    this.index = -1
    this.interrupted = false
    this.error = false
  }

  getDisplayText(): string { return this.displayText }                 // rule 1: always preserved
  getSpeechChunks(): string[] { return [...this.chunks] }
  getSpeechText(): string { return this.chunks.join(' ') }
  getCursor(): number { return this.index }
  isComplete(): boolean { return this.chunks.length === 0 || this.index >= this.chunks.length - 1 }
  isInterrupted(): boolean { return this.interrupted }
  hasError(): boolean { return this.error }

  /** Mark a chunk delivered (advances the cursor; clears an interruption). */
  markChunkSpoken(index: number): void {
    if (index >= 0 && index < this.chunks.length) { this.index = index; this.interrupted = false }
  }

  /** "תמשיכי" → the EXACT next chunk (or null when done). */
  continueNext(): { chunk: string | null; index: number; done: boolean } {
    const next = this.index + 1
    if (next >= this.chunks.length) return { chunk: null, index: this.index, done: true }
    this.index = next; this.interrupted = false
    return { chunk: this.chunks[next]!, index: next, done: next >= this.chunks.length - 1 }
  }

  /** "לא שמעתי" → replay the LAST spoken chunk (or the first if none spoken yet). */
  replayLast(): { chunk: string | null; index: number } {
    if (!this.chunks.length) return { chunk: null, index: -1 }
    const i = this.index < 0 ? 0 : this.index
    this.index = i; this.interrupted = false
    return { chunk: this.chunks[i] ?? null, index: i }
  }

  /** "תשלימי" → the remaining answer (all chunks after the cursor), and mark complete. */
  completeRemaining(): { text: string; chunks: string[] } {
    const rest = this.chunks.slice(this.index + 1)
    this.index = this.chunks.length - 1; this.interrupted = false
    return { text: rest.join(' '), chunks: rest }
  }

  /** A user interruption PRESERVES the cursor (continuation is never lost). */
  interrupt(_reason: string): void { this.interrupted = true }

  /** Recover from a speech error — the display answer is intact + resumable. */
  recoverAfterError(): { resumeFrom: number; displayText: string } {
    this.error = false
    return { resumeFrom: Math.max(0, this.index), displayText: this.displayText }
  }
  markError(): void { this.error = true }

  // ── Memory Engine v2 integration ──
  serializeToMemory(): SpeechSnapshot {
    return { displayText: this.displayText, chunks: [...this.chunks], index: this.index, interrupted: this.interrupted, error: this.error }
  }
  static hydrateFromMemory(snap: SpeechSnapshot): SpeechPlanV2 {
    const p = new SpeechPlanV2(snap.displayText, { chunks: snap.chunks })
    p.index = snap.index; p.interrupted = snap.interrupted; p.error = snap.error
    return p
  }
}

export function createSpeechPlan(displayText: string, options?: SpeechPlanOptions): SpeechPlanV2 {
  return new SpeechPlanV2(displayText, options)
}
