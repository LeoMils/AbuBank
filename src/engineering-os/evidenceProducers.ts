/*
 * REPRODUCIBLE EVIDENCE PRODUCERS + LINEAGE (o-producers).  (Stage 3C §12)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Release evidence must be GENERATED from real runs with lineage and COMPUTED freshness — never
 * a hand-authored JSON with a fresh timestamp. Each producer binds: script → inputs → output
 * artifact → evidence class → the source paths its freshness depends on. Freshness is computed
 * from whether any dependency changed since the artifact was produced — a metadata relabel
 * cannot create freshness. A relevant change invalidates the affected evidence; an unrelated
 * change must not invalidate everything.
 */

export type EvidenceClass = 'CODE' | 'MOCK' | 'BROWSER' | 'PREVIEW' | 'PHYSICAL_DEVICE' | 'PRODUCTION'

export interface ProducerRecord {
  id: string
  /** The producer script (identifies itself; does not hand-author truth). */
  script: string
  /** The output artifact it writes. */
  output: string
  evidenceClass: EvidenceClass
  /** Source paths whose change invalidates this artifact (computed freshness). */
  freshnessDependsOn: string[]
}

export type Freshness = 'FRESH' | 'STALE'

/**
 * Compute freshness from the set of changed paths since production. STALE iff any dependency
 * changed. An unrelated change (not in freshnessDependsOn) leaves it FRESH. Freshness is a pure
 * function of dependency changes — NOT of any recorded timestamp/label.
 */
export function computeFreshness(record: ProducerRecord, changedPaths: string[]): Freshness {
  const changed = new Set(changedPaths)
  const touched = record.freshnessDependsOn.some((dep) => changed.has(dep) || [...changed].some((c) => c.startsWith(dep.replace(/\*$/, ''))))
  return touched ? 'STALE' : 'FRESH'
}

export interface ProducerLineageResult {
  records: Array<ProducerRecord & { freshness: Freshness }>
  staleCount: number
}

export function evaluateProducers(records: ProducerRecord[], changedPaths: string[]): ProducerLineageResult {
  const out = records.map((r) => ({ ...r, freshness: computeFreshness(r, changedPaths) }))
  return { records: out, staleCount: out.filter((r) => r.freshness === 'STALE').length }
}

/** The real evidence producers wired this stage. Each is a reproducible script with declared lineage. */
export function stageProducers(): ProducerRecord[] {
  return [
    { id: 'capability-discovery', script: 'scripts/discover-capabilities.ts', output: 'docs/engineering-os/qa/capability-manifest.json', evidenceClass: 'CODE', freshnessDependsOn: ['src/screens/', 'src/state/types.ts', 'src/services/liveTools.ts', 'src/services/deviceGatedFlags.ts', 'src/services/online/flags.ts', 'src/App.tsx'] },
    { id: 'source-completeness', script: 'scripts/discover-source-completeness.ts', output: 'docs/engineering-os/qa/capability-discovery-source-manifest.json', evidenceClass: 'CODE', freshnessDependsOn: ['src/engineering-os/capabilityDiscoverySource.ts'] },
    { id: 'rc-reachability', script: 'scripts/observe-rc-reachability.mjs', output: 'docs/engineering-os/qa/rc-reachability-observation.json', evidenceClass: 'PREVIEW', freshnessDependsOn: ['docs/engineering-os/qa/capability-manifest.json'] },
    { id: 'capability-reconciliation', script: 'scripts/reconcile-capability-universe.ts', output: 'docs/engineering-os/qa/capability-reconciliation.json', evidenceClass: 'PREVIEW', freshnessDependsOn: ['docs/engineering-os/qa/rc-reachability-observation.json', 'docs/engineering-os/qa/tool-firing-evidence.json', 'src/engineering-os/dynamicReachability.ts'] },
    { id: 'deployed-secret-exposure', script: 'scripts/scan-deployed-secrets.ts', output: 'docs/engineering-os/qa/deployed-secret-exposure.json', evidenceClass: 'PREVIEW', freshnessDependsOn: ['src/engineering-os/bundleSecretScan.ts'] },
    { id: 'acceptance-denominator', script: 'scripts/build-denominator.ts', output: 'docs/engineering-os/qa/acceptance-denominator.json', evidenceClass: 'CODE', freshnessDependsOn: ['src/engineering-os/denominator.ts', 'docs/engineering-os/qa/capability-manifest.json'] },
  ]
}
