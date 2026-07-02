/*
 * Runtime Trace
 * ═════════════
 * A per-turn record of the pipeline stages an answer passed through. Every answer
 * the runtime produces carries a trace ending in a RUNTIME_FINALIZED stamp — that
 * stamp is what `noBypassRuntimeGuard` checks to PROVE the answer went through the
 * runtime and not a legacy emitter.
 */
export type RuntimeStage =
  | 'input' | 'normalize' | 'intent' | 'domain' | 'tool' | 'finalize' | 'supervise' | 'deliver'

export const RUNTIME_STAMP = 'RUNTIME_FINALIZED' as const

export interface RuntimeTrace {
  stages: RuntimeStage[]
  intent: string
  source: string
  stamp: typeof RUNTIME_STAMP
}

// A finalized answer MUST have passed at least these stages.
export const REQUIRED_STAGES: readonly RuntimeStage[] = ['input', 'intent', 'finalize', 'supervise', 'deliver']

export function stampTrace(stages: RuntimeStage[], intent: string, source: string): RuntimeTrace {
  return { stages: [...stages], intent, source, stamp: RUNTIME_STAMP }
}

/** True when the trace proves the answer passed the required pipeline stages. */
export function isFinalized(trace: RuntimeTrace | undefined | null): boolean {
  if (!trace || trace.stamp !== RUNTIME_STAMP) return false
  return REQUIRED_STAGES.every(s => trace.stages.includes(s))
}
