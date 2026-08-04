/*
 * ABU AI — STOP GUARD (pure decision).
 * ══════════════════════════════════════════════════════════════════════════
 * Decides whether a Claude Code Stop (turn end) should be BLOCKED because the
 * production goal is active and the machine gate still reports open automatable
 * Critical/High work. Pure + unit-tested so the wiring (.mjs) stays trivial.
 *
 * Loop safety is a first-class requirement: after `maxBlocks` consecutive blocks
 * the guard RELEASES (allows the stop) so it can never trap the session forever.
 * It also releases immediately when the goal flag is absent (normal workflow is
 * untouched) or when the gate passes.
 */
export interface StopGuardInput {
  /** True only when the operator armed the goal (flag file present). */
  goalActive: boolean
  /** True when qa:production-gate last reported PASS. */
  gatePass: boolean
  /** Open automatable Critical/High rows from the gate cache. */
  openCount: number
  /** Consecutive prior blocks in this arming (loop backstop). */
  blockCount: number
  /** Release after this many consecutive blocks (default 3). */
  maxBlocks?: number
}

export interface StopGuardDecision {
  block: boolean
  reason: string
  /** The blockCount to persist for the next Stop. */
  nextBlockCount: number
}

export function decideStopBlock(input: StopGuardInput): StopGuardDecision {
  const maxBlocks = input.maxBlocks ?? 3
  if (!input.goalActive) return { block: false, reason: 'goal not armed', nextBlockCount: 0 }
  if (input.gatePass) return { block: false, reason: 'gate passes', nextBlockCount: 0 }
  if (input.blockCount >= maxBlocks) {
    return { block: false, reason: `loop backstop reached (${input.blockCount}/${maxBlocks}) — releasing`, nextBlockCount: 0 }
  }
  return {
    block: true,
    reason: `Production goal is armed and qa:production-gate reports ${input.openCount} open automatable Critical/High row(s). Continue executing the critical path (see .claude/skills/abu-production/SKILL.md) or run \`npm run qa:production-gate\` for the open list. To disarm: remove .claude/.abu-goal-active.`,
    nextBlockCount: input.blockCount + 1,
  }
}
