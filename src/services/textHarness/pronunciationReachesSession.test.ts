/*
 * pronunciationReachesSession.test.ts — harness scenario: the name-pronunciation
 * guidance actually reaches the SESSION the wire sends, not just some helper.
 * ════════════════════════════════════════════════════════════════════════════
 * A pronunciation stored on a person in knowledge/family_data.json is only useful
 * if it lands in the instructions the Realtime model is configured with. The harness
 * reads its session from buildHarnessSession(now), which pulls instructions straight
 * out of buildSessionUpdate(now) — the exact session.update payload liveSession.ts
 * sends over the data channel. So asserting the guidance is in harness.instructions
 * proves it reaches the live session (and, via the anti-divergence seam, the voice
 * path too). A text harness cannot assert TTS phonetics; it CAN assert the model is
 * instructed how to pronounce the name — which is the deterministic, testable claim.
 */
import { describe, it, expect } from 'vitest'
import { buildHarnessSession } from './session'
import { buildSessionUpdate } from '../liveSession'
import { REALTIME_INSTRUCTIONS_MAX } from '../liveInstructions'

const NOW = Date.parse('2026-08-10T09:00:00.000Z')

describe('pronunciation guidance reaches the live session', () => {
  it('the Spanish-reading RULE reaches the session instructions (the enumeration lives behind people_lookup)', () => {
    const { instructions } = buildHarnessSession(NOW)
    expect(instructions).toContain('# How to Say Names (Pronunciation)')
    expect(instructions).toMatch(/READING ITS LATIN SPELLING AS SPANISH/i)
    // The per-person enumeration is NO LONGER in the prompt — it bloated the
    // instructions past the provider cap (string_above_max_length on device). Each
    // person's spoken form travels with people_lookup; the rule covers all of them.
    expect(instructions).not.toContain('לאו (Leo) — Spanish: leo')
    expect(instructions).not.toMatch(/— Spanish: \w+/)
  })

  it('the guidance the harness sees is byte-identical to the voice session.update, and within the provider cap', () => {
    const voice = buildSessionUpdate(NOW) as { session: { instructions: string } }
    const { instructions } = buildHarnessSession(NOW)
    // same payload → no divergence between the harness and what Martita talks to
    expect(instructions).toBe(voice.session.instructions)
    // and the shared payload fits the provider limit (voice connects, does not die)
    expect(instructions.length).toBeLessThanOrEqual(REALTIME_INSTRUCTIONS_MAX)
  })
})
