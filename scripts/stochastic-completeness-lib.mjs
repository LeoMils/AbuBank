/*
 * stochastic-completeness-lib.mjs — PURE stochastic completeness oracle. (C6 / §14)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The A5 sampling plan can pass by omission. This derives the stochastic-exposed claim universe from the
 * authoritative Required Claim Set and proves EVERY model/realtime/provider-exposed claim resolves to
 * exactly one of: SAMPLING_REQUIRED (with a pre-registered plan entry) or
 * DETERMINISTICALLY_CLOSED_WITH_PROOF. Anything else is STOCHASTIC_CLAIM_UNSAMPLED → BLOCK. No I/O.
 */

// Which required claims touch a stochastic dependency (LLM / realtime / STT / TTS / search-synthesis /
// semantic-judge / probabilistic-classifier / stochastic-fallback). Derived from claim capability, not
// hand-waved: a claim NOT listed here is asserted deterministic and must carry deterministic proof if a
// plan entry marks it DETERMINISTICALLY_CLOSED.
export const STOCHASTIC_CAPABILITIES = new Set([
  'calendar-write-readback', 'whatsapp-message-generation', 'current-info-freshness',
  'stt-tts-roundtrip', 'tool-call-ordering', 'escape-regression-closure',
])

export function classifyClaimStochastic(claim) {
  return STOCHASTIC_CAPABILITIES.has(claim.capability)
}

/**
 * @param claimSet the authoritative Required Claim Set (REQUIRED_CLAIM_SET.json → claims)
 * @param plan the pre-registered plan (STOCHASTIC_PLAN.json → { resolutions: {claimId: {mode, ...}} })
 * @returns derived stochastic completeness state
 */
export function deriveStochasticState(claimSet, plan) {
  const resolutions = plan?.resolutions ?? {}
  const stochasticExposed = (claimSet ?? []).filter(classifyClaimStochastic)

  const unsampled = []
  const samplingRequired = []
  const deterministicallyClosed = []

  for (const claim of stochasticExposed) {
    const r = resolutions[claim.id]
    if (!r || !['SAMPLING_REQUIRED', 'DETERMINISTICALLY_CLOSED_WITH_PROOF'].includes(r.mode)) {
      unsampled.push(claim.id); continue
    }
    if (r.mode === 'SAMPLING_REQUIRED') {
      // A SAMPLING_REQUIRED resolution must carry a complete pre-registered policy (no run-until-green).
      const complete = r.N != null && r.passThreshold != null && r.criticalSingleFailureRule && r.independencePolicy && r.maxProviderCallEnvelope != null
      if (!complete) { unsampled.push(claim.id); continue }
      samplingRequired.push(claim.id)
    } else {
      if (!r.deterministicProof) { unsampled.push(claim.id); continue }
      deterministicallyClosed.push(claim.id)
    }
  }

  return {
    STOCHASTIC_EXPOSED_CLAIMS_TOTAL: stochasticExposed.length,
    SAMPLING_REQUIRED: samplingRequired.length,
    DETERMINISTICALLY_CLOSED: deterministicallyClosed.length,
    SAMPLING_PLAN_ENTRIES: Object.keys(resolutions).length,
    UNSAMPLED_REQUIRED_CLAIMS: unsampled.length,
    unsampled, samplingRequired, deterministicallyClosed,
    ok: unsampled.length === 0,
  }
}
