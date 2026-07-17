/**
 * VOICE ↔ TYPED PARITY (referability + controller).
 * ══════════════════════════════════════════════════
 * Mandate: "typed and voice input must reach the SAME cognitive controller — a fix
 * in one modality must hold in the other." The referability fix (0.113.0) added a
 * calendar-focus guard so a pronoun ("תבטלי אותה") stays RAW and binds to the focused
 * event. This asserts BOTH voice paths (pipeline STT + Realtime) match the typed path:
 *   • route through ExecutiveCognitiveController.handleTurn,
 *   • seed from the shared cognitiveRuntimeStateRef (so focus/memory persist), and
 *   • guard the pronoun/follow-up rewrite with a calendar-focus check.
 *
 * Source-grep level (MEDIUM evidence) — it catches a future edit that lets one
 * modality drift from the other. The runtime behaviour itself is proven by
 * calendarReferability + calendarCrudGeneralization (CODE). Physical voice
 * audibility/latency remains PHYSICAL_DEVICE-only (not asserted here).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SRC = readFileSync(resolve(__dirname, 'index.tsx'), 'utf-8')

describe('voice ↔ typed parity', () => {
  it('all THREE input paths (typed + pipeline voice + realtime voice) route through the controller', () => {
    const calls = (SRC.match(/ExecutiveCognitiveController\.handleTurn/g) ?? []).length
    expect(calls).toBeGreaterThanOrEqual(3)
  })

  it('the two voice paths seed from the shared cognitiveRuntimeStateRef (focus/memory persist)', () => {
    const seeds = (SRC.match(/\{\s*\.\.\.cognitiveRuntimeStateRef\.current,\s*conv:\s*conversationOSRef\.current\s*\}/g) ?? []).length
    expect(seeds).toBeGreaterThanOrEqual(3) // typed + pipeline + realtime
  })

  it('each input path guards the pronoun/follow-up rewrite with a calendar-focus check', () => {
    // typed → hasCalFocus, pipeline voice → vHasCalFocus, realtime voice → rtHasCalFocus.
    expect(SRC).toContain('hasCalFocus')
    expect(SRC).toContain('vHasCalFocus')
    expect(SRC).toContain('rtHasCalFocus')
    // No follow-up rewrite may assign the resolved text without a focus guard.
    const unguarded = SRC.match(/wasFollowUp\)\s*\w+\s*=\s*\w+\.resolved/g) ?? []
    expect(unguarded, `unguarded follow-up rewrite(s): ${unguarded.join(' | ')}`).toEqual([])
  })

  it('voice answers are spoken from the controller result (not a separate voice brain)', () => {
    // pipeline path speaks result.speak; realtime voices the brain's result.
    expect(SRC).toContain('await speakVoiceMode(result.speak)')
  })
})
