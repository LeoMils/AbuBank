/*
 * TEMPORAL FRESHNESS ORACLE — GROUNDED ≠ CURRENT. (§16 acceptance oracle, owner correction #2)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * A stale-but-sourced answer must NOT satisfy a CURRENT-information claim. For a query carrying
 * temporal intent (current / latest / last / today / now / this week / most recent, + HE/ES), the
 * acceptance evidence must prove BOTH:
 *   A. factual grounding (a source supports it), AND
 *   B. temporal relevance/freshness appropriate to the query.
 * The "who won the LAST super bowl → Seattle Seahawks" result was grounded but STALE → a real
 * current-info FAIL, not a benign limitation.
 */

/** Temporal-intent markers (EN + HE + ES). Presence ⇒ the answer must be current, not merely sourced. */
export const TEMPORAL_MARKERS = /\b(current|latest|last|today|now|this\s+week|this\s+month|most\s+recent|right\s+now|nowadays)\b|עכשיו|היום|כרגע|האחרון|האחרונה|עדכני|השבוע|הנוכחי|הנוכחית|actual|hoy|ahora|[uú]ltim[oa]|reciente|de\s+hoy/i

export function isTemporalQuery(query: string): boolean {
  return TEMPORAL_MARKERS.test(query)
}

export type FreshnessVerdict =
  | 'NOT_TEMPORAL'        // no temporal intent — grounding alone can satisfy the claim
  | 'UNGROUNDED'          // temporal but no answer/source — honest decline (separate PASS), not current
  | 'FRESH'              // temporal + grounded + temporally relevant
  | 'STALE'             // temporal + grounded but NOT temporally relevant → current-info FAIL

export interface FreshnessInput {
  query: string
  /** Did the path produce a grounded answer (vs an honest decline)? */
  answered: boolean
  /** ISO dates of the supporting sources/evidence, if known. */
  sourceDatesIso?: string[]
  /** Reference "now" (ISO) — evidence within `maxAgeDays` of this is considered fresh. */
  nowIso: string
  /** Max evidence age (days) for the query's temporal class. Default 30. */
  maxAgeDays?: number
  /** Known-stale answer markers for this query (e.g. a superseded office-holder / result). If the
   *  answer matches one, it is STALE regardless of source date (the freshness backstop). */
  answerContainsKnownStale?: boolean
}

export interface FreshnessResult {
  temporalIntent: boolean
  freshnessRequired: boolean
  verdict: FreshnessVerdict
  reason: string
  /** True ONLY when a temporal claim is fully satisfied (grounded AND fresh), or it is non-temporal. */
  satisfiesCurrentInfoClaim: boolean
}

/**
 * Evaluate whether a result satisfies a CURRENT-information claim under freshness semantics.
 *  - Non-temporal query → grounding decides (freshness not required).
 *  - Temporal + not answered → UNGROUNDED (honest decline is a separate PASS, NOT a current-info PASS).
 *  - Temporal + answered + known-stale OR all sources older than maxAgeDays → STALE (current-info FAIL).
 *  - Temporal + answered + fresh evidence → FRESH.
 */
export function evaluateFreshness(input: FreshnessInput): FreshnessResult {
  const temporalIntent = isTemporalQuery(input.query)
  if (!temporalIntent) {
    return { temporalIntent: false, freshnessRequired: false, verdict: 'NOT_TEMPORAL', reason: 'no temporal intent — grounding suffices', satisfiesCurrentInfoClaim: input.answered }
  }
  if (!input.answered) {
    return { temporalIntent: true, freshnessRequired: true, verdict: 'UNGROUNDED', reason: 'temporal query with no grounded answer — honest decline (separate PASS), NOT a current-info PASS', satisfiesCurrentInfoClaim: false }
  }
  if (input.answerContainsKnownStale) {
    return { temporalIntent: true, freshnessRequired: true, verdict: 'STALE', reason: 'answer matches a known-superseded value — grounded but NOT current (current-info FAIL)', satisfiesCurrentInfoClaim: false }
  }
  const maxAgeDays = input.maxAgeDays ?? 30
  const now = Date.parse(input.nowIso)
  const dates = (input.sourceDatesIso ?? []).map((d) => Date.parse(d)).filter((n) => !Number.isNaN(n))
  if (dates.length > 0) {
    const freshest = Math.max(...dates)
    const ageDays = (now - freshest) / 86_400_000
    if (ageDays > maxAgeDays) {
      return { temporalIntent: true, freshnessRequired: true, verdict: 'STALE', reason: `freshest source is ${Math.round(ageDays)}d old > ${maxAgeDays}d — stale for a temporal query`, satisfiesCurrentInfoClaim: false }
    }
    return { temporalIntent: true, freshnessRequired: true, verdict: 'FRESH', reason: `freshest source ${Math.round(ageDays)}d old ≤ ${maxAgeDays}d`, satisfiesCurrentInfoClaim: true }
  }
  // Temporal + answered but NO source dates AND not flagged stale: freshness UNVERIFIED — cannot
  // certify a current-info claim on unproven freshness (fail closed for the claim).
  return { temporalIntent: true, freshnessRequired: true, verdict: 'STALE', reason: 'temporal query answered but source freshness is UNVERIFIED — cannot certify current-info without a freshness proof', satisfiesCurrentInfoClaim: false }
}
