/*
 * AbuAI B1 — Checkpoint 5: persona / tone audit.
 *
 * The system prompt + few-shots must NOT model patronising openers
 * ("כל הכבוד", "Muy bien", "Good job") or therapy-counsellor cliches.
 * Spanish boredom and Spanish live-info fallback shots must exist so
 * the LLM has a Spanish anchor.
 */

import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT, FEW_SHOT } from './service'

const FORBIDDEN_CHILDISH = [
  'כל הכבוד',
  'יופי של שאלה',
  'good job',
  'great job',
  'muy bien, princesa',
  'te explico despacito',
  'como eres mayor',
]

describe('persona tone — committed prompt + few-shots', () => {
  it('SYSTEM_PROMPT does not say "כל הכבוד" / "Good job" / "Muy bien, princesa"', () => {
    const lower = SYSTEM_PROMPT.toLowerCase()
    for (const phrase of FORBIDDEN_CHILDISH) {
      expect(lower.includes(phrase.toLowerCase()), `forbidden: ${phrase}`).toBe(false)
    }
  })

  it('FEW_SHOT assistant turns do not contain forbidden childish phrases', () => {
    for (const turn of FEW_SHOT) {
      if (turn.role !== 'assistant') continue
      const lower = turn.content.toLowerCase()
      for (const phrase of FORBIDDEN_CHILDISH) {
        expect(lower.includes(phrase.toLowerCase()), `forbidden phrase ${phrase} in: ${turn.content}`).toBe(false)
      }
    }
  })

  it('Hebrew loneliness few-shot is no longer the counsellor pattern "אני כאן" / "תתקשרי"', () => {
    const lonelinessTurn = FEW_SHOT.find((t, i) => t.role === 'user' && t.content.includes('בודדה'))
    expect(lonelinessTurn).toBeDefined()
    const idx = FEW_SHOT.indexOf(lonelinessTurn!)
    const reply = FEW_SHOT[idx + 1]
    expect(reply?.role).toBe('assistant')
    expect(reply?.content).not.toContain('ימים כאלה יש. אני כאן')
    // The new reply offers conversation OR a gentle reminder, NOT a directive
    // "תתקשרי למור".
    expect(reply?.content).not.toContain('תתקשרי למור או ללאו')
  })

  it('Spanish boredom few-shot exists with the adult Mirá-style opener', () => {
    const boredomUser = FEW_SHOT.find((t) => t.role === 'user' && t.content.toLowerCase().includes('estoy aburrida'))
    expect(boredomUser, 'Spanish boredom few-shot user turn missing').toBeDefined()
    const idx = FEW_SHOT.indexOf(boredomUser!)
    const reply = FEW_SHOT[idx + 1]
    expect(reply?.role).toBe('assistant')
    expect(reply!.content.toLowerCase()).toMatch(/mir[áa]|te tiro|te propongo|podemos/)
  })

  it('Spanish live-info fallback few-shot exists ("películas" → honest decline)', () => {
    const liveUser = FEW_SHOT.find((t) => t.role === 'user' && t.content.toLowerCase().includes('películas nuevas'))
    expect(liveUser, 'Spanish live-info few-shot user turn missing').toBeDefined()
    const idx = FEW_SHOT.indexOf(liveUser!)
    const reply = FEW_SHOT[idx + 1]
    expect(reply?.role).toBe('assistant')
    // Must contain an honest decline, not a fabricated list.
    expect(reply!.content.toLowerCase()).toMatch(/no\s+(lo\s+)?puedo\s+comprobar|no\s+tengo\s+acceso/)
  })

  it('SYSTEM_PROMPT preserves Truth Contract anchors', () => {
    expect(SYSTEM_PROMPT).toContain('להמציא עובדות אישיות')
    expect(SYSTEM_PROMPT).toContain('יש לך')
    expect(SYSTEM_PROMPT).toContain('בלי שהכלי החזיר')
    expect(SYSTEM_PROMPT).toContain('חייבת להשתמש בכלי')
  })
})
