/*
 * Confidence Guard (Phase 7)
 * ══════════════════════════
 * Decides whether an answer is confident enough to state as fact, or must be
 * softened / clarified. Composes the Meta Reasoner's confidence + domain.
 */
import type { MetaResult } from './metaReasoner'

export interface ConfidenceVerdict { confident: boolean; block: boolean; reason: string }

const HIGH = 0.85
const FLOOR = 0.5

export function assessConfidence(meta: MetaResult): ConfidenceVerdict {
  // A family relation we couldn't split into a directional pair must not be
  // answered as a confident fact.
  if (meta.domain === 'family' && (!meta.subject || !meta.target) && meta.confidence < HIGH) {
    return { confident: false, block: true, reason: 'relation not resolved to a directional pair — do not guess' }
  }
  // A calendar create missing the core fields should clarify, not assert.
  if (meta.intent === 'calendar_create' && meta.shouldClarify) {
    return { confident: false, block: false, reason: 'incomplete event — ask the one missing field' }
  }
  if (meta.confidence < FLOOR) {
    return { confident: false, block: true, reason: `confidence ${meta.confidence} below floor` }
  }
  if (meta.confidence < HIGH) {
    return { confident: false, block: false, reason: `medium confidence ${meta.confidence} — soften` }
  }
  return { confident: true, block: false, reason: 'high confidence' }
}
