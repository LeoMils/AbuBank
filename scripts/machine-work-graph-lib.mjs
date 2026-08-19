/*
 * machine-work-graph-lib.mjs — PURE Machine Work Completeness Oracle. (C10 / §43)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * MACHINE_CLOSABLE_REMAINING = 0 is itself a release-critical claim; it must NOT come from a hand list.
 * REQUIRED_OBLIGATION_IDS below is the authoritative obligation universe (derived from the constitution
 * sections). The registry (MACHINE_WORK_GRAPH.json) assigns each obligation a terminal state. This
 * oracle cross-checks the registry AGAINST the authoritative universe: any required obligation missing
 * from the registry is OMITTED (a defect), and REMAINING is the count of non-terminal obligations —
 * both DERIVED, never asserted. No I/O.
 */

// Terminal categories an obligation may legitimately reach (anything else is NON-terminal).
export const TERMINAL_STATES = new Set([
  'PROVEN_PASS', 'PROVEN_FAIL', 'BLOCKED_EXTERNAL_WITH_EVIDENCE',
  'OWNER_AUTHORITY_REQUIRED_WITH_PROOF', 'HUMAN_RESIDUAL_WITH_NEGATIVE_PROOF', 'N/A_WITH_PROOF',
])
// A non-terminal obligation is still machine-closable work remaining.
export const NONTERMINAL_STATES = new Set(['NONTERMINAL', 'IN_PROGRESS', 'UNKNOWN'])

// The authoritative obligation universe. Adding a constitution obligation here WITHOUT adding it to the
// registry makes the oracle report OMITTED>0 — the omission-proofing the prompt (§43) demands.
export const REQUIRED_OBLIGATION_IDS = [
  // Identity / reproducibility / provenance
  'split-identities', 'runtime-provenance', 'worktree-runtime-clean', 'worktree-harness-clean',
  // Exit contract / report
  'exit-contract', 'canonical-report-schema',
  // Capsule
  'capsule-integrity', 'capsule-completeness', 'final-release-capsule',
  // Discovery / clean-room
  'candidate-discovery', 'fresh-session-clean-room',
  // Reuse / evidence economy
  'proof-provenance-key', 'evidence-budget', 'qa-economy-slo',
  // Stochastic
  'stochastic-completeness-oracle', 'stochastic-sampling-run',
  // Capability lifecycle
  'capability-admission', 'capability-retirement', 'change-impact-proof-cache',
  // Oracle / escape machinery
  'test-oracle-integrity', 'escape-to-detector', 'qa-control-escape-corpus', 'historical-product-escapes',
  // Residuals
  'human-device-residual-expiry', 'negative-proof-protocol', 'realtime-idempotency',
  // Product surfaces
  'voice-objective-contract', 'long-session-soak', 'external-drift-ttl', 'current-info-freshness',
  'retrieval-injection-boundary', 'secret-detector-contract', 'credential-state-distinctness',
  'privacy-session-isolation', 'billing-abuse-boundary', 'side-effect-idempotency',
  'persisted-state-migration', 'pwa-sw-warm-client', 'environment-parity', 'exact-artifact-lock-rollback',
  'emergency-path', 'critical-user-journeys',
  // Work-graph + authority oracles
  'machine-work-completeness-oracle', 'owner-human-authority-oracle', 'p2-enumeration',
  // Self-QA + CI
  'full-mutation-matrix', 'ci-sentinel-real-chain', 'continuous-monster-ci',
  // Yield discipline
  'yield-discipline',
  // Final runs / rehearsal
  'promotion-rehearsal', 'final-feature-run', 'final-rc-run',
  // Release-integrity reconciliation controls (final checks)
  'obligation-universe-completeness', 'release-eligibility-state-machine', 'qa-control-escape-sensitivity',
]

/**
 * @param registry array of { id, terminalState, ... } (MACHINE_WORK_GRAPH.json → obligations)
 * @param requiredIds authoritative obligation universe (defaults to REQUIRED_OBLIGATION_IDS)
 * @returns derived counts + the omitted/nonterminal id lists
 */
