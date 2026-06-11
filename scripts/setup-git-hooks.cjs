/**
 * Setup git hooks — safe for CI/Vercel where .git may not exist.
 * Called by package.json "prepare" script.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Check both CWD and script parent — covers local dev and CI
const candidates = [
  path.join(process.cwd(), '.git'),
  path.join(__dirname, '..', '.git'),
]
const hasGit = candidates.some(p => fs.existsSync(p))

if (hasGit) {
  try {
    execSync('git config core.hooksPath .githooks', { stdio: 'inherit' })
  } catch {
    // Non-fatal: hooks are a convenience, not a requirement
    console.log('Skipping git hooks setup: git config failed (non-fatal)')
  }
} else {
  console.log('Skipping git hooks setup: .git not found (CI/deploy environment)')
}
