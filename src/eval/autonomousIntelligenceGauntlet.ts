/*
 * Autonomous Intelligence Gauntlet
 * ════════════════════════════════
 * Generates N multi-turn conversations, runs each through the real pipeline, and
 * aggregates every Phase-7 strict-rule violation by root-cause class. A run is
 * GREEN only at 0 violations. Failures are grouped so the same root cause across
 * many conversations reads as ONE architecture signal (SYSTEMIC FAILURE RULE).
 */
import { buildBatch } from './autonomousScenarioFactory'
import { runConversation, type Violation } from './autonomousConversationRunner'

export interface GauntletReport {
  conversations: number
  turns: number
  violations: number
  byRule: Record<string, { count: number; samples: string[] }>
  passed: boolean
}

export function runGauntletBatch(count: number, offset = 0): GauntletReport {
  const convos = buildBatch(count, offset)
  let turns = 0
  const all: Violation[] = []
  for (const c of convos) { turns += c.beats.length; all.push(...runConversation(c)) }
  const byRule: Record<string, { count: number; samples: string[] }> = {}
  for (const vi of all) {
    byRule[vi.rule] ??= { count: 0, samples: [] }
    byRule[vi.rule]!.count++
    if (byRule[vi.rule]!.samples.length < 5) byRule[vi.rule]!.samples.push(`conv#${vi.convId} beat${vi.beat}(${vi.kind}): ${vi.detail}`)
  }
  return { conversations: convos.length, turns, violations: all.length, byRule, passed: all.length === 0 }
}
