/*
 * Evolution OS — release safety & rollback (Section 17, Scenario H)
 * ═════════════════════════════════════════════════════════════════
 * Every behavior-changing artifact is versioned and reversible. A release ALWAYS
 * retains a known-good predecessor. Offline evaluation is necessary but not
 * sufficient: if a promoted candidate breaches a predefined live SLO, the system
 * recommends (or, for explicitly-safe predefined thresholds, executes) a rollback
 * to the known-good version. Production promotion itself is human-approved and is
 * NOT performed here.
 */

export type ReleaseStage = 'observe_only' | 'shadow' | 'preview' | 'canary' | 'production' | 'rolled_back'

export interface ReleaseVersion {
  versionId: string
  artifactKind: string        // 'prompt' | 'route' | 'tool_schema' | ...
  stage: ReleaseStage
  createdAt: string
  flag: string                // feature flag guarding it
  knownGood: boolean          // eligible rollback target
  evalRecommendation?: 'ADVANCE' | 'REJECT' | 'NO_SAFE_WINNER'
}

export interface SloThresholds {
  maxUnsupportedClaimRate: number
  maxUndoRate: number
  maxP99LatencyMs: number
  /** invariants that trigger IMMEDIATE auto-rollback if observed even once. */
  zeroToleranceInvariants: string[]
}

export const DEFAULT_SLO: SloThresholds = {
  maxUnsupportedClaimRate: 0.02,
  maxUndoRate: 0.05,
  maxP99LatencyMs: 6_000,
  zeroToleranceInvariants: ['cross_user_leak', 'fabricated_confirmation', 'silent_data_loss', 'secret_leak'],
}

export interface LiveMetrics {
  unsupportedClaimRate: number
  undoRate: number
  p99LatencyMs: number
  invariantViolationsObserved: string[]
}

export type RollbackDecision =
  | { action: 'hold'; reasons: [] }
  | { action: 'auto_rollback'; reasons: string[]; target: string }
  | { action: 'recommend_rollback'; reasons: string[]; target: string }

/**
 * Given live metrics for the current release and the known-good target, decide.
 * Zero-tolerance invariant → auto_rollback. Threshold breaches → recommend_rollback
 * (a human confirms non-invariant rollbacks). No target → hold + surface (can't
 * safely roll back to nothing).
 */
export function evaluateRollback(live: LiveMetrics, slo: SloThresholds, knownGoodVersionId: string | null): RollbackDecision {
  const invariantHits = live.invariantViolationsObserved.filter(v => slo.zeroToleranceInvariants.includes(v))
  const thresholdReasons: string[] = []
  if (live.unsupportedClaimRate > slo.maxUnsupportedClaimRate) thresholdReasons.push(`unsupported-claim ${live.unsupportedClaimRate} > ${slo.maxUnsupportedClaimRate}`)
  if (live.undoRate > slo.maxUndoRate) thresholdReasons.push(`undo ${live.undoRate} > ${slo.maxUndoRate}`)
  if (live.p99LatencyMs > slo.maxP99LatencyMs) thresholdReasons.push(`p99 ${live.p99LatencyMs}ms > ${slo.maxP99LatencyMs}ms`)

  if (!knownGoodVersionId) {
    const reasons = [...invariantHits.map(v => `invariant:${v}`), ...thresholdReasons]
    return reasons.length ? { action: 'recommend_rollback', reasons, target: '' } as RollbackDecision : { action: 'hold', reasons: [] }
  }
  if (invariantHits.length) {
    return { action: 'auto_rollback', reasons: invariantHits.map(v => `zero-tolerance invariant: ${v}`), target: knownGoodVersionId }
  }
  if (thresholdReasons.length) {
    return { action: 'recommend_rollback', reasons: thresholdReasons, target: knownGoodVersionId }
  }
  return { action: 'hold', reasons: [] }
}

export class ReleaseRegistry {
  private versions: ReleaseVersion[] = []
  register(v: ReleaseVersion): void { this.versions.push(v) }
  /** The most recent known-good version (the rollback target). */
  knownGood(): ReleaseVersion | null {
    for (let i = this.versions.length - 1; i >= 0; i--) { const v = this.versions[i]!; if (v.knownGood && v.stage !== 'rolled_back') return v }
    return null
  }
  current(): ReleaseVersion | null { return this.versions[this.versions.length - 1] ?? null }
  rollback(toVersionId: string, at: string): ReleaseVersion | null {
    const cur = this.current()
    if (cur && cur.versionId !== toVersionId) { cur.stage = 'rolled_back' }
    const target = this.versions.find(v => v.versionId === toVersionId) ?? null
    if (target) this.register({ ...target, stage: 'production', createdAt: at })
    return target
  }
  all(): ReleaseVersion[] { return [...this.versions] }
}
