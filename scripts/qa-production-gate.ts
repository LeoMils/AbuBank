/*
 * `npm run qa:production-gate` — the deterministic CLI wrapper.
 * ══════════════════════════════════════════════════════════════════════════
 * Reads the derived scorecard, supplies the REAL git HEAD, runs the pure
 * evaluator, writes a machine-readable status cache (consumed by the Stop guard),
 * prints a one-screen evaluator summary, and exits nonzero while ANY automatable
 * Critical/High row is open. Flags:
 *   --scorecard <path>   (default: docs/engineering-os/qa/production-convergence/scorecard.json)
 *   --fast               skip git-commit staleness (fast path for the Stop hook)
 *   --json               print the raw GateResult as JSON
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateGate, formatGateResult, type GateResult } from '../src/engineering-os/productionGate'

// Windows-safe repo root (fileURLToPath, not raw URL.pathname which yields /C:/...).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** Repo-relative existence — defeats deleted/nonexistent cited evidence. */
const fileExists = (rel: string): boolean => existsSync(resolve(REPO_ROOT, rel))

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? '') : dflt
}
const fast = process.argv.includes('--fast')
const asJson = process.argv.includes('--json')
const scorecardPath = resolve(arg('--scorecard', 'docs/engineering-os/qa/production-convergence/scorecard.json')!)

let actualCommit: string | undefined
if (!fast) {
  try { actualCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() } catch { actualCommit = undefined }
}

let scorecard: unknown = null
let parseError: string | null = null
try { scorecard = JSON.parse(readFileSync(scorecardPath, 'utf8')) }
catch (e) { parseError = e instanceof Error ? e.message : String(e) }

// Required Critical/High inventory ids (manifest) — reconciled against rows so a
// deleted/omitted row cannot pass. Missing manifest is itself a fail reason.
let requiredInventoryIds: string[] = []
let inventoryError: string | null = null
try {
  const inv = JSON.parse(readFileSync(join(dirname(scorecardPath), 'product-inventory.json'), 'utf8')) as { required?: { id: string }[] }
  requiredInventoryIds = (inv.required ?? []).map((r) => r.id)
} catch (e) { inventoryError = e instanceof Error ? e.message : String(e) }

let result: GateResult
if (parseError) {
  result = { pass: false, commit: 'UNKNOWN', build: 'UNKNOWN', totalsBySeverity: {}, automatableCriticalHighTotal: 0, automatableCriticalHighOpen: 1, physicalCount: 0, externalCount: 0, reasons: [{ id: '(root)', code: 'UNREADABLE_SCORECARD', detail: parseError }] }
} else {
  result = evaluateGate(scorecard, { actualCommit, fast, fileExists, requiredInventoryIds })
  if (inventoryError) result.reasons.push({ id: '(root)', code: 'MISSING_INVENTORY_MANIFEST', detail: inventoryError })
  if (inventoryError) result.pass = false
}

// Status cache for the lightweight Stop guard (no re-computation on every Stop).
const cachePath = join(dirname(scorecardPath), 'gate-status.json')
try {
  writeFileSync(cachePath, JSON.stringify({
    pass: result.pass,
    automatableCriticalHighOpen: result.automatableCriticalHighOpen,
    automatableCriticalHighTotal: result.automatableCriticalHighTotal,
    commit: result.commit, build: result.build,
    reasonCodes: result.reasons.map((r) => r.code),
  }, null, 2) + '\n')
} catch { /* cache is best-effort */ }

if (asJson) console.log(JSON.stringify(result, null, 2))
else console.log(formatGateResult(result))

process.exit(result.pass ? 0 : 1)
