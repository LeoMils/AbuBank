/*
 * ABU AI — seal the scorecard fingerprint (run AFTER gates pass at a commit).
 * ══════════════════════════════════════════════════════════════════════════
 * Stamps the current git HEAD + the candidate build (from src/version.ts) into
 * scorecard.fingerprint AND into every PROVEN row's fingerprint, so the gate's
 * source-aware staleness + STALE_ROW_BUILD checks see a consistent, current
 * candidate. Intended flow:
 *   1) commit source + tests + scorecard(row PROVEN)   (advances HEAD)
 *   2) node scripts/seal-scorecard.mjs                 (stamps HEAD into fingerprints)
 *   3) commit the seal (DOC-ONLY — does not re-stale the source-aware fingerprint)
 * Only stamp PROVEN rows: a row is "verified at this build" — never fabricate.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const SCORECARD = 'docs/engineering-os/qa/production-convergence/scorecard.json'
const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
const version = readFileSync('src/version.ts', 'utf8').match(/version:\s*'([^']+)'/)?.[1]
if (!/^[0-9a-f]{40}$/.test(head)) { console.error('seal: HEAD is not a full SHA'); process.exit(1) }
if (!version) { console.error('seal: could not read version from src/version.ts'); process.exit(1) }

const sc = JSON.parse(readFileSync(SCORECARD, 'utf8'))
sc.fingerprint = { commit: head, build: version }
let stamped = 0
for (const row of sc.rows) {
  if (row.status === 'PROVEN') { row.fingerprint = { commit: head, build: version }; stamped += 1 }
}
writeFileSync(SCORECARD, JSON.stringify(sc, null, 2) + '\n')
console.log(`sealed: fingerprint commit=${head.slice(0, 12)} build=${version} · stamped ${stamped} PROVEN rows`)
