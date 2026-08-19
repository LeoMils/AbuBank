/*
 * Evolution OS — case state machine (Section 5)
 * ═════════════════════════════════════════════
 * Every observed issue is a CASE that advances through a versioned, append-only
 * state machine. No component may skip a state. The system that PROPOSES a change
 * is never the only system that APPROVES it (governance separation, Section 3D):
 * transitions past CANDIDATES_EVALUATED toward DEPLOYED require a human actor.
 *
 * Every transition records actor, timestamp, evidence, reason, input/output
 * artifact versions, confidence, applicable policy, and rollback target.
 */

export const CASE_STATES = [
  'OBSERVED', 'SIGNAL_CLASSIFIED', 'EVIDENCE_VALIDATED', 'PRIVACY_REDACTED',
  'DUPLICATE_CHECKED', 'REPRODUCTION_ATTEMPTED', 'REPRODUCED', 'NOT_REPRODUCED',
  'FIRST_DIVERGENCE_IDENTIFIED', 'ROOT_CAUSE_SUPPORTED', 'ROOT_CAUSE_UNKNOWN',
  'FAILURE_FAMILY_GENERALIZED', 'REGRESSIONS_GENERATED', 'CANDIDATES_PROPOSED',
  'CANDIDATES_EVALUATED', 'WINNER_SELECTED', 'NO_SAFE_WINNER', 'SHADOW_VALIDATED',
  'PREVIEW_VALIDATED', 'CANARY_READY', 'HUMAN_APPROVED', 'DEPLOYED',
  'POST_DEPLOYMENT_MONITORED', 'CONFIRMED', 'ROLLED_BACK', 'REJECTED',
] as const

export type CaseState = typeof CASE_STATES[number]

/** Allowed transitions. A missing key means terminal. Branches are explicit. */
const TRANSITIONS: Record<CaseState, CaseState[]> = {
  OBSERVED: ['SIGNAL_CLASSIFIED', 'REJECTED'],
  SIGNAL_CLASSIFIED: ['EVIDENCE_VALIDATED', 'REJECTED'],
  EVIDENCE_VALIDATED: ['PRIVACY_REDACTED', 'REJECTED'],
  PRIVACY_REDACTED: ['DUPLICATE_CHECKED', 'REJECTED'],
  DUPLICATE_CHECKED: ['REPRODUCTION_ATTEMPTED', 'REJECTED'],
  REPRODUCTION_ATTEMPTED: ['REPRODUCED', 'NOT_REPRODUCED'],
  NOT_REPRODUCED: ['OBSERVED', 'REJECTED'], // loop back once instrumentation improves
  REPRODUCED: ['FIRST_DIVERGENCE_IDENTIFIED'],
  FIRST_DIVERGENCE_IDENTIFIED: ['ROOT_CAUSE_SUPPORTED', 'ROOT_CAUSE_UNKNOWN'],
  ROOT_CAUSE_UNKNOWN: ['REJECTED', 'OBSERVED'], // "unknown" is acceptable; add instrumentation, revisit
  ROOT_CAUSE_SUPPORTED: ['FAILURE_FAMILY_GENERALIZED'],
  FAILURE_FAMILY_GENERALIZED: ['REGRESSIONS_GENERATED'],
  REGRESSIONS_GENERATED: ['CANDIDATES_PROPOSED'],
  CANDIDATES_PROPOSED: ['CANDIDATES_EVALUATED'],
  CANDIDATES_EVALUATED: ['WINNER_SELECTED', 'NO_SAFE_WINNER'],
  NO_SAFE_WINNER: ['REJECTED', 'REGRESSIONS_GENERATED'],
  WINNER_SELECTED: ['SHADOW_VALIDATED'],
  SHADOW_VALIDATED: ['PREVIEW_VALIDATED', 'ROLLED_BACK'],
  PREVIEW_VALIDATED: ['CANARY_READY', 'ROLLED_BACK'],
  CANARY_READY: ['HUMAN_APPROVED', 'ROLLED_BACK'],
  HUMAN_APPROVED: ['DEPLOYED', 'ROLLED_BACK'],
  DEPLOYED: ['POST_DEPLOYMENT_MONITORED'],
  POST_DEPLOYMENT_MONITORED: ['CONFIRMED', 'ROLLED_BACK'],
  CONFIRMED: [],
  ROLLED_BACK: [],
  REJECTED: [],
}

/** States a non-human actor (Evolution automation) is allowed to REACH. Anything
 *  toward production requires a human — the governance separation is enforced here. */
const HUMAN_ONLY_TARGETS = new Set<CaseState>(['HUMAN_APPROVED', 'DEPLOYED'])

export type Actor =
  | { kind: 'automation'; name: string }
  | { kind: 'human'; name: string }

export interface Transition {
  from: CaseState | null
  to: CaseState
  actor: Actor
  at: string
  reason: string
  evidenceRefs: string[]
  inputArtifactVersions?: Record<string, string>
  outputArtifactVersions?: Record<string, string>
  confidence: number
  policy: string
  rollbackTarget?: string
}

export interface EvolutionCase {
  caseId: string
  domain: string
  title: string
  state: CaseState
  history: Transition[]
  createdAt: string
}

export function createCase(caseId: string, domain: string, title: string, at: string, actor: Actor): EvolutionCase {
  return {
    caseId, domain, title, state: 'OBSERVED', createdAt: at,
    history: [{ from: null, to: 'OBSERVED', actor, at, reason: 'case opened', evidenceRefs: [], confidence: 1, policy: 'observe_only' }],
  }
}

export function canTransition(from: CaseState, to: CaseState): boolean {
  return (TRANSITIONS[from] ?? []).includes(to)
}

export type TransitionResult =
  | { ok: true; case: EvolutionCase }
  | { ok: false; reason: 'illegal_transition' | 'requires_human' }

/**
 * Apply a transition. Rejects illegal edges AND rejects an automation actor trying
 * to reach a human-only state. Returns a NEW case (append-only; never mutates).
 */
export function transition(c: EvolutionCase, to: CaseState, t: Omit<Transition, 'from' | 'to'>): TransitionResult {
  if (!canTransition(c.state, to)) return { ok: false, reason: 'illegal_transition' }
  if (HUMAN_ONLY_TARGETS.has(to) && t.actor.kind !== 'human') return { ok: false, reason: 'requires_human' }
  const rec: Transition = { from: c.state, to, ...t }
  return { ok: true, case: { ...c, state: to, history: [...c.history, rec] } }
}

export function isTerminal(state: CaseState): boolean { return (TRANSITIONS[state] ?? []).length === 0 }

/** The rollback target recorded on the most recent transition that set one. */
export function currentRollbackTarget(c: EvolutionCase): string | undefined {
  for (let i = c.history.length - 1; i >= 0; i--) { const r = c.history[i]!; if (r.rollbackTarget) return r.rollbackTarget }
  return undefined
}
