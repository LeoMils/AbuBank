/*
 * prod-synthetic.mjs — SAFE read-only Production synthetic. (§48/B12)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/prod-synthetic.mjs <url>
 * Read-only drift/regression probe an owner can schedule against a live deployment: health identity +
 * shipped-secret scan. NO writes, NO destructive action, NO auto-rollback. Distinguishes
 * IMPLEMENTED_READY (this script) from PRODUCTION_DEPLOYED_PROVEN (requires a real Production run).
 */
import { execSync } from 'node:child_process'
const url = process.argv[2]
if (!/^https?:\/\//.test(url || '')) { console.error('usage: node scripts/prod-synthetic.mjs <url>'); process.exit(2) }
const checks = []
try {
  const health = JSON.parse(execSync(`curl -s -m 20 ${url}/api/health`, { encoding: 'utf8' }))
  checks.push({ name: 'health', ok: health.ok === true, buildVersion: health.buildVersion })
} catch (e) { checks.push({ name: 'health', ok: false, error: String(e.message) }) }
try {
  execSync(`npx tsx scripts/scan-deployed-secrets.ts ${url}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
  checks.push({ name: 'secret-scan', ok: true })
} catch (e) { checks.push({ name: 'secret-scan', ok: false, exit: e.status ?? 1 }) }
const ok = checks.every((c) => c.ok)
console.log(JSON.stringify({ url, when: new Date().toISOString(), status: ok ? 'CLEAN' : 'REGRESSION', checks }, null, 2))
process.exit(ok ? 0 : 1)
