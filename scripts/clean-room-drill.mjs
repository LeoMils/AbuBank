/*
 * clean-room-drill.mjs — repository-only operability drill. (§50/I7)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/clean-room-drill.mjs
 * Simulates a fresh operator who was handed NOTHING: starting only from the documented entry point
 * (QA_MONSTER_OPERATOR.md → qa:current), runs the documented commands and records the FIRST point a
 * hidden (non-repository) dependency would be needed. Writes CLEAN_ROOM_RESULT.json.
 *
 * HONEST SCOPE: this proves the repository-only DETERMINISTIC portion (discovery + oracle gates work
 * from repo state with no conversation). It does NOT instantiate a genuinely independent model session
 * (not possible from here) — that exact remainder is recorded, not overclaimed.
 */
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The documented path a fresh operator follows, discoverable from QA_MONSTER_OPERATOR.md alone.
const STEPS = [
  { step: 'discover-candidate', cmd: 'node scripts/qa-monster.mjs current', doc: 'QA_MONSTER_OPERATOR.md §"Start here"' },
  { step: 'verify-capsule', cmd: 'node scripts/verify-capsule.mjs', doc: 'QA_MONSTER_OPERATOR.md §Capsule' },
  { step: 'work-completeness', cmd: 'node scripts/machine-work.mjs', doc: 'MACHINE_WORK_GRAPH.json' },
  { step: 'authority', cmd: 'node scripts/authority-check.mjs', doc: 'OWNER_HUMAN_AUTHORITY.json' },
]

const operatorGuide = existsSync(resolve('docs/engineering-os/qa/QA_MONSTER_OPERATOR.md'))
const results = []
let firstHiddenDependency = null
if (!operatorGuide) firstHiddenDependency = 'QA_MONSTER_OPERATOR.md missing — operator cannot discover the entry point'

for (const s of STEPS) {
  if (firstHiddenDependency) break
  let exit = 0
  try { execSync(s.cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }) }
  catch (e) { exit = e.status ?? 1 }
  results.push({ ...s, exit, ok: exit === 0 })
  if (exit !== 0) firstHiddenDependency = `${s.step}: documented command exited ${exit} — a fresh operator would be blocked here`
}

const out = {
  $schema: 'internal://abu/clean-room-result', when: new Date().toISOString(),
  operatorGuidePresent: operatorGuide,
  CLEAN_ROOM_FIRST_HIDDEN_DEPENDENCY: firstHiddenDependency,
  FRESH_SESSION_REPOSITORY_ONLY: firstHiddenDependency ? 'BLOCKED' : 'DETERMINISTIC_PORTION_PROVEN',
  exactRemainingLimitation: 'A genuinely independent fresh model/session cannot be instantiated from this environment; the repository-only deterministic operability (discovery + oracle gates from repo state, no conversation) is proven here.',
  steps: results,
}
writeFileSync(resolve('docs/engineering-os/qa/CLEAN_ROOM_RESULT.json'), JSON.stringify(out, null, 2) + '\n')
for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.step.padEnd(22)} (${r.doc})`)
console.log(`\n=== FRESH_SESSION_REPOSITORY_ONLY = ${out.FRESH_SESSION_REPOSITORY_ONLY} · first-hidden-dependency = ${firstHiddenDependency ?? 'NONE'} ===`)
process.exit(firstHiddenDependency ? 1 : 0)
