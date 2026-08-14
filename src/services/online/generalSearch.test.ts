/*
 * generalSearch.test.ts — the general loop's control flow, with fake seams (no network, no model).
 * Proves: judge-answers-first-time returns it; a bad first search REFINES and self-corrects; the
 * refine respects the budget; a total miss is an honest no_answer (never a dump); failures degrade.
 */
import { describe, it, expect, vi } from 'vitest'
import { generalSearchLoop, reformulate } from './generalSearch'
import type { Synthesis } from './synthesize'

const page = (body: string) => `<html><body>${body}</body></html>`
const okSyn = (answer: string): Synthesis => ({ status: 'answer', answer })
const noSyn = (): Synthesis => ({ status: 'no_answer', answer: '' })

describe('reformulate (general, no type logic)', () => {
  it('attempt 1 tightens a rambling query to its content words', () => {
    expect(reformulate('נו, כמה זה עולה הבושם ההוא של שאנל', 1)).toContain('בושם')
    expect(reformulate('נו, כמה זה עולה הבושם ההוא של שאנל', 1)).toContain('שאנל')
  })
  it('attempt 2 falls back to the two longest content words', () => {
    const r = reformulate('what is the weather in tel aviv right now please', 2)
    expect(r.split(' ').length).toBeLessThanOrEqual(2)
  })
})

describe('generalSearchLoop', () => {
  const search = async () => [{ url: 'https://a.example' }, { url: 'https://b.example' }]
  const fetchGood = async () => page('a substantial page about the perfume בושם שאנל costing 597 shekels. ' + 'more descriptive text about the fragrance the bottle the notes and where it is sold across the country. '.repeat(3))
  const fetchThin = async () => page('empty')

  it('returns the judge answer on the first attempt when the page answers', async () => {
    const synthesize = vi.fn(async () => okSyn('הבושם עולה בערך 597 שקלים'))
    const r = await generalSearchLoop('כמה עולה בושם שאנל', { search, fetchPage: fetchGood, synthesize })
    expect(r.status).toBe('answer')
    expect(r.answer).toContain('597')
    expect(r.attempts).toBe(1)
    expect(synthesize).toHaveBeenCalledTimes(1)
  })

  it('REFINES when the first judge says no_answer, then succeeds (self-correction)', async () => {
    // First synthesize → no_answer, second → answer. The loop must reformulate and try again.
    const synthesize = vi.fn()
      .mockResolvedValueOnce(noSyn())
      .mockResolvedValueOnce(okSyn('היום מציגים שלושה סרטים'))
    const seenQueries: string[] = []
    const searchSpy = async (q: string) => { seenQueries.push(q); return [{ url: 'https://x' }] }
    const r = await generalSearchLoop('נו איזה סרטים רצים היום בקולנוע', { search: searchSpy, fetchPage: fetchGood, synthesize })
    expect(r.status).toBe('answer')
    expect(r.attempts).toBe(2)
    expect(seenQueries.length).toBe(2)
    expect(seenQueries[0]).not.toBe(seenQueries[1]) // the query was reformulated
  })

  it('returns an HONEST no_answer (never a dump) when every attempt misses', async () => {
    const synthesize = vi.fn(async () => noSyn())
    const r = await generalSearchLoop('משהו שאי אפשר למצוא בכלל', { search, fetchPage: fetchGood, synthesize, maxAttempts: 2 })
    expect(r.status).toBe('no_answer')
    expect(r.answer).toBe('')
  })

  it('does NOT start a refine when the budget is already spent', async () => {
    let t = 0
    const now = () => (t += 3000) // each call to now advances 3s → after attempt 1, <1800ms remains
    const synthesize = vi.fn(async () => noSyn())
    const searchSpy = vi.fn(async () => [{ url: 'https://x' }])
    const r = await generalSearchLoop('שאלה כלשהי עם מילים', { search: searchSpy, fetchPage: fetchGood, synthesize, now, hardCeilingMs: 6000, minAttemptSliceMs: 1800, maxAttempts: 3 })
    expect(r.status).toBe('no_answer')
    expect(r.attempts).toBe(1) // the ceiling stopped a second attempt
  })

  it('a thin/empty page is skipped without a wasted model call', async () => {
    const synthesize = vi.fn(async () => okSyn('x'))
    const r = await generalSearchLoop('שאלה', { search, fetchPage: fetchThin, synthesize, maxAttempts: 1 })
    expect(r.status).toBe('no_answer')
    expect(synthesize).not.toHaveBeenCalled() // no substantial page → no judge call
  })

  it('degrades to no_answer when fetch throws (network loss mid-fetch)', async () => {
    const synthesize = vi.fn(async () => okSyn('x'))
    const fetchThrows = async () => { throw new Error('network down') }
    const r = await generalSearchLoop('שאלה', { search, fetchPage: fetchThrows, synthesize, maxAttempts: 2 })
    expect(r.status).toBe('no_answer')
  })
})
