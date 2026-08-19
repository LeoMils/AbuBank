/*
 * ABU AI — Stop hook guard (fast, dependency-free, loop-safe).
 * ══════════════════════════════════════════════════════════════════════════
 * Wired as a project Stop hook in .claude/settings.json. It is a no-op unless the
 * operator ARMS the production goal by creating `.claude/.abu-goal-active`. When
 * armed, it reads the cached gate status (written by `npm run qa:production-gate`)
 * and blocks a premature turn-end while automatable Critical/High work is open —
 * with a hard loop backstop (releases after MAX_BLOCKS consecutive blocks).
 *
 * The decision mirrors the unit-tested src/engineering-os/stopGuard.ts (kept in
 * sync deliberately; the .mjs stays dependency-free so the Stop hook never spawns
 * tsx or the full suite). Rollback: delete this file + the Stop hook entry in
 * .claude/settings.json, and remove .claude/.abu-goal-active.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const FLAG = '.claude/.abu-goal-active'
const COUNT = '.claude/.abu-stop-block-count'
const CACHE = 'docs/engineering-os/qa/production-convergence/gate-status.json'
const MAX_BLOCKS = 3

// Drain stdin (Claude Code passes hook JSON incl. stop_hook_active) — best effort.
let stopHookActive = false
try {
  const raw = readFileSync(0, 'utf8')
  if (raw) stopHookActive = Boolean(JSON.parse(raw).stop_hook_active)
} catch { /* no stdin / not JSON — ignore */ }

function allow() { process.exit(0) }

if (!existsSync(FLAG)) allow()                       // goal not armed → normal workflow untouched

let gatePass = false, openCount = 0
try {
  const c = JSON.parse(readFileSync(CACHE, 'utf8'))
  gatePass = Boolean(c.pass)
  openCount = Number(c.automatableCriticalHighOpen ?? 0)
} catch { openCount = 0; gatePass = true } // no cache → don't trap; treat as pass

if (gatePass) { try { writeFileSync(COUNT, '0') } catch {} allow() }

let blockCount = 0
try { blockCount = Number(readFileSync(COUNT, 'utf8').trim()) || 0 } catch { blockCount = 0 }

// Loop backstop: a live stop_hook_active continuation counts toward the cap too.
if (blockCount >= MAX_BLOCKS || (stopHookActive && blockCount >= MAX_BLOCKS - 1)) {
  try { writeFileSync(COUNT, '0') } catch {}
  allow()
}

try { writeFileSync(COUNT, String(blockCount + 1)) } catch {}
const reason = `Production goal is armed and qa:production-gate reports ${openCount} open automatable Critical/High row(s). ` +
  `Continue the critical path (.claude/skills/abu-production/SKILL.md) or run \`npm run qa:production-gate\` for the open list. ` +
  `To disarm: delete ${FLAG}.`
process.stdout.write(JSON.stringify({ decision: 'block', reason }))
process.exit(0)
