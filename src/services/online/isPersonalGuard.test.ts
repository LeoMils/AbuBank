/*
 * isPersonal over-blocking regression (§16 P1 fix). Structural: a public/current-information
 * question must NEVER be classified private-person merely for containing person-like language.
 * Personal ⇔ a POSSESSIVE marker (my/mi/שלי) + a family/calendar term, or a known family name.
 * Reproduces the deployed defect: "who is the current president" was blocked as personal.
 */
import { describe, it, expect } from 'vitest'
import { isPersonal } from '../../../api/abuai-online'

describe('isPersonal — no over-block of public/current-info (sensitivity of the fix)', () => {
  const PUBLIC = [
    'who is the current president of the united states?',
    'who is the prime minister of the uk?',
    'who is the ceo of apple?',
    'who won the last super bowl?',
    'what is the exchange rate of the dollar?',
    'what is the weather in tel aviv today?',
    'quién es el presidente de argentina?',
    'cuál es el clima hoy?',
    'מי ראש הממשלה של ישראל?',
    'מה מזג האוויר היום בכפר סבא?',
    'כמה עולה דולר?',
  ]
  for (const q of PUBLIC) {
    it(`does NOT block: "${q}"`, () => { expect(isPersonal(q)).toBe(false) })
  }
})

describe('isPersonal — still blocks genuine personal/family queries (specificity)', () => {
  const PERSONAL = [
    'what do I have tomorrow?',
    'what is the meaning of my grandson\'s dream?',
    'tell me about my family',
    'when is my doctor appointment?',
    'qué tengo hoy?',
    'háblame de mi familia',
    'mi médico cuándo?',
    'מה יש לי מחר?',
    'מי זה מור?',        // Mor is a family name (PERSONAL_HE)
    'מתי הרופא הבא שלי?',
  ]
  for (const q of PERSONAL) {
    it(`blocks: "${q}"`, () => { expect(isPersonal(q)).toBe(true) })
  }
})
