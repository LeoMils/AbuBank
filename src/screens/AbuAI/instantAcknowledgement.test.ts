import { describe, it, expect } from 'vitest'
import { getInstantAcknowledgement } from './instantAcknowledgement'

const TOOL_MODES = ['calendar_tool', 'family_tool', 'contacts_tool', 'weather_api', 'online_search',
  'practical_help', 'film_series', 'music', 'cooking', 'theatre_poetry', 'news_world',
  'local_activity', 'podcast', 'memories'] as const
const CONVERSATIONAL = ['open_conversation', 'proactive_content', 'curious_facts',
  'riddles_games', 'light_culture_gossip', 'open_chat'] as const
const LANGS = ['he', 'es', 'en', 'mixed'] as const

// Announce-before-checking tokens that must NEVER seed an ack (the device preamble bug).
const ANNOUNCE = /אבדוק|בודקת|מסתכל|פותחת|רגע|שנייה|במקורות|lo miro|voy a|déjame|un segundo|checking|opening|i will check|let me check/i

describe('getInstantAcknowledgement — tool-backed modes stay SILENT (no announce-before-checking)', () => {
  it('every tool/lookup mode returns an empty ack in every language', () => {
    for (const t of TOOL_MODES) for (const l of LANGS) {
      expect(getInstantAcknowledgement(t, l), `${t}/${l}`).toBe('')
    }
  })
})

describe('getInstantAcknowledgement — conversational openers are warm, non-factual, non-announcing', () => {
  it('conversational acks are short, present, and never announce a check', () => {
    for (const t of CONVERSATIONAL) for (const l of LANGS) {
      const a = getInstantAcknowledgement(t, l)
      expect(a.length, `${t}/${l} empty`).toBeGreaterThan(0)
      expect(a.length).toBeLessThan(60)
      expect(ANNOUNCE.test(a), `${t}/${l} announces a check: "${a}"`).toBe(false)
      // Non-factual: no "found X" / "yes, you have" claim.
      expect(/יש לך |מצאתי |found |you have |encontré /i.test(a)).toBe(false)
    }
  })

  it('no childish opener in any committed ack', () => {
    const childish = ['muy bien', 'princesa', 'כל הכבוד', 'good job']
    for (const t of [...TOOL_MODES, ...CONVERSATIONAL]) for (const l of LANGS) {
      const a = getInstantAcknowledgement(t, l).toLowerCase()
      for (const phrase of childish) expect(a.includes(phrase), `target=${t} lang=${l} ⇒ ${a}`).toBe(false)
    }
  })
})
