/*
 * Evolution OS — failure taxonomy & first-divergence (Sections 8–9)
 * ═════════════════════════════════════════════════════════════════
 * A verified failure is classified at the EARLIEST failing layer, not by its
 * visible symptom. "Wrong calendar answer" is a symptom; the mechanism might be
 * STT mangling a name, a timezone shift, a stale read, a commit that never landed,
 * or a confirmation built from stale state. This module names the layers and gives
 * a deterministic first-divergence localizer over a trace envelope + expectations.
 */

/** Ordered from earliest pipeline layer to latest. Order == causal precedence. */
export const FAILURE_LAYERS = [
  'input_capture', 'voice_activity_detection', 'speech_to_text', 'language_locale_detection',
  'timezone_temporal', 'input_normalization', 'entity_resolution', 'pronoun_gender_resolution',
  'intent_classification', 'routing', 'context_assembly', 'memory_retrieval',
  'memory_scope_authorization', 'family_graph_retrieval', 'family_relation_reasoning',
  'online_retrieval', 'freshness_validation', 'tool_selection', 'tool_argument_construction',
  'tool_authorization', 'tool_execution', 'state_commitment', 'confirmation_generation',
  'response_reasoning', 'hallucination_unsupported_claim', 'voice_synthesis', 'ui_presentation',
  'mobile_lifecycle', 'offline_queue_sync', 'network_recovery', 'privacy_consent',
  'security_prompt_injection', 'observability_gap', 'evaluation_gap', 'unknown',
] as const

export type FailureLayer = typeof FAILURE_LAYERS[number]

export type RootCauseStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'

export function layerIndex(layer: FailureLayer): number {
  const i = FAILURE_LAYERS.indexOf(layer)
  return i < 0 ? FAILURE_LAYERS.length - 1 : i
}

/** The earliest (lowest-index) layer among candidates — causal precedence wins. */
export function earliestLayer(layers: FailureLayer[]): FailureLayer {
  if (!layers.length) return 'unknown'
  return layers.reduce((a, b) => (layerIndex(b) < layerIndex(a) ? b : a))
}

export interface DivergenceObservation {
  layer: FailureLayer
  expected: string
  actual: string
  evidence: string
}

export interface FirstDivergence {
  layer: FailureLayer
  observation: DivergenceObservation
  laterMasked: DivergenceObservation[] // later-layer symptoms this one likely caused
}

/**
 * Given per-layer observations where expected≠actual, return the earliest as the
 * first divergence and list later ones as (probably) downstream symptoms. This is
 * the "don't start from the final answer" rule made mechanical.
 */
export function firstDivergence(observations: DivergenceObservation[]): FirstDivergence | null {
  const diffs = observations.filter(o => o.expected !== o.actual)
  if (!diffs.length) return null
  const sorted = [...diffs].sort((a, b) => layerIndex(a.layer) - layerIndex(b.layer))
  const [first, ...rest] = sorted
  return { layer: first!.layer, observation: first!, laterMasked: rest }
}
