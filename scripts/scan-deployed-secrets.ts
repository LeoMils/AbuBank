/*
 * scan-deployed-secrets.ts — READ-ONLY deployed-bundle credential scan (canonical release authority).
 *   npx tsx scripts/scan-deployed-secrets.ts <url> [<url> ...]
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * FIXED (A2): the URL argument is now REQUIRED and materially honored — no hidden hardcoded target, so
 * certification can never silently inspect the wrong deployment. Unreachable targets FAIL CLOSED
 * (UNREACHABLE, never CLEAN). Scans the real HTML + reachable client chunk graph for credential
 * MATERIAL (raw token shapes), not VITE_ names. Redacted fingerprints only. The scan logic is the
 * calibrated src/engineering-os/deployedSecretScan.ts (QA-of-QA: deployedSecretScan.test.ts).
 * Exit: 0 = every target CLEAN · 1 = a target EXPOSED · 2 = a target UNREACHABLE / usage error.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scanTargets, type ScanFetch } from '../src/engineering-os/deployedSecretScan.ts'

const targets = process.argv.slice(2).filter((a) => /^https?:\/\//.test(a))
if (targets.length === 0) {
  console.error('usage: npx tsx scripts/scan-deployed-secrets.ts <url> [<url> ...]  (explicit target(s) REQUIRED — no default)')
  process.exit(2)
}

const realFetch: ScanFetch = async (url) => {
  const r = await fetch(url)
  return { ok: r.ok, text: () => r.text() }
}

const { pass, targets: results } = await scanTargets(targets, realFetch)

for (const t of results) {
  console.log(`── ${t.target}  [${t.verdict}]  chunks=${t.chunks} bytes=${t.bytes}`)
  if (t.verdict === 'UNREACHABLE') console.log(`   ✗ ${t.error}`)
  for (const f of t.findings) console.log(`   [CONFIRMED_SECRET_EXPOSED] ${f.provider} ${f.redactedFingerprint} (${f.length} chars)`)
  for (const n of t.confirmedSecretNames) console.log(`   [name-scan CONFIRMED_SECRET_EXPOSED] ${n}`)
  if (t.publicConfig.length) console.log(`   [public config] ${t.publicConfig.join(', ')}`)
}

const report = {
  $schema: 'internal://abu/deployed-secret-exposure',
  scanner: 'src/engineering-os/deployedSecretScan.ts (calibrated; explicit target; fail-closed)',
  note: 'READ-ONLY. Redacted fingerprints only. Explicit target(s) honored; unreachable → UNREACHABLE (never CLEAN).',
  when: new Date().toISOString(),
  pass, targets: results,
}
writeFileSync(resolve('docs/engineering-os/qa/deployed-secret-exposure.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`\n=== ${pass ? 'ALL CLEAN' : 'NOT CLEAN'} (${results.filter((r) => r.verdict === 'CLEAN').length}/${results.length} clean) ===`)
console.log('wrote docs/engineering-os/qa/deployed-secret-exposure.json')
const anyExposed = results.some((r) => r.verdict === 'EXPOSED')
const anyUnreachable = results.some((r) => r.verdict === 'UNREACHABLE')
process.exit(anyUnreachable ? 2 : anyExposed ? 1 : 0)
