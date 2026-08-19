/**
 * Regression: "relation between X and Martita" must resolve when she is named
 * "מרתה" (Marta), the everyday spelling of her canonical "מרטיטה" (Martita).
 *
 * Ground truth — knowledge/family_data.json / family_graph.json:
 *   Martita (מרטיטה, female, matriarch) — aliases include אבו / Abu / Abuela / מרתה.
 *   Ofir (אופיר, female) — granddaughter (daughter of Mor). So Martita is Ofir's
 *   grandmother ⟺ Ofir is Martita's granddaughter.
 *
 * Before the fix: "מה הקשר בין אופיר למרתה" returned "לא יודעת מה הקשר…" because
 * findNode('מרתה') was null (מרתה was not a recognized alias), so the relation-between
 * handler bailed. The canonical "מרטיטה" and alias "אבו" already worked.
 *
 * First divergence: name resolution of "מרתה" (not the relation-between logic).
 * Deterministic, pure-local path — no LLM. Feminine forms for Ofir/Martita preserved.
 */
import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { findNode } from './familyGraph'

describe('relation-between resolves Martita by her everyday name "מרתה"', () => {
  it('findNode("מרתה") resolves to the matriarch (מרטיטה)', () => {
    const node = findNode('מרתה')
    expect(node).not.toBeNull()
    expect(node!.hebrew).toBe('מרטיטה')
  })

  it('"מה הקשר בין אופיר למרתה" → grandmother/granddaughter, not "don\'t know"', () => {
    const answer = tryGroundedAnswer('מה הקשר בין אופיר למרתה')
    expect(answer).not.toBeNull()
    expect(answer).not.toMatch(/לא יודעת/)
    expect(answer).toContain('אופיר')
    // Martita is Ofir's grandmother — feminine "סבתא" (never masculine "סבא").
    expect(answer).toContain('סבתא')
    expect(answer).not.toMatch(/(?<![א-ת])סבא(?![א-ת])/)
  })

  it('the canonical spelling still works (non-regression): "…אופיר למרטיטה"', () => {
    const answer = tryGroundedAnswer('מה הקשר בין אופיר למרטיטה')
    expect(answer).not.toBeNull()
    expect(answer).not.toMatch(/לא יודעת/)
    expect(answer).toContain('סבתא')
  })

  it('"מה הקשר בין מור למרתה" → mother (Martita is Mor\'s mother)', () => {
    const answer = tryGroundedAnswer('מה הקשר בין מור למרתה')
    expect(answer).not.toBeNull()
    expect(answer).not.toMatch(/לא יודעת/)
    expect(answer).toContain('אמא')
  })
})
