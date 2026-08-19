/*
 * Conversation Delivery Engine (Phase 4) — proves speech chunking, resume, safety.
 */
import { describe, it, expect } from 'vitest'
import {
  planDelivery, currentChunk, advance, resume, hasMore, TTS_EVENTS, ttsLog,
} from './conversationDeliveryEngine'

const LONG = 'משפט ראשון כאן. משפט שני כאן. משפט שלישי כאן. משפט רביעי כאן. משפט חמישי כאן. משפט שישי כאן.'

describe('speech chunking + resume', () => {
  it('splits a long answer into multiple short speech chunks', () => {
    const d = planDelivery(LONG)
    expect(d.chunks.length).toBeGreaterThanOrEqual(2)
    for (const c of d.chunks) expect(c.length).toBeLessThanOrEqual(200)
  })
  it('preserves the full display text', () => {
    const d = planDelivery(LONG)
    expect(d.fullText).toBe(LONG)
  })
  it('tracks the spoken chunk index', () => {
    let d = planDelivery(LONG)
    expect(d.index).toBe(-1)
    const a = advance(d); d = a.state
    expect(d.index).toBe(0)
    expect(currentChunk(d)).toBe(a.chunk)
  })
  it('"תמשיכי / תשלימי" resumes the exact next chunk', () => {
    let d = planDelivery(LONG)
    const first = advance(d); d = first.state
    const second = resume(d); d = second.state
    expect(second.chunk).toBeTruthy()
    expect(second.chunk).not.toBe(first.chunk)
    expect(d.index).toBe(1)
  })
  it('reports done when no more chunks', () => {
    let d = planDelivery('משפט יחיד קצר.')
    let step = advance(d); d = step.state
    while (hasMore(d)) { step = advance(d); d = step.state }
    expect(resume(d).chunk).toBeNull()
  })
  it('interrupted speech resumes from the tracked index', () => {
    let d = planDelivery(LONG)
    d = advance(d).state          // deliver chunk 0
    d = advance(d).state          // deliver chunk 1 (interrupted here)
    const idxAtInterrupt = d.index
    const r = resume(d)           // "תמשיכי" after interruption
    expect(r.chunk).toBe(d.chunks[idxAtInterrupt + 1])
  })
})

describe('speech safety + TTS lifecycle', () => {
  it('never lets markdown or raw URLs into speech', () => {
    const d = planDelivery('תראי [כאן](https://example.com) `code` **bold** את זה. ועוד משפט רגיל.')
    expect(d.chunks.join(' ')).not.toMatch(/https?:\/\/|\]\(|[*_`#]/)
  })
  it('exposes the full TTS lifecycle event set', () => {
    for (const e of ['listen_start', 'stt_done', 'answer_ready', 'tts_start', 'tts_chunk_done', 'tts_done', 'tts_error', 'tts_interrupted']) {
      expect(TTS_EVENTS).toContain(e)
    }
  })
  it('emits structured log entries with chunk index + error', () => {
    expect(ttsLog('tts_chunk_done', 100, { chunkIndex: 2 }).chunkIndex).toBe(2)
    expect(ttsLog('tts_error', 101, { error: 'no-voice' }).error).toBe('no-voice')
  })
})
