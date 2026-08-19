/*
 * Evolution OS — Improvement Bundle (Section 11)
 * ══════════════════════════════════════════════
 * The ONLY thing repair automation is allowed to consume. Never a raw conversation
 * dump. A bundle is a structured, redacted, referenced artifact: failure family +
 * first divergence + root-cause hypotheses + required regressions/holdouts/security/
 * privacy checks + candidate intervention CLASSES (not code) + risk + provenance.
 *
 * Raw user content stays redacted or referenced through authorized storage. The
 * bundle is inert data; it is never interpreted as repository instructions.
 */
import { assertInert } from './redaction'
import type { FailureFamily } from './generalization'
import type { FailureLayer, RootCauseStatus } from './failureTaxonomy'
import type { Signal } from './signals'

export type Severity = 'P0' | 'P1' | 'P2' | 'P3'

export interface RootCauseHypothesis {
  hypothesis: string
  status: RootCauseStatus
  supportingEvidenceRefs: string[]
  contradictingEvidenceRefs: string[]
  falsificationTest: string
}

export interface ImprovementBundle {
  bundleVersion: string
  bundleId: string
  failureFamilyId: string
  title: string
  domain: string
  severity: Severity
  frequencyEstimate: number
  confidence: number
  representativeTraceRefs: string[]
  successfulControlTraceRefs: string[]
  counterexampleRefs: string[]
  firstDivergence: { layer: FailureLayer; evidenceRefs: string[] }
  rootCauseHypotheses: RootCauseHypothesis[]
  generalizedFailureRule: string
  affectedDimensions: string[]
  unaffectedInvariants: string[]
  requiredRegressions: string[]
  requiredHoldoutFamilies: string[]
  requiredSecurityChecks: string[]
  requiredPrivacyChecks: string[]
  candidateInterventionClasses: string[]
  risk: { blastRadius: string; reversibility: string; dataRisk: string; securityRisk: string }
  provenance: { createdAt: string; sourceEventCount: number; redactionStatus: string; pipelineVersion: string }
}

export const BUNDLE_VERSION = '1.0.0'
export const PIPELINE_VERSION = 'evolution-os-slice-1'

/** Candidate intervention CLASSES (Section 12) — mechanisms, never code. The bundle
 *  suggests classes plausibly matching the first-divergence layer; a human/automation
 *  chooses among genuinely different mechanisms. */
export function candidateClassesForLayer(layer: FailureLayer): string[] {
  const map: Partial<Record<FailureLayer, string[]>> = {
    speech_to_text: ['input_normalization', 'entity_resolution', 'confidence_fallback_policy'],
    entity_resolution: ['entity_resolution', 'retrieval_strategy', 'input_normalization', 'schema_change'],
    pronoun_gender_resolution: ['entity_resolution', 'prompt_context_construction', 'data_correction'],
    family_relation_reasoning: ['graph_traversal', 'retrieval_strategy', 'prompt_context_construction'],
    state_commitment: ['transaction_commit_logic', 'tool_contract', 'retry_timeout_policy'],
    confirmation_generation: ['prompt_context_construction', 'transaction_commit_logic'],
    hallucination_unsupported_claim: ['confidence_fallback_policy', 'prompt_context_construction', 'tool_contract'],
    timezone_temporal: ['input_normalization', 'tool_argument_construction'],
    voice_synthesis: ['voice_flow', 'tool_contract'],
    observability_gap: ['better_instrumentation'],
  }
  return map[layer] ?? ['better_instrumentation', 'prompt_context_construction']
}

export interface BundleInput {
  bundleId: string
  title: string
  domain: string
  severity: Severity
  frequencyEstimate: number
  confidence: number
  family: FailureFamily
  firstDivergenceLayer: FailureLayer
  signals: Signal[]
  representativeTraceRefs: string[]
  controlTraceRefs: string[]
  createdAt: string
  hypotheses: RootCauseHypothesis[]
}

export function buildBundle(inp: BundleInput): ImprovementBundle {
  const mustFix = inp.family.cases.filter(c => c.polarity === 'must_fix').map(c => c.caseId)
  const mustPreserve = inp.family.cases.filter(c => c.polarity === 'must_preserve').map(c => c.caseId)

  const bundle: ImprovementBundle = {
    bundleVersion: BUNDLE_VERSION,
    bundleId: inp.bundleId,
    failureFamilyId: inp.family.familyId,
    title: inp.title,
    domain: inp.domain,
    severity: inp.severity,
    frequencyEstimate: inp.frequencyEstimate,
    confidence: inp.confidence,
    representativeTraceRefs: inp.representativeTraceRefs,
    successfulControlTraceRefs: inp.controlTraceRefs,
    counterexampleRefs: mustPreserve,
    firstDivergence: { layer: inp.firstDivergenceLayer, evidenceRefs: inp.signals.map(s => `${s.kind}@${s.turnId}`) },
    rootCauseHypotheses: inp.hypotheses,
    generalizedFailureRule: inp.family.generalizedRule,
    affectedDimensions: inp.family.affectedDimensions,
    unaffectedInvariants: inp.family.unaffectedInvariants,
    requiredRegressions: mustFix,
    requiredHoldoutFamilies: [inp.family.familyId],
    requiredSecurityChecks: ['prompt_injection_inert', 'no_secret_in_evidence', 'no_cross_user_leak'],
    requiredPrivacyChecks: ['pii_redacted', 'no_raw_audio', 'retention_bounded'],
    candidateInterventionClasses: candidateClassesForLayer(inp.firstDivergenceLayer),
    risk: {
      blastRadius: inp.severity === 'P0' ? 'high' : inp.severity === 'P1' ? 'medium' : 'low',
      reversibility: 'feature_flagged_reversible',
      dataRisk: inp.domain === 'family' || inp.domain === 'memory' ? 'knowledge_mutation_possible' : 'low',
      securityRisk: 'evidence_is_inert_data',
    },
    provenance: {
      createdAt: inp.createdAt,
      sourceEventCount: inp.representativeTraceRefs.length + inp.controlTraceRefs.length,
      redactionStatus: 'redacted',
      pipelineVersion: PIPELINE_VERSION,
    },
  }
  return assertInert(bundle)
}
