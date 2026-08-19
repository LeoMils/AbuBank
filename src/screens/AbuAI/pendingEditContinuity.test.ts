/*
 * PENDING-DRAFT EDIT continuity — data-integrity regression.
 * ═════════════════════════════════════════════════════════════
 * Proven bug (calendar-object audit): while a calendar draft is pending, the
 * default-on Conversation Engine V2 classified imperative edits ("תשנה לעשר")
 * and "לא, <value>" corrections as a side_question → general LLM, leaving the
 * draft FROZEN — so a later "כן" saved the STALE value. These must now classify
 * as `field_answer` (→ updateCreate) so the edit lands on the draft.
 */
import { describe, it, expect } from 'vitest'
import { classifySignalV2, reduceV2 } from './conversationEngineV2'

describe('PENDING EDIT — edits/corrections update the draft, never punt to the LLM', () => {
  const pendingPhases = ['collecting', 'confirming'] as const

  for (const phase of pendingPhases) {
    it(`[${phase}] "תשנה לעשר" (imperative time edit) → field_answer → update`, () => {
      const sig = classifySignalV2('תשנה לעשר', phase)
      expect(sig).toBe('field_answer')
      expect(reduceV2(phase, sig).action).toBe('update')
    })

    it(`[${phase}] "לא, בשבוע הבא" (date correction) → field_answer → update`, () => {
      const sig = classifySignalV2('לא, בשבוע הבא', phase)
      expect(sig).toBe('field_answer')
      expect(reduceV2(phase, sig).action).toBe('update')
    })

    it(`[${phase}] "תוסיפי גם את רפי" (add attendee) → field_answer, keeps pending`, () => {
      const sig = classifySignalV2('תוסיפי גם את רפי', phase)
      expect(sig).toBe('field_answer')
      expect(reduceV2(phase, sig).keepsPending).toBe(true)
    })
  }

  it('a genuine side-question still stays a side_question (edit detector is precise)', () => {
    expect(classifySignalV2('מי זאת מור?', 'confirming')).toBe('side_question')
  })

  it('an emotional statement mid-create is NOT treated as an edit', () => {
    // "אני מתגעגעת לפאפי" must not become a draft field edit.
    expect(classifySignalV2('אני מתגעגעת לפאפי', 'confirming')).not.toBe('field_answer')
  })

  it('explicit cancel still cancels; "כן" still confirms — edit detector does not shadow them', () => {
    expect(classifySignalV2('בטלי את זה', 'confirming')).toBe('explicit_cancel')
    expect(classifySignalV2('כן', 'confirming')).toBe('confirm')
  })
})
