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
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_TEST = 'src/services/textHarness/report.test.ts'
const OUT_JSON = resolve(REPO, 'docs', 'eval', 'TEXT_HARNESS_RESULTS.json')

/**
 * Load the harness's credential from the local env files into process.env, since
 * vitest does NOT auto-load them. Only two keys are honoured (never a blind dump):
 *   OPENAI_API_KEY     — the server-side key the live path + harness read
 *   TEXT_HARNESS_MODEL — optional model override
 * Precedence: an already-exported process.env value wins, then .env.local, then
 * .env. The literal placeholder PUT_KEY_HERE (and empty) is treated as UNSET, so a
 * freshly-created template never sends a bogus key.
 */
function loadHarnessEnv(): void {
  const ALLOW = ['OPENAI_API_KEY', 'TEXT_HARNESS_MODEL']
  const files = ['.env.local', '.env'] // .env.local overrides .env (Vite semantics)
  for (const rel of files) {
    const p = resolve(REPO, rel)
    if (!existsSync(p)) continue
    let text: string
    try { text = readFileSync(p, 'utf8') } catch { continue }
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      if (!ALLOW.includes(k)) continue
      if (process.env[k]) continue // already set (export or earlier file) wins
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
      if (!v || v === 'PUT_KEY_HERE') continue // placeholder / empty → leave unset
      process.env[k] = v
    }
  }
}
loadHarnessEnv()

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
