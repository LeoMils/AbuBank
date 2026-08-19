/*
 * newsTypes.test.ts — the completeness guard is the honesty rule made mechanical.
 * A story is shown ONLY if every field is present and the url is a real link.
 */
import { describe, it, expect } from 'vitest'
import { isCompleteStory } from './newsTypes'

const FULL = { headline: 'כותרת', summary: 'תקציר פשוט בעברית.', source: 'הארץ', url: 'https://haaretz.example/a', published: 'לפני שעה' }

describe('isCompleteStory — never show a half-blank card', () => {
  it('accepts a fully-sourced, timed story', () => {
    expect(isCompleteStory(FULL)).toBe(true)
  })
  for (const field of ['headline', 'summary', 'source', 'url', 'published'] as const) {
    it(`rejects a story missing "${field}"`, () => {
      expect(isCompleteStory({ ...FULL, [field]: '' })).toBe(false)
      const { [field]: _omit, ...without } = FULL
      void _omit
      expect(isCompleteStory(without)).toBe(false)
    })
  }
  it('rejects a non-http url (not a real link)', () => {
    expect(isCompleteStory({ ...FULL, url: 'not-a-link' })).toBe(false)
    expect(isCompleteStory({ ...FULL, url: 'javascript:alert(1)' })).toBe(false)
  })
  it('rejects null / non-object', () => {
    expect(isCompleteStory(null)).toBe(false)
    expect(isCompleteStory('x')).toBe(false)
  })
})
