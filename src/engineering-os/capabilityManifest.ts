/*
 * PRODUCT CAPABILITY MANIFEST — the universe is capabilities, not just screens. (§10–14)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * Reconciles MULTIPLE independent static signals (screen dirs, Screen enum, routes, nav,
 * tool/action/voice registries, integrations) into one canonical manifest with per-source
 * provenance. Disagreement between sources is NOT silently resolved to the easiest
 * denominator — it is CAPABILITY_SOURCE_CONFLICT until reconciled or proven N/A.
 *
 * Any exclusion from the release denominator (INTERNAL/EXPERIMENTAL/ORPHAN) is a
 * release-relevant claim requiring a positive machine-verifiable reachability proof.
 * UNKNOWN on a high-risk capability may NOT shrink the denominator.
 */

export type CapabilityType = 'UI_SURFACE' | 'VOICE_CHANNEL' | 'ACTION_CAPABILITY' | 'INTEGRATION_CAPABILITY' | 'BACKGROUND_CAPABILITY'
export type Reachability = 'USER_REACHABLE' | 'USER_INVOKABLE' | 'INTERNAL' | 'EXPERIMENTAL' | 'ORPHAN' | 'UNKNOWN'
export type SignalSource = 'SCREEN_DIR' | 'SCREEN_ENUM' | 'ROUTE' | 'NAV' | 'TOOL_REGISTRY' | 'ACTION_REGISTRY' | 'VOICE_ENTRY' | 'INTEGRATION' | 'DYNAMIC_OBSERVED'

export interface CapabilitySignal { id: string; source: SignalSource; type: CapabilityType }

export interface Capability {
  id: string
  type: CapabilityType
  sources: SignalSource[]
  reachability: Reachability
  riskTier?: 'high' | 'medium' | 'low'
  /** Required when reachability removes it from the denominator (INTERNAL/EXPERIMENTAL/ORPHAN). */
  exclusionProof?: string
}

export interface ManifestInput {
  signals: CapabilitySignal[]
  /** Per-capability classification decisions (reachability + optional exclusion proof). */
  classifications: Record<string, { reachability: Reachability; riskTier?: 'high' | 'medium' | 'low'; exclusionProof?: string }>
  /** Capabilities observed dynamically against the deployed RC (may be empty). */
  dynamicObserved?: string[]
}

export interface ManifestBlocker { code: string; reason: string }
export interface ManifestResult {
  capabilities: Capability[]
  blockers: ManifestBlocker[]
  distribution: Record<string, number>
}

const EXCLUDED: Reachability[] = ['INTERNAL', 'EXPERIMENTAL', 'ORPHAN']

/**
 * Build + validate the manifest. Emits blockers for source conflicts, unproven
 * exclusions, high-risk UNKNOWNs, and static↔dynamic discovery omissions.
 */
export function evaluateCapabilityManifest(input: ManifestInput): ManifestResult {
  const byId = new Map<string, Capability>()
  for (const s of input.signals) {
    const cap = byId.get(s.id) ?? { id: s.id, type: s.type, sources: [], reachability: 'UNKNOWN' as Reachability }
    if (!cap.sources.includes(s.source)) cap.sources.push(s.source)
    byId.set(s.id, cap)
  }
  const blockers: ManifestBlocker[] = []
  const add = (code: string, reason: string) => blockers.push({ code, reason })
  const distribution: Record<string, number> = {}

  for (const cap of byId.values()) {
    const cls = input.classifications[cap.id]
    if (cls) { cap.reachability = cls.reachability; if (cls.riskTier) cap.riskTier = cls.riskTier; if (cls.exclusionProof) cap.exclusionProof = cls.exclusionProof }
    distribution[cap.reachability] = (distribution[cap.reachability] ?? 0) + 1

    // (1) Source conflict: two signals disagree on TYPE for the same id.
    const types = new Set(input.signals.filter((s) => s.id === cap.id).map((s) => s.type))
    if (types.size > 1) add('CAPABILITY_SOURCE_CONFLICT', `capability '${cap.id}' has conflicting types across sources: ${[...types].join(',')}`)

    // (2) Exclusion requires positive proof.
    if (EXCLUDED.includes(cap.reachability) && (!cap.exclusionProof || !cap.exclusionProof.trim())) {
      add('UNPROVEN_SURFACE_EXCLUSION', `capability '${cap.id}' excluded as ${cap.reachability} without a reachability proof`)
    }
    // (3) UNKNOWN high-risk may not shrink the denominator.
    if (cap.reachability === 'UNKNOWN' && cap.riskTier === 'high') {
      add('CAPABILITY_UNKNOWN_HIGH_RISK', `high-risk capability '${cap.id}' is UNKNOWN — resolve or conservatively include`)
    }
  }

  // (4) Static↔dynamic differential: a dynamically-observed capability missing from static.
  for (const d of input.dynamicObserved ?? []) {
    if (!byId.has(d)) add('CAPABILITY_DISCOVERY_OMISSION', `dynamically-observed capability '${d}' is absent from the static manifest`)
  }

  return { capabilities: [...byId.values()], blockers, distribution }
}
