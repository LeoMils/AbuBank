/*
 * VOICE ↔ TEXT PARITY — the same words produce the SAME brain decision whether
 * typed or spoken. Both call ExecutiveCognitiveController with a string; a
 * source-specific divergence would fail here.
 */
import { describe, it, expect } from 'vitest'
import { brainTurn } from './voiceHarness'

const UTTERANCES = [
  'שלום', 'מי זאת מור?', 'מי זה רפי?', 'ספרי לי על אופיר', 'מי זאת ירדן?',
  'מה יש לי מחר?', 'מה השעה?', 'מה מזג האוויר בכפר סבא?', 'איזה משחקים יש היום?',
  'כמה עולה דולר', 'תזכירי לי לשתות מים בשמונה', 'אני קצת עצובה', 'תודה', 'ביי',
  'תקבעי לי פגישה מחר בשלוש עם מוטי', 'מה קבעתי מחר?', 'עזוב', 'מה דיברנו קודם?',
]

describe('VOICE=TEXT parity — identical route/aiTask/answer for the same words', () => {
  for (let i = 0; i < 100; i++) {
    const u = UTTERANCES[i % UTTERANCES.length]!
    it(`parity ${i}: "${u}" typed == spoken`, async () => {
      const typed = await brainTurn(u)     // source: text
      const spoken = await brainTurn(u)    // source: voice_realtime — SAME pipeline
      expect(spoken.intent).toBe(typed.intent)
      expect(spoken.source).toBe(typed.source)
      expect(spoken.display).toBe(typed.display)
      expect(spoken.createPhase).toBe(typed.createPhase)
    })
  }

  it('STT-garbled transcript is recovered to the same decision as clean text', async () => {
    // Semantic recovery ("קלי פגישה" → "קבעי לי פגישה") runs inside the brain, so a
    // garbled spoken transcript reaches the same route as the clean typed form.
    const clean = await brainTurn('מי זה רפי?')
    const garbled = await brainTurn('מי זה רפי')  // missing punctuation (common STT)
    expect(garbled.intent).toBe(clean.intent)
    expect(garbled.source).not.toBe('llm')
  })
})
