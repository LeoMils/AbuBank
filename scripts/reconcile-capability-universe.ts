/*
 * reconcile-capability-universe.ts — static↔dynamic reconciliation (o-capability §5).
 *   npx tsx scripts/reconcile-capability-universe.ts
 * ════════════════════════════════════════════════════════════════════════════════════
 * Feeds the REAL read-only observation (rc-reachability-observation.json) through the SAME
 * reconciliation core the isolated calibration suite proved (path-equivalence), and writes
 * the reconciliation report. o-capability may be PROVEN only when canonicalProven is true.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reconcile, type CapabilityReconInput } from '../src/engineering-os/dynamicReachability.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (r: string) => resolve(ROOT, r)

const obs = JSON.parse(readFileSync(p('docs/engineering-os/qa/rc-reachability-observation.json'), 'utf8'))
const inputs: CapabilityReconInput[] = obs.reconInputs
const report = reconcile(inputs)

const artifact = {
  $schema: 'internal://abu/capability-reconciliation',
  producer: 'scripts/reconcile-capability-universe.ts',
  observedFrom: obs.base,
  observedAtBuild: obs.observedAtBuild,
  buildMatches: obs.buildMatches,
  evidenceClass: obs.evidenceClass,
  canonicalProven: report.canonicalProven,
  canonicalUniverseSize: report.canonicalUniverse.length,
  distribution: report.distribution,
  blockers: report.blockers,
  note: report.canonicalProven
    ? 'o-capability dynamic reconciliation PROVEN — static and dynamic agree; universe is canonical.'
    : 'o-capability stays UNIMPLEMENTED: some capabilities are STATE_COVERAGE_INCOMPLETE (their enabling state was not exercised — e.g. tool firing needs a driven realtime conversation). NOT dropped; still in the universe. Expand state coverage to close.',
  results: report.results,
}
writeFileSync(p('docs/engineering-os/qa/capability-reconciliation.json'), JSON.stringify(artifact, null, 2) + '\n')

const line = (s: string) => process.stdout.write(s + '\n')
line('── static↔dynamic capability reconciliation ───────────')
line(`observed build: ${obs.observedAtBuild} (${obs.buildMatches ? 'MATCH' : 'MISMATCH'})`)
for (const [k, v] of Object.entries(report.distribution)) if (v) line(`  ${k.padEnd(34)} ${v}`)
line(`canonical universe size: ${report.canonicalUniverse.length}`)
line(`canonicalProven: ${report.canonicalProven}`)
line(`blockers: ${report.blockers.length}`)
line('→ wrote docs/engineering-os/qa/capability-reconciliation.json')
