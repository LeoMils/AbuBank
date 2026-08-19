/*
 * ABU AI — production goal arm/status/disarm (deterministic, Windows-safe).
 * ══════════════════════════════════════════════════════════════════════════
 * Controls whether the Stop guard (scripts/abu-stop-guard.mjs) enforces the
 * production gate at turn-end. The guard is a NO-OP until armed here.
 *   npm run abu:goal:arm      -> create .claude/.abu-goal-active (guard enforces)
 *   npm run abu:goal:status   -> print armed state + cached gate result
 *   npm run abu:goal:disarm   -> remove flag + block counter (normal workflow)
 * Arm this as the FIRST step of the execution phase; disarm when the gate passes
 * or to hand back to normal development.
 */
import { existsSync, writeFileSync, rmSync, readFileSync } from 'node:fs'

const FLAG = '.claude/.abu-goal-active'
const COUNT = '.claude/.abu-stop-block-count'
const CACHE = 'docs/engineering-os/qa/production-convergence/gate-status.json'
const cmd = process.argv[2]

function readCache() {
  try { return JSON.parse(readFileSync(CACHE, 'utf8')) } catch { return null }
}

if (cmd === 'arm') {
  writeFileSync(FLAG, 'production goal active — Stop guard enforces qa:production-gate\n')
  try { writeFileSync(COUNT, '0') } catch { /* ignore */ }
  console.log('ARMED — Stop guard will block premature turn-end while the gate reports open work.')
} else if (cmd === 'disarm') {
  try { rmSync(FLAG) } catch { /* already absent */ }
  try { rmSync(COUNT) } catch { /* already absent */ }
  console.log('DISARMED — normal workflow; Stop guard is a no-op.')
} else if (cmd === 'status') {
  const armed = existsSync(FLAG)
  const c = readCache()
  console.log(`goal: ${armed ? 'ARMED' : 'disarmed'}`)
  if (c) console.log(`gate cache: ${c.pass ? 'PASS' : 'FAIL'} · open automatable Critical/High = ${c.automatableCriticalHighOpen}/${c.automatableCriticalHighTotal} · build ${c.build}`)
  else console.log('gate cache: (none yet — run `npm run qa:production-gate`)')
} else {
  console.log('usage: node scripts/abu-goal.mjs <arm|status|disarm>')
  process.exit(2)
}
