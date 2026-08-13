/*
 * announceBeforeChecking.guard.test.ts — FIX 7 build-failing guard.
 * ════════════════════════════════════════════════════════════════════════════
 * The device heard "אני אבדוק במקורות" (and its Spanish twin) — an announce-before-
 * checking preamble — across five sessions. Two sources exist and BOTH are locked here so
 * the phrasing can never come back:
 *   1. THE LIVE VOICE PATH is the realtime MODEL. It has no code seed (liveSession/liveTools
 *      inject no pre-tool speech); the only lever is the instruction. This asserts the strong
 *      "# Before a Tool Call" rule is present and intact, so it cannot be silently weakened.
 *   2. THE CODEBASE SEED was src/screens/AbuAI/instantAcknowledgement.ts — a table of
 *      "רגע, אבדוק אונליין" / "Dale, lo miro un segundo" acks (dead/test-only, but a latent
 *      seed). This asserts every ack it can return is free of announce-before-checking.
 * A failure here FAILS THE BUILD.
 */
import { describe, it, expect } from 'vitest'
import { buildLiveInstructions } from './liveInstructions'
import { getInstantAcknowledgement } from '../screens/AbuAI/instantAcknowledgement'

// Announce/promise-before-checking, Hebrew (present + future) and Spanish and English.
const ANNOUNCE = /אבדוק|אני\s*בודקת|בודקת\b|מסתכל|פותחת|(?:^|\s)רגע(?:\s|,|$)|שנייה|תכף|במקורות|אחזור\s+אלייך|lo miro|voy a (?:revisar|buscar|ver)|déjame (?:ver|revisar)|un segundo|checking (?:online|the|your)|i will check|let me check/i

describe('FIX 7: announce-before-checking can never come back (build-failing guard)', () => {
  it('the live instructions carry the STRONG "# Before a Tool Call" rule (cannot be weakened away)', () => {
    const instr = buildLiveInstructions()
    expect(instr).toContain('# Before a Tool Call')
    expect(instr).toMatch(/NEVER announce that you are about to check/i)
    expect(instr).toMatch(/stay SILENT until it returns/i)
    expect(instr).toMatch(/FIRST words out of your mouth are already the answer/i)
    // the specific phrases the device heard are named in the forbidden list
    expect(instr).toContain('אני אבדוק במקורות')
    expect(instr).toContain('lo miro')
  })

  it('no instantAcknowledgement ack announces a check — the codebase seed is neutralised', () => {
    const targets = ['calendar_tool', 'family_tool', 'contacts_tool', 'weather_api', 'online_search',
      'practical_help', 'film_series', 'music', 'cooking', 'theatre_poetry', 'news_world',
      'local_activity', 'podcast', 'memories', 'open_conversation', 'proactive_content',
      'curious_facts', 'riddles_games', 'light_culture_gossip', 'open_chat'] as const
    for (const t of targets) {
      for (const l of ['he', 'es', 'en', 'mixed'] as const) {
        const a = getInstantAcknowledgement(t, l)
        expect(ANNOUNCE.test(a), `${t}/${l} announces a check: "${a}"`).toBe(false)
      }
    }
  })
})
