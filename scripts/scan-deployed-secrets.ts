/*
 * scan-deployed-secrets.ts — READ-ONLY secret-exposure scoping of shipped bundles. (Stage 3C §2,§9)
 *   npx tsx scripts/scan-deployed-secrets.ts
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Fetches the ACTUAL shipped HTML/JS of each target and classifies every contract key by exposure.
 * REDACTED only — never prints or persists a real secret value. Distinguishes a confirmed credential
 * leak from legitimate public client configuration (region/version/commit).
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyShippedKeys, scanBundleForCredentialMaterial } from '../src/engineering-os/bundleSecretScan.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (r: string) => resolve(ROOT, r)

const TARGETS = [
  { label: 'RC (0.286 tested)', url: 'https://abu-bank-f3dpms0ta-leos-projects-d3c04c09.vercel.app' },
  { label: 'canonical alias', url: 'https://abu-ela-rc.vercel.app' },
]

async function fetchBundle(base: string): Promise<{ text: string; buildVersion?: string; assets: string[] }> {
  let buildVersion: string | undefined
  try { buildVersion = (await (await fetch(`${base}/api/health`)).json())?.buildVersion } catch { /* */ }
  const html = await (await fetch(`${base}/`)).text()
  const assets = [...new Set([...html.matchAll(/\/assets\/[^"']+\.js/g)].map((m) => m[0]))]
  let text = html
  for (const a of assets) { try { text += await (await fetch(`${base}${a}`)).text() } catch { /* */ } }
  return { text, buildVersion, assets }
}

async function main() {
  const report: Record<string, unknown> = {
    $schema: 'internal://abu/deployed-secret-exposure',
    scanner: 'scripts/scan-deployed-secrets.ts (classifyShippedKeys)',
    note: 'READ-ONLY. Redacted values only. CONFIRMED_SECRET_EXPOSED = a credential-kind key shipped with a real value. PUBLIC_CLIENT_CONFIGURATION = legitimate public config.',
    targets: [],
  }
  const targets: unknown[] = []
  for (const t of TARGETS) {
    try {
      const { text, buildVersion, assets } = await fetchBundle(t.url)
      const classes = classifyShippedKeys(text)
      const confirmed = classes.filter((c) => c.exposure === 'CONFIRMED_SECRET_EXPOSED')
      // AUTHORITATIVE: raw credential-material scan (format-agnostic). Catches a renamed/inlined/
      // minified secret that the VITE_-name classification misses (the production false-pass).
      const raw = scanBundleForCredentialMaterial(text)
      targets.push({
        label: t.label, url: t.url, buildVersion, bundleBytes: text.length, assets,
        authoritativeRawCredentialMaterial: { clean: raw.clean, findings: raw.findings },
        nameBasedConfirmedSecretCount: confirmed.length,
        classifications: classes.filter((c) => c.exposure !== 'NOT_PRESENT_IN_SHIPPED_BUNDLE'),
      })
      console.log(`── ${t.label} (${buildVersion ?? '??'}) ${text.length}B`)
      console.log(`   AUTHORITATIVE raw-credential scan: ${raw.clean ? 'CLEAN' : `${raw.findings.length} SECRET(S) EXPOSED`}`)
      for (const f of raw.findings) console.log(`     [CONFIRMED_SECRET_EXPOSED] ${f.provider} ${f.redactedFingerprint} (${f.length} chars)`)
      for (const c of classes) if (c.exposure !== 'NOT_PRESENT_IN_SHIPPED_BUNDLE') {
        console.log(`   [name-scan ${c.exposure}] ${c.name} (${c.kind}) ${c.redactedSample ?? ''}`)
      }
    } catch (e) {
      targets.push({ label: t.label, url: t.url, error: String((e as Error).message || e) })
      console.log(`── ${t.label}: FETCH ERROR ${(e as Error).message}`)
    }
  }
  report.targets = targets
  writeFileSync(p('docs/engineering-os/qa/deployed-secret-exposure.json'), JSON.stringify(report, null, 2) + '\n')
  console.log('→ wrote docs/engineering-os/qa/deployed-secret-exposure.json')
}
main().catch((e) => { console.error('SCAN FAILED:', e); process.exit(1) })
