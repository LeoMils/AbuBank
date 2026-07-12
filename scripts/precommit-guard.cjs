#!/usr/bin/env node
'use strict'
/*
 * Fast pre-commit guard (fast commits, strict releases).
 * ─────────────────────────────────────────────────────
 * Replaces the old "run the entire 297-file vitest suite on every commit" hook
 * (which was slow and pushed people toward --no-verify). The FULL suite is a
 * RELEASE / CI gate (docs/engineering-os/RELEASE_TEST_STRATEGY.md), not a commit gate.
 *
 * This guard is FAST and does only:
 *   1. staged-file inventory
 *   2. privacy/secret scan (fail-CLOSED — blocks the commit)
 *   3. version-contract consistency (version.ts ↔ api/health.ts)
 *   4. family data validation — ONLY if family_data.json is staged
 *
 * Disable: ABU_HOOKS_DISABLE=1 (or `git commit --no-verify`). Secret/privacy
 * checks fail-closed; other checks are best-effort (a guard bug won't block work).
 */
const cp = require('child_process')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
function git(args) { try { return cp.execSync(`git ${args}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString() } catch { return '' } }

if (process.env.ABU_HOOKS_DISABLE === '1') { console.log('pre-commit: disabled via ABU_HOOKS_DISABLE'); process.exit(0) }

const staged = git('diff --cached --name-only --diff-filter=ACM').split('\n').map((s) => s.trim()).filter(Boolean)
if (staged.length === 0) { console.log('pre-commit: nothing staged.'); process.exit(0) }

console.log(`🔍 pre-commit: ${staged.length} staged file(s).`)
const hardErrors = []

// 1) Never stage secret/private files.
for (const f of staged) {
  const base = f.split('/').pop() || f
  if (/^\.env(\.[A-Za-z]+)?$/.test(base) && base !== '.env.example') hardErrors.push(`refusing to commit secret file: ${f}`)
  if (/\.local\.json$/.test(base) || /\.private\.json$/.test(base)) hardErrors.push(`refusing to commit private data file: ${f}`)
  if (/^private\//.test(f)) hardErrors.push(`refusing to commit private/ path: ${f}`)
}

// 2) Scan staged CONTENT for real secrets / phone numbers.
const SECRET = /sk-[A-Za-z0-9]{20,}/            // real OpenAI-style token (not the "sk-[A-Za-z...]" regex literal in guards)
const PHONE = /(^|[^0-9])(\+9725\d{8}|05\d{8})([^0-9]|$)/
for (const f of staged) {
  const base = f.split('/').pop() || f
  const content = git(`show :${f}`)
  if (!content) continue
  if (SECRET.test(content)) hardErrors.push(`possible secret token in staged ${f}`)
  // Phone numbers: only worry in committed data/source, not tests/docs/examples.
  const isTestOrDoc = /\.(test|spec)\.[tj]sx?$/.test(base) || /\.example$/.test(base) || /^docs\//.test(f) || /^\.claude\//.test(f)
  if (!isTestOrDoc && PHONE.test(content)) hardErrors.push(`possible real phone number in staged ${f} (privacy)`)
}

// 3) Version-contract consistency (fast grep; best-effort).
try {
  const ver = git('show :src/version.ts') || require('fs').readFileSync(path.join(ROOT, 'src/version.ts'), 'utf8')
  const health = git('show :api/health.ts') || require('fs').readFileSync(path.join(ROOT, 'api/health.ts'), 'utf8')
  const v = (ver.match(/version:\s*'([^']+)'/) || [])[1]
  const h = (health.match(/const BUILD_VERSION = '([^']+)'/) || [])[1]
  if (v && h && v !== h) hardErrors.push(`version drift: version.ts (${v}) ≠ api/health.ts BUILD_VERSION (${h}). See VERSION_CONTRACT.md`)
} catch { /* best-effort */ }

// 4) Family validation only when family data is staged.
if (staged.includes('knowledge/family_data.json')) {
  console.log('   family_data.json staged → running validate:family …')
  try { cp.execSync('npm run validate:family --silent', { cwd: ROOT, stdio: 'inherit' }) }
  catch { hardErrors.push('family data validation failed (npm run validate:family)') }
}

if (hardErrors.length) {
  console.error('\n❌ COMMIT BLOCKED:')
  for (const e of hardErrors) console.error(`   - ${e}`)
  console.error('\nFix the above, or (if truly intended) `git commit --no-verify`.\n')
  process.exit(1)
}
console.log('✅ pre-commit: fast checks passed. (Full suite runs in CI / release gate.)')
process.exit(0)
