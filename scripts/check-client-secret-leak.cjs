#!/usr/bin/env node
/*
 * check-client-secret-leak.cjs — build-time guard against baking a BILLABLE
 * provider key into the public client bundle.
 *
 * WHY: src/clientProviderKeyContract.test.ts already blocks client *source* from
 * READING VITE_OPENAI_API_KEY / VITE_AZURE*. But a key can still leak a different
 * way: if VITE_OPENAI_API_KEY (or VITE_AZURE_TTS_KEY) is set in the *build
 * environment*, Vite bakes it into the bundle even if no code reads it via a
 * `define`-style inline. This guard closes that env-time gap.
 *
 * Contract: docs/abuai/ENV_CONTRACT.md
 * Evidence class: CODE (deterministic). Not a device/production claim.
 *
 * Usage:
 *   node scripts/check-client-secret-leak.cjs            # checks process.env
 *   node scripts/check-client-secret-leak.cjs --built    # also scans dist/ for sk- tokens
 *
 * Exit 0 = clean. Exit 1 = a billable client-exposed secret was found.
 * Fail-safe: unexpected internal errors exit 0 (never block a build on a bug in
 * the guard itself) EXCEPT a real detected leak, which always exits 1.
 */
'use strict'

const BILLABLE_CLIENT_ENV = ['VITE_OPENAI_API_KEY', 'VITE_AZURE_TTS_KEY']

function main() {
  const offenders = []
  for (const name of BILLABLE_CLIENT_ENV) {
    const v = process.env[name]
    if (typeof v === 'string' && v.trim().length > 0) offenders.push(name)
  }

  if (offenders.length > 0) {
    console.error('\n❌ CLIENT SECRET LEAK: billable key set in the build environment:')
    for (const o of offenders) console.error(`   - ${o} is set → Vite would bake it into the public bundle.`)
    console.error('   Fix: unset it in the build env. Billable calls go through api/* using OPENAI_API_KEY.')
    console.error('   Policy: docs/abuai/ENV_CONTRACT.md\n')
    process.exit(1)
  }

  // Optional: scan a built bundle for raw OpenAI-style tokens.
  if (process.argv.includes('--built')) {
    try {
      const fs = require('fs')
      const path = require('path')
      const dist = path.resolve(__dirname, '..', 'dist')
      if (fs.existsSync(dist)) {
        const tokenRe = /sk-[A-Za-z0-9_-]{20,}/
        const stack = [dist]
        while (stack.length) {
          const dir = stack.pop()
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name)
            if (e.isDirectory()) { stack.push(full); continue }
            if (!/\.(js|mjs|cjs|html|map)$/.test(e.name)) continue
            const txt = fs.readFileSync(full, 'utf8')
            if (tokenRe.test(txt)) {
              console.error(`\n❌ CLIENT SECRET LEAK: an sk- token appears in a built asset: ${path.relative(dist, full)}\n`)
              process.exit(1)
            }
          }
        }
      }
    } catch (err) {
      // Guard bug → do not block the build. A real leak above already exited 1.
      console.error('[secret-leak-guard] dist scan skipped (non-fatal):', err && err.message)
    }
  }

  console.log('✅ secret-leak guard: no billable client-exposed key in build env.')
}

main()
