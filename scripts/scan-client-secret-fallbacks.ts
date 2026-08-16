/*
 * scan-client-secret-fallbacks.ts — record CLIENT-side provider-secret reads. (Stage 3C, o-privacy family)
 *   npx tsx scripts/scan-client-secret-fallbacks.ts
 * Runs the client-secret detector over real src/ and writes findings. Documents the CODE-READY gap:
 * client-side VITE_ provider-secret fallbacks that block full removal of VITE_ secrets.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanClientSource, summarizeClientSecretReads, type ClientSecretRead } from '../src/engineering-os/clientSecretFallback.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (r: string) => resolve(ROOT, r)

function walk(dir: string, acc: string[] = []): string[] {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, d.name)
    if (d.isDirectory()) walk(full, acc)
    else if ((d.name.endsWith('.ts') || d.name.endsWith('.tsx')) && !d.name.endsWith('.test.ts') && !d.name.endsWith('.test.tsx')) acc.push(full)
  }
  return acc
}

const reads: ClientSecretRead[] = []
for (const f of walk(p('src'))) {
  const rel = f.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
  for (const r of scanClientSource(rel, readFileSync(f, 'utf8'))) reads.push(r)
}
const summary = summarizeClientSecretReads(reads)

const artifact = {
  $schema: 'internal://abu/client-secret-fallbacks',
  producer: 'scripts/scan-client-secret-fallbacks.ts',
  note: 'Client-side provider-secret reads (import.meta.env.VITE_*_API_KEY). A BILLABLE read is a leak-class defect; a FREE_TIER read blocks full VITE_ removal until removed or routed server-side. Findings, not a hard gate — the free-tier client fallbacks are a documented product decision.',
  billableCount: summary.billableCount,
  freeTierCount: summary.freeTierCount,
  clean: summary.clean,
  reads: summary.reads,
}
writeFileSync(p('docs/engineering-os/qa/client-secret-fallbacks.json'), JSON.stringify(artifact, null, 2) + '\n')

const line = (s: string) => process.stdout.write(s + '\n')
line('── client-side provider-secret reads ──────────────────')
line(`billable: ${summary.billableCount}   free-tier: ${summary.freeTierCount}`)
for (const r of summary.reads) line(`  [${r.tier}] ${r.envName}  ${r.file}:${r.line}`)
line('→ wrote docs/engineering-os/qa/client-secret-fallbacks.json')
if (summary.billableCount > 0) line('WARN: a BILLABLE client-side secret read is a leak-class defect.')
