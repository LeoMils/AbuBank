#!/usr/bin/env node
'use strict'
/*
 * SessionStart guard — prints an orientation banner. Purely informational,
 * never blocks. Fail-safe: any error → silent exit 0. Disable: ABU_HOOKS_DISABLE=1.
 */
const { DISABLED, projectDir, fs, path } = require('./_lib.cjs')
const cp = require('child_process')

function sh(cmd) { try { return cp.execSync(cmd, { cwd: projectDir(), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' } }

try {
  if (DISABLED) process.exit(0)
  const root = projectDir()
  let version = 'unknown'
  try {
    const v = fs.readFileSync(path.join(root, 'src', 'version.ts'), 'utf8')
    const m = v.match(/version:\s*'([^']+)'/); if (m) version = m[1]
  } catch {}
  const branch = sh('git rev-parse --abbrev-ref HEAD') || 'unknown'
  const dirty = sh('git status --short')
  const changed = dirty ? dirty.split('\n').length : 0

  let p0 = ''
  try {
    const b = fs.readFileSync(path.join(root, '.claude', 'project_state', 'P0_BLOCKERS.md'), 'utf8')
    p0 = (b.split('\n').find((l) => /P0/i.test(l) && !/^#/.test(l)) || '').trim()
  } catch {}

  const lines = []
  lines.push('── AbuBank · Engineering OS ─────────────────────────────')
  lines.push(`build: ${version}   branch: ${branch}   working-tree: ${changed} changed`)
  if (/^main$/i.test(branch)) lines.push('⚠️  You are on MAIN. Do not commit/deploy here without explicit approval.')
  if (p0) lines.push(`P0: ${p0.slice(0, 100)}`)
  lines.push('Acceptance truth: docs/engineering-os/PRODUCTION_ACCEPTANCE_BOARD.md')
  lines.push('Evidence: CODE < MOCK < BROWSER < PREVIEW < PHYSICAL_DEVICE < PRODUCTION — never overclaim.')
  lines.push('─────────────────────────────────────────────────────────')

  // SessionStart: stdout is added as context. Keep it short.
  process.stdout.write(lines.join('\n') + '\n')
  process.exit(0)
} catch (_e) {
  process.exit(0)
}