export function deriveWorkGraphState(registry, requiredIds = REQUIRED_OBLIGATION_IDS) {
  const byId = new Map((registry ?? []).map((o) => [o.id, o]))

  // OMITTED: a required obligation with no registry entry at all (silent denominator shrink).
  const omitted = requiredIds.filter((id) => !byId.has(id))

  // Duplicate registry entries for the same id are themselves a defect (ambiguous state).
  const seen = new Set(); const duplicates = []
  for (const o of registry ?? []) { if (seen.has(o.id)) duplicates.push(o.id); seen.add(o.id) }

  // Terminal vs non-terminal over the REQUIRED set (extra registry ids are reported but don't reduce risk).
  const present = requiredIds.map((id) => byId.get(id)).filter(Boolean)
  const nonTerminal = present.filter((o) => !TERMINAL_STATES.has(o.terminalState)).map((o) => o.id)
  const invalidState = present.filter((o) => !TERMINAL_STATES.has(o.terminalState) && !NONTERMINAL_STATES.has(o.terminalState)).map((o) => o.id)
  const terminal = present.filter((o) => TERMINAL_STATES.has(o.terminalState)).map((o) => o.id)

  // A required obligation lacking evidence but claiming a terminal PASS is a pass-by-omission defect.
  const terminalWithoutEvidence = present
    .filter((o) => (o.terminalState === 'PROVEN_PASS') && !o.evidence)
    .map((o) => o.id)

  const REQUIRED_MACHINE_OBLIGATIONS_TOTAL = requiredIds.length
  const OMITTED_MACHINE_OBLIGATIONS = omitted.length + duplicates.length + terminalWithoutEvidence.length
  const NONTERMINAL_MACHINE_OBLIGATIONS = nonTerminal.length

  // DISTINCT remaining buckets — never conflate them (control-integrity fix). MACHINE_CLOSABLE_REMAINING
  // is ONLY the machine-closable non-terminal work; externally-blocked / owner / human items are their
  // own terminal-for-the-machine buckets and must NOT inflate it.
  const machineClosableList = present.filter((o) => o.terminalState === 'NONTERMINAL' && o.machineClosable !== false).map((o) => o.id)
  const externalBlockedList = present.filter((o) => o.terminalState === 'BLOCKED_EXTERNAL_WITH_EVIDENCE').map((o) => o.id)
  const ownerAuthorityList = present.filter((o) => o.terminalState === 'OWNER_AUTHORITY_REQUIRED_WITH_PROOF').map((o) => o.id)
  const humanResidualList = present.filter((o) => o.terminalState === 'HUMAN_RESIDUAL_WITH_NEGATIVE_PROOF').map((o) => o.id)
  // A NONTERMINAL obligation explicitly flagged machineClosable:false is a classification error — it must
  // be given a real terminal state (BLOCKED_EXTERNAL/OWNER/HUMAN), not left as non-terminal-but-not-mine.
  const nonTerminalNotMachineClosable = present.filter((o) => o.terminalState === 'NONTERMINAL' && o.machineClosable === false).map((o) => o.id)

  const MACHINE_CLOSABLE_REMAINING = machineClosableList.length
  const EXTERNAL_BLOCKED_REMAINING = externalBlockedList.length
  const OWNER_AUTHORITY_REMAINING = ownerAuthorityList.length
  const HUMAN_RESIDUAL_REMAINING = humanResidualList.length

  return {
    REQUIRED_MACHINE_OBLIGATIONS_TOTAL,
    TERMINAL_MACHINE_OBLIGATIONS: terminal.length,
    NONTERMINAL_MACHINE_OBLIGATIONS,
    OMITTED_MACHINE_OBLIGATIONS,
    MACHINE_CLOSABLE_REMAINING,
    EXTERNAL_BLOCKED_REMAINING,
    OWNER_AUTHORITY_REMAINING,
    HUMAN_RESIDUAL_REMAINING,
    machineClosableList, externalBlockedList, ownerAuthorityList, humanResidualList, nonTerminalNotMachineClosable,
    omitted, duplicates, terminalWithoutEvidence, nonTerminal, invalidState,
    // ok requires: no omission, no invalid state, and no "non-terminal but not-machine-closable" limbo.
    ok: OMITTED_MACHINE_OBLIGATIONS === 0 && invalidState.length === 0 && nonTerminalNotMachineClosable.length === 0,
  }
}
