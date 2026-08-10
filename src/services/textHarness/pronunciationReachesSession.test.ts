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
import { buildPronunciationGuidance } from '../liveInstructions'

const NOW = Date.parse('2026-08-10T09:00:00.000Z')

describe('pronunciation guidance reaches the live session', () => {
  it('the Spanish-reading rule + the seeded Latin spellings reach the session instructions', () => {
    const { instructions } = buildHarnessSession(NOW)
    expect(instructions).toContain('# How to Say Names (Pronunciation)')
    expect(instructions).toMatch(/READING ITS LATIN SPELLING AS SPANISH/i)
    expect(instructions).toContain('לאו (Leo) — Spanish: leo')
    expect(instructions).toContain('איילון (Ayalon) — Spanish: eilon')
  })

  it('the guidance the harness sees is byte-identical to the voice session.update', () => {
    const voice = buildSessionUpdate(NOW) as { session: { instructions: string } }
    const { instructions } = buildHarnessSession(NOW)
    // same payload → no divergence between the harness and what Martita talks to
    expect(instructions).toBe(voice.session.instructions)
    // and it really carries the projected pronunciation lines
    const guidance = buildPronunciationGuidance()
    expect(guidance.length).toBeGreaterThan(0)
    expect(instructions).toContain(guidance)
  })
})
