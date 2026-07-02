/*
 * Conversation Delivery Engine (Phase 11)
 * ═══════════════════════════════════════
 * Plans how a finalized answer is delivered in text vs. speech. Text keeps the
 * full answer; speech is chunked into short spoken units with a tracked index so
 * "תמשיכי / תשלימי" resumes the exact next chunk. Emits the standard TTS lifecycle
 * events for logging. Speech chunks carry no markdown / URLs (the composer already
 * stripped them; this is the last guard).
 *
 * Pure + deterministic. This REPLACES the ad-hoc speech planning — the runtime
 * produces the answer, this engine produces its delivery plan.
 */
import { planSpokenChunks } from './conversationOS'

export type TtsEvent =
  | 'listen_start' | 'stt_done' | 'answer_ready'
  | 'tts_start' | 'tts_chunk_done' | 'tts_done' | 'tts_error' | 'tts_interrupted'

export const TTS_EVENTS: readonly TtsEvent[] = [
  'listen_start', 'stt_done', 'answer_ready',
  'tts_start', 'tts_chunk_done', 'tts_done', 'tts_error', 'tts_interrupted',
] as const

export interface DeliveryState {
  fullText: string
  chunks: string[]
  /** index of the last chunk DELIVERED (-1 = none delivered yet). */
  index: number
}

// Strip markdown links → their text, bare URLs, and emphasis marks — thoroughly.
function stripForSpeech(c: string): string {
  return c
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // [text](url) → text
    .replace(/https?:\/\/\S+/g, '')            // bare URLs
    .replace(/[*_`#]/g, '')                    // md emphasis / code / heading marks
    .replace(/\]\(/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function planDelivery(fullText: string): DeliveryState {
  const chunks = planSpokenChunks(fullText).map(stripForSpeech).filter(Boolean)
  return { fullText: fullText ?? '', chunks, index: -1 }
}

export function currentChunk(s: DeliveryState): string | null {
  return s.index >= 0 && s.index < s.chunks.length ? s.chunks[s.index]! : null
}

export function hasMore(s: DeliveryState): boolean {
  return s.index < s.chunks.length - 1
}

/** Deliver the next chunk (used to start speech and to resume it). */
export function advance(s: DeliveryState): { chunk: string | null; state: DeliveryState; done: boolean } {
  const next = s.index + 1
  if (next >= s.chunks.length) return { chunk: null, state: s, done: true }
  const state = { ...s, index: next }
  return { chunk: s.chunks[next]!, state, done: next >= s.chunks.length - 1 }
}

/** "תמשיכי / תשלימי" → the exact next chunk. */
export function resume(s: DeliveryState): { chunk: string | null; state: DeliveryState; done: boolean } {
  if (!hasMore(s)) return { chunk: null, state: s, done: true }
  return advance(s)
}

export interface TtsLogEntry { event: TtsEvent; chunkIndex?: number; error?: string; ts: number }

/** Structured TTS lifecycle log entry (ts injected so it stays deterministic). */
export function ttsLog(event: TtsEvent, ts: number, meta?: { chunkIndex?: number; error?: string }): TtsLogEntry {
  return { event, ts, ...(meta?.chunkIndex !== undefined ? { chunkIndex: meta.chunkIndex } : {}), ...(meta?.error ? { error: meta.error } : {}) }
}
