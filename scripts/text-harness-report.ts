/*
 * scripts/text-harness-report.ts — the gate entry point for the text harness.
 * ════════════════════════════════════════════════════════════════════════════
 * Wired into `npm run qa:production-gate`. Runs the Vite-aware report test (which
 * resolves the `?raw` knowledge imports) with TEXT_HARNESS_RUN=1, so it:
 *   • prints the exact build-time session instructions + the three word counts,
 *   • drives all 40 scenarios through the shared live reasoning/tool/turn loop,
 *   • prints every transcript, tool call and violation,
 *   • writes docs/eval/TEXT_HARNESS_RESULTS.json.
 *
 * This wrapper ALWAYS exits 0 — the harness is INFORMATIONAL for the gate (this
 * milestone makes failures visible, it does not fix them, and it must not change
 * the production gate's own pass/fail verdict). After the run it echoes the summary
 * + word counts from the JSON so they are guaranteed to appear in gate output.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadHarnessEnv } from '../src/services/textHarness/loadHarnessEnv'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_TEST = 'src/services/textHarness/report.test.ts'
const OUT_JSON = resolve(REPO, 'docs', 'eval', 'TEXT_HARNESS_RESULTS.json')

// The ONE shared loader (also used by report.test.ts): reads OPENAI_API_KEY from
// .env.local then .env so the harness is never falsely BLOCKED when the key is here.
loadHarnessEnv(REPO)

console.log('\n╔══════════════════════════════════════════════════════════════════╗')
console.log('║  ABU AI — TEXT-MODE CONVERSATION HARNESS (informational)          ║')
console.log('╚══════════════════════════════════════════════════════════════════╝')

const res = spawnSync('npx', ['vitest', 'run', REPORT_TEST], {
  cwd: REPO,
  env: { ...process.env, TEXT_HARNESS_RUN: '1' },
  stdio: 'inherit',
  shell: true,
})

if (res.error) console.log('text-harness run error:', res.error.message)

try {
  const json = JSON.parse(readFileSync(OUT_JSON, 'utf8')) as {
    driver: string
    wordCounts: Record<string, number>
    summary: { total: number; pass: number; fail: number; blocked: number }
  }
  const s = json.summary
  console.log('\n──────────────── TEXT HARNESS SUMMARY (for the gate) ────────────────')
  console.log(`  driver:        ${json.driver}`)
  console.log(`  scenarios:     ${s.pass}/${s.total} PASS · ${s.fail} FAIL · ${s.blocked} BLOCKED`)
  console.log('  word counts:')
  for (const [f, n] of Object.entries(json.wordCounts)) console.log(`    ${f}: ${n} words`)
  console.log('─────────────────────────────────────────────────────────────────────\n')
} catch {
  console.log('(text-harness JSON report not found — see the vitest output above)')
}

// SCENARIO results are informational (never block the gate) — the report test passes
// even when scenarios fail. But the always-on GATE GUARD (instructions-vs-tools) DOES
// fail the report test, which makes vitest exit nonzero. Propagate that so an implied-
// but-toolless capability blocks qa:production-gate and can never silently return.
if (res.status && res.status !== 0) {
  console.log('\n⛔ GATE BLOCKED: the instructions-vs-tools honesty guard failed (see above).')
  process.exit(res.status)
}
process.exit(0)
