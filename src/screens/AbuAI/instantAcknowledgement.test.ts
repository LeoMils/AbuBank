import { describe, it, expect } from 'vitest'
import { getInstantAcknowledgement } from './instantAcknowledgement'

describe('getInstantAcknowledgement — short non-factual pacing', () => {
  it('returns a HE ack for online_search', () => {
    const a = getInstantAcknowledgement('online_search', 'he')
    expect(a.length).toBeGreaterThan(0)
    expect(a.length).toBeLessThan(60)
    // Non-factual: must NOT contain a "found X" / "yes, you have" claim.
    expect(/יש לך |מצאתי |found |you have /i.test(a)).toBe(false)
  })
  it('returns ES ack with adult tone for online_search', () => {
    const a = getInstantAcknowledgement('online_search', 'es')
    expect(a).toContain('Dale')
    expect(/encontré |hay /i.test(a)).toBe(false)
  })
  it('weather_api ack does not claim a temperature', () => {
    const a = getInstantAcknowledgement('weather_api', 'es')
    expect(/\d+°/.test(a)).toBe(false)
  })
  it('local_activity ack mentions checking, not "found"', () => {
    const a = getInstantAcknowledgement('local_activity', 'es')
    expect(a.toLowerCase()).toContain('cerca')
    expect(/encontré|abierto ahora mismo/.test(a)).toBe(false)
  })
})

describe('getInstantAcknowledgement — tone constitution', () => {
  it('no childish opener in any committed ack', () => {
    const childish = ['muy bien', 'princesa', 'כל הכבוד', 'good job']
    const targets = ['calendar_tool', 'family_tool', 'contacts_tool', 'weather_api', 'online_search',
                     'open_conversation', 'proactive_content', 'practical_help',
                     'film_series', 'music', 'cooking', 'theatre_poetry', 'news_world',
                     'curious_facts', 'riddles_games', 'light_culture_gossip', 'memories',
                     'local_activity', 'podcast', 'open_chat'] as const
    const langs = ['he', 'es', 'en', 'mixed'] as const
    for (const t of targets) {
      for (const l of langs) {
        const a = getInstantAcknowledgement(t, l).toLowerCase()
        for (const phrase of childish) {
          expect(a.includes(phrase), `target=${t} lang=${l} ⇒ ${a}`).toBe(false)
        }
      }
    }
  })
})
