#!/usr/bin/env node
/**
 * `npm run dev:https` — start the Vite dev server over HTTPS so the iPhone can
 * use the microphone (iOS Safari requires a secure context for getUserMedia).
 *
 * 1. Generates / refreshes a self-signed cert covering this machine's LAN IPs.
 * 2. Starts Vite with VITE_HTTPS=1 (vite.config reads the cert from tmp/dev-cert/).
 *
 * Cross-platform: sets the env var in-process and spawns the local Vite binary,
 * so it needs no cross-env dependency and works the same in PowerShell and bash.
 */
const { execSync, spawn } = require('child_process')
const path = require('path')

try {
  execSync('node scripts/generate-dev-cert.cjs', { stdio: 'inherit' })
} catch (e) {
  console.error('\n[dev:https] Could not generate the dev certificate.')
  console.error('[dev:https] openssl is required (ships with Git for Windows).')
  console.error('[dev:https] Detail:', e && e.message ? e.message : e)
  process.exit(1)
}

const isWin = process.platform === 'win32'
const viteBin = path.resolve(
  __dirname, '..', 'node_modules', '.bin', isWin ? 'vite.cmd' : 'vite',
)

const child = spawn(viteBin, process.argv.slice(2), {
  stdio: 'inherit',
  shell: isWin, // .cmd shim needs a shell on Windows
  env: { ...process.env, VITE_HTTPS: '1' },
})

child.on('exit', (code) => process.exit(code == null ? 0 : code))
child.on('error', (err) => {
  console.error('[dev:https] Failed to start Vite:', err.message)
  process.exit(1)
})
