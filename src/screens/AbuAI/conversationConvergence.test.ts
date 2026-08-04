/*
 * CONVERSATION CONVERGENCE — adversarial INTEGRATION proof for three scorecard rows,
 * each driving the REAL deterministic module (no second brain):
 *  • DIALOGUE-QUALITY    → dialogueManager.guardDialogue / acknowledgeCorrection
 *  • LONG-SESSION-CONTEXT→ contextResolver.resolveFollowUp (bounded continuity)
 *  • HEBREW-CORPUS       → correctionVerification.isFactualCorrection / shouldReverifyOnline
 * Independent verifiers live in existing eval/unit suites; this file adds the
 * row-specific adversarial assertions + is mutation-proven (see failure-corpus).
 */
import { describe, it, expect } from 'vitest'
import { guardDialogue, acknowledgeCorrection } from './dialogueManager'
import { resolveFollowUp } from './contextResolver'
import { isFactualCorrection, shouldReverifyOnline } from './correctionVerification'

// ─── DIALOGUE-QUALITY — non-repetitive adult Hebrew, semantic loop-breaking ───
describe('DIALOGUE-QUALITY — repetition/loop guard breaks stuck lines, never real answers', () => {
  it('two clarifications in a row → blocked + escalated (never a phone-tree menu)', () => {
    const d = guardDialogue('באיזו שעה?', ['באיזה יום?'])
    expect(d.allow).toBe(false)
    expect(d.replacement).toBeTruthy()
    expect(d.replacement!).not.toMatch(/פגישה,\s*יומן,\s*משפחה/) // no forced menu
  })
  it('repeated apology → replaced with a forward move', () => {
    const d = guardDialogue('סליחה, טעיתי', ['מצטערת מאוד'])
    expect(d.allow).toBe(false)
    expect(d.reason).toBe('repeated apology')
  })
  it('a repeated FACTUAL answer is NOT suppressed (two questions, one true answer)', () => {
    expect(guardDialogue('מור', ['מור']).allow).toBe(true) // "mother of Ofir?"→מור, "mother of Adar?"→מור
  })
  it('acknowledgeCorrection is SPECIFIC (quotes the correction), never a generic apology', () => {
    const ack = acknowledgeCorrection('אמא של אדר היא מור')
    expect(ack).toContain('תיקנת אותי')
    expect(ack).toContain('אמא של אדר היא מור')
    expect(ack).not.toMatch(/^סליחה\.?$/)
  })
})

// ─── LONG-SESSION-CONTEXT — bounded follow-up continuity (recency/provenance) ─
describe('LONG-SESSION-CONTEXT — bounded follow-up resolution preserves recency + draft', () => {
  it('a bare temporal fragment "מחר?" continues to a schedule read', () => {
    const r = resolveFollowUp('מחר?', [])
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי מחר?')
  })
  it('a long (>4-word) sentence is NOT hijacked as a follow-up (bounded)', () => {
    const r = resolveFollowUp('אני רוצה לדבר על משהו אחר לגמרי היום', [])
    expect(r.wasFollowUp).toBe(false)
    expect(r.resolved).toBe('אני רוצה לדבר על משהו אחר לגמרי היום')
  })
  it('while a create draft is pending, a bare "מחר" is the DAY SLOT — not stolen into a read', () => {
    const r = resolveFollowUp('מחר', [], { pendingCreate: true })
    expect(r.wasFollowUp).toBe(false)   // preserves the pending draft, not a calendar read
    expect(r.resolved).toBe('מחר')
  })
})

// ─── HEBREW-CORPUS — factual-correction detection + re-verify routing ─────────
describe('HEBREW-CORPUS — Hebrew factual corrections detected; non-corrections are not', () => {
  it('detects factual corrections across phrasings', () => {
    for (const u of ['טעית', 'זה לא נכון', 'בעצם לא', 'לא מדויק', 'זה שגוי']) {
      expect(isFactualCorrection(u), u).toBe(true)
    }
  })
  it('does NOT flag a thank-you / acceptance as a correction', () => {
    for (const u of ['תודה רבה', 'כן בסדר', 'מעולה']) expect(isFactualCorrection(u), u).toBe(false)
  })
  it('re-verify only when the prior focus was ONLINE and the user corrects it (never guesses)', () => {
    expect(shouldReverifyOnline('טעית', { kind: 'online', label: 'מזג אוויר מחר' })).toEqual({ reverify: true, topic: 'מזג אוויר מחר' })
    expect(shouldReverifyOnline('טעית', { kind: 'calendar_event', label: 'x' }).reverify).toBe(false)
    expect(shouldReverifyOnline('תודה', { kind: 'online', label: 'x' }).reverify).toBe(false)
  })
})
