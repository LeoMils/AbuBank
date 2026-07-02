/*
 * Domain Registry
 * ═══════════════
 * The single place domain plugins are registered and looked up. The Domain Planner
 * reads from here. Kept separate from the planner so registration is a distinct,
 * testable concern and future domains are added here (or via `registerPlugin`).
 */
import type { DomainPlugin } from './domainPlugin'

const REGISTRY: DomainPlugin[] = []

export function registerPlugin(plugin: DomainPlugin): void {
  if (!REGISTRY.some(p => p.name === plugin.name)) REGISTRY.push(plugin)
}

export function registeredPlugins(): readonly DomainPlugin[] { return REGISTRY }

/** Test/diagnostic helper — clears the registry. */
export function _resetRegistry(): void { REGISTRY.length = 0 }
