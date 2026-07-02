/*
 * Domain Planner + Registry
 * ═════════════════════════
 * The generic mechanism the Executive Cognitive Controller uses to decide which
 * domain plugins participate in a turn. Plugins self-select via `match()`; the
 * planner runs every participant's `reason()`, and returns the participants plus a
 * merged plan (primary answer = highest-confidence handled result; side-effects and
 * state patches from ALL handled participants are merged). Multiple plugins may
 * participate in one turn. The controller never needs to change to add a domain.
 */
import type { DomainPlugin, PluginContext, PluginResult, PluginSideEffect } from './domainPlugin'
import type { RuntimeState } from './cognitiveRuntime'
import { registeredPlugins } from './domainRegistry'

export { registerPlugin, registeredPlugins } from './domainRegistry'

/** For tests: run a plugin against a fresh registry without polluting the global one. */
export function planWith(plugins: DomainPlugin[], ctx: PluginContext): DomainPlan {
  return execute(plugins, ctx)
}

export interface DomainPlan {
  participants: string[]
  primary: PluginResult | null
  primaryPlugin: string | null
  /** merged side-effects + state patch across all handled participants. */
  sideEffects: PluginSideEffect[]
  statePatch: Partial<RuntimeState>
}

function execute(plugins: DomainPlugin[], ctx: PluginContext): DomainPlan {
  const matched = plugins
    .map(p => ({ p, priority: p.match(ctx) }))
    .filter(x => x.priority > 0)
    .sort((a, b) => b.priority - a.priority)

  const participants: string[] = []
  const handled: Array<{ name: string; res: PluginResult }> = []
  const sideEffects: PluginSideEffect[] = []
  let statePatch: Partial<RuntimeState> = {}

  for (const { p } of matched) {
    const res = p.reason(ctx)
    participants.push(p.name)
    if (res.handled) {
      handled.push({ name: p.name, res })
      if (res.sideEffect) sideEffects.push(res.sideEffect)
      if (res.statePatch) statePatch = { ...statePatch, ...res.statePatch }
    }
  }

  // Primary = highest-confidence handled participant.
  handled.sort((a, b) => b.res.confidence - a.res.confidence)
  const top = handled[0] ?? null
  return {
    participants,
    primary: top?.res ?? null,
    primaryPlugin: top?.name ?? null,
    sideEffects,
    statePatch,
  }
}

/** Run the GLOBAL registry against this turn. */
export function runPlan(ctx: PluginContext): DomainPlan {
  return execute([...registeredPlugins()], ctx)
}
