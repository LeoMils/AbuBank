/*
 * SOURCE-COMPLETENESS PRODUCER (o-capability prerequisite, static §3–4).
 *   npx tsx scripts/discover-source-completeness.ts
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Runs the source-completeness oracle over the REAL repository source-class manifest and
 * writes a reproducible artifact. This answers "is the 3-signal producer's coverage
 * complete?" BEFORE the 33-capability static set may be trusted. Today the answer is NO:
 * DEVICE_GATED_FLAG, ONLINE_FLAG and DEEP_LINK_ROUTE are release-relevant and uncovered.
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateSourceCompleteness, currentDiscoverySourceManifest } from '../src/engineering-os/capabilityDiscoverySource.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (r: string) => resolve(ROOT, r)

const sourceClasses = currentDiscoverySourceManifest()
const result = evaluateSourceCompleteness({ sourceClasses })

const artifact = {
  $schema: 'internal://abu/capability-discovery-source-manifest',
  producer: 'scripts/discover-source-completeness.ts',
  producedFrom: ['src/App.tsx', 'src/services/deviceGatedFlags.ts', 'src/services/online/flags.ts', 'api/*', 'public/manifest.json'],
  note: 'Source-class coverage oracle for the static capability producer. UNCOVERED release-relevant classes mean the static capability set is NOT yet complete — this is a PREREQUISITE for o-capability, which also still needs the dynamic differential (deploy-scoped).',
  complete: result.complete,
  distribution: result.distribution,
  blockers: result.blockers,
  sourceClasses,
}
writeFileSync(p('docs/engineering-os/qa/capability-discovery-source-manifest.json'), JSON.stringify(artifact, null, 2) + '\n')

const line = (s: string) => process.stdout.write(s + '\n')
line('── capability-discovery source completeness ───────────')
line(`complete: ${result.complete}`)
for (const [k, v] of Object.entries(result.distribution)) line(`  ${k.padEnd(20)} ${v}`)
line(`blockers: ${result.blockers.length}`)
for (const b of result.blockers) line(`  [${b.code}] ${b.reason}`)
line('→ wrote docs/engineering-os/qa/capability-discovery-source-manifest.json')
if (!result.complete) line('NOTE: static discovery is NOT source-complete → the 33-capability set stays PROVISIONAL (§3).')
