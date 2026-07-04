/*
 * Speech / delivery contract (code-side): a long answer is chunked into short
 * spoken units; the full display text is preserved; "תמשיכי / תשלימי" (resume)
 * advances to the EXACT next chunk; chunks never carry markdown / URLs; no chunk
 * is a long paragraph. Physical TTS feel is device-gated (see checklist).
 */
import { describe, it, expect } from 'vitest'
import { planDelivery, advance, resume, currentChunk, hasMore } from './conversationDeliveryEngine'

const LONG = 'משפט ראשון על הנושא כאן. משפט שני שממשיך את ההסבר. משפט שלישי עם עוד פרט. משפט רביעי שסוגר את התשובה.'

describe('Speech delivery — chunking + resume', () => {
  it('splits a long answer into multiple short chunks and preserves the full text', () => {
    const d = planDelivery(LONG)
    expect(d.chunks.length).toBeGreaterThan(1)
    expect(d.fullText).toBe(LONG)
    for (const c of d.chunks) expect(c.length).toBeLessThan(160) // no long spoken paragraph
  })

  it('advance then resume delivers consecutive chunks (exact next chunk)', () => {
    const d = planDelivery(LONG)
    const a = advance(d)
    expect(a.chunk).toBe(d.chunks[0])
    const b = resume(a.state)
    expect(b.chunk).toBe(d.chunks[1])
    expect(b.chunk).not.toBe(a.chunk)
    expect(currentChunk(b.state)).toBe(d.chunks[1])
  })

  it('resume past the last chunk reports done, never repeats forever', () => {
    const s = planDelivery('משפט יחיד.')
    const a = advance(s)                 // deliver the only chunk
    expect(hasMore(a.state)).toBe(false)
    const b = resume(a.state)            // "תמשיכי" with nothing left
    expect(b.done).toBe(true)
    expect(b.chunk).toBeNull()
  })

  it('spoken chunks carry no markdown, links or raw URLs', () => {
    const d = planDelivery('ראי [כאן](https://x.co) **בולד** ו-www לא. עוד משפט רגיל כאן.')
    for (const c of d.chunks) {
      expect(c).not.toMatch(/https?:\/\/|\]\(|[*_`#]/)
    }
  })
})
