/*
 * announceBeforeChecking.guard.test.ts — FIX 7 build-failing guard.
 * ════════════════════════════════════════════════════════════════════════════
 * The device heard "אני אבדוק במקורות" (and its Spanish twin) — an announce-before-
 * checking preamble — across five sessions.
 *
 * M1 UPDATE: the "# Before a Tool Call" INSTRUCTION was DELETED from the bundle. A device
 * trace showed it disobeyed on every tool call — an instruction does not enforce silence.
 * Silence between a tool call and its result is now a STRUCTURAL concern of the realtime
 * session layer (liveSession), verified on a physical device (the text instrument does not
 * reproduce the audio preamble). So this guard no longer asserts the instruction text exists.
 *
 * What it STILL locks (build-failing): the CODEBASE SEED — src/screens/AbuAI/
 * instantAcknowledgement.ts, a table of "רגע, אבדוק אונליין" / "Dale, lo miro un segundo"
 * acks (dead/test-only, but a latent seed) — every ack it can return is free of
 * announce-before-checking, so that seed can never feed a preamble back in.
 */
import { describe, it, expect } from 'vitest'
import { getInstantAcknowledgement } from '../screens/AbuAI/instantAcknowledgement'

// Announce/promise-before-checking, Hebrew (present + future) and Spanish and English.
const ANNOUNCE = /אבדוק|אני\s*בודקת|בודקת\b|מסתכל|פותחת|(?:^|\s)רגע(?:\s|,|$)|שנייה|תכף|במקורות|אחזור\s+אלייך|lo miro|voy a (?:revisar|buscar|ver)|déjame (?:ver|revisar)|un segundo|checking (?:online|the|your)|i will check|let me check/i

describe('FIX 7: announce-before-checking can never come back (build-failing guard)', () => {
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
