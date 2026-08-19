#!/usr/bin/env node
/*
 * DOM-level mutation harness (Phase M, Layer B/C browser side).
 *
 * The unit harness (scripts/mutation-harness.mjs) runs `vitest` in jsdom, which
 * cannot prove real LAYOUT facts — RTL direction, text overflow/truncation, a
 * rendered touch-target height. Those are BROWSER evidence. This harness mutates a
 * DOM-affecting source, runs ONLY the owning Playwright spec against a running dev
 * server, and records KILLED (spec failed) vs SURVIVED (spec still passed = a gap).
 *
 * PREREQUISITE: a dev server on http://localhost:5175 (npx vite --port 5175 --strictPort).
 * The harness probes it first and refuses to run (clear message) if it is down, so a
 * missing server is never misread as "all mutants survived".
 *
 * Safety: original file content is restored in a finally block for every mutant.
 * Evidence class: BROWSER (real Chromium), NOT device/production — label honestly.
 *
 * Run: node scripts/mutation-harness-e2e.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const R = (p) => join(ROOT, p)
const BASE = process.env.PREVIEW_URL || 'http://localhost:5175'

/** DOM-level mutants: each breaks a real layout/render fact a Playwright spec proves. */
const MUTANTS = [
  {
    id: 'rtl-direction-flipped', layer: 'B/App·RTL', severity: 'P1',
    desc: 'index.html loses dir="rtl" — the Hebrew UI reflows left-to-right',
    file: 'index.html',
    find: '<html lang="he" dir="rtl">',
    replace: '<html lang="he" dir="ltr">',
    owner: 'e2e/rtl-direction.spec.ts', expect: 'kill',
  },
  {
    id: 'touch-target-below-floor', layer: 'B/App·SeniorUX', severity: 'P1',
    desc: 'MIN_TOUCH dropped to 30px — rendered controls fall below the enlarged-text 40px floor',
    file: 'src/design/space.ts',
    find: 'export const MIN_TOUCH = 56',
    replace: 'export const MIN_TOUCH = 30',
    owner: 'e2e/enlarged-text.spec.ts', expect: 'kill',
  },
]

async function serverUp() {
  try {
    const res = await fetch(BASE, { method: 'GET' })
    return res.ok || res.status < 500
  } catch { return false }
}

function runOwner(owner) {
  // Playwright exit 0 = all pass (SURVIVED); non-zero = a spec failed (KILLED).
  try {
    execSync(`npx playwright test ${owner} --project=mobile-chrome --reporter=line`, {
      cwd: ROOT, stdio: 'pipe', timeout: 180000, env: { ...process.env, PREVIEW_URL: BASE },
    })
    return 'survived'
  } catch { return 'killed' }
}

if (!(await serverUp())) {
  console.error(`✗ dev server not reachable at ${BASE}. Start it first:`)
  console.error('    npx vite --port 5175 --strictPort')
  console.error('  (then re-run). Refusing to run — a down server must NOT read as "survived".')
  process.exit(2)
}

const results = []
for (const m of MUTANTS) {
  const path = R(m.file)
  const original = readFileSync(path, 'utf8')
  const occurrences = original.split(m.find).length - 1
  if (occurrences !== 1) {
    results.push({ ...m, verdict: 'ANCHOR_STALE', note: `anchor found ${occurrences}×` })
    console.log(`⚠️  ${m.id}: ANCHOR_STALE (${occurrences}×) — skipped`)
    continue
  }
  try {
    writeFileSync(path, original.replace(m.find, m.replace), 'utf8')
    const outcome = runOwner(m.owner)
    const verdict = outcome === 'killed' ? 'KILLED' : 'SURVIVED'
    results.push({ ...m, verdict })
    console.log(`${verdict === 'KILLED' ? '✅' : '❌'} ${m.id} [${m.severity}] → ${outcome} (${verdict})`)
  } finally {
    writeFileSync(path, original, 'utf8')   // ALWAYS restore
  }
}

const real = results.filter((r) => r.verdict === 'KILLED' || r.verdict === 'SURVIVED')
const killed = real.filter((r) => r.verdict === 'KILLED')
console.log('\n──────── DOM MUTATION REPORT (BROWSER evidence) ────────')
console.log(`Real mutants: ${real.length} | KILLED ${killed.length} | SURVIVED ${real.length - killed.length}`)
const survivors = real.filter((r) => r.verdict === 'SURVIVED')
if (survivors.length) {
  console.log('❌ SURVIVORS (missing Playwright coverage — each needs a red-before-green spec):')
  for (const s of survivors) console.log(`   • ${s.id} [${s.severity}] ${s.file} — ${s.desc}`)
}
process.exit(survivors.length ? 1 : 0)
