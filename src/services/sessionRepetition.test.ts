/*
 * sessionRepetition.test.ts — E3: a substantive sentence Abu already said this session is a repeat.
 */
import { describe, it, expect } from 'vitest'
import { SessionRepetitionGuard, normalizeSpokenLine, splitSentences } from './sessionRepetition'

describe('SessionRepetitionGuard', () => {
  it('flags a VERBATIM repeat of a substantive sentence (the Sharon-answer defect)', () => {
    const g = new SessionRepetitionGuard()
    expect(g.noteSpoken('שרון היא חברה קרובה של המשפחה שלך.').repeats).toEqual([])
    // said again later, word-for-word → a repeat
    expect(g.noteSpoken('שרון היא חברה קרובה של המשפחה שלך.').repeats.length).toBe(1)
  })

  it('ignores punctuation/whitespace/case differences (same line)', () => {
    const g = new SessionRepetitionGuard()
    g.noteSpoken('כן, אני אשלח לה הודעה עכשיו')
    expect(g.wasSaid('כן אני אשלח לה הודעה עכשיו.')).toBe(true)
  })

  it('short acknowledgements are allowed to recur (not a repeat)', () => {
    const g = new SessionRepetitionGuard()
    g.noteSpoken('כן, בסדר.')
    expect(g.noteSpoken('כן בסדר').repeats).toEqual([]) // < 4 words → not guarded
  })

  it('a fresh, different sentence is not a repeat', () => {
    const g = new SessionRepetitionGuard()
    g.noteSpoken('היום מקרינים כמה סרטים טובים בקולנוע.')
    expect(g.noteSpoken('מזג האוויר היום נעים ושמשי בכפר סבא.').repeats).toEqual([])
  })

  it('splitSentences + normalizeSpokenLine are pure helpers', () => {
    expect(splitSentences('שלום. מה שלומך? טוב!').length).toBe(3)
    expect(normalizeSpokenLine('כן, בְּסֵדֶר!')).toBe('כן בְּסֵדֶר')
  })
})
