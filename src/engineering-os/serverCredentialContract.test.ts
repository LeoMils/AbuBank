/*
 * SERVER-CREDENTIAL CONTRACT — no server-only billable key may be read via a VITE_ name. (P0 2026-08-16)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════
 * A VITE_-prefixed variable is client-exposable: if a server path reads a billable credential via its
 * VITE_ name, that name tends to be SET in the build env and Vite then bakes it into the client bundle
 * (the confirmed 0.286 leak of VITE_OPENAI_API_KEY / VITE_AZURE_TTS_KEY). This contract fails CLOSED if
 * any server file (api/*, vite.config) reads a billable credential through a VITE_ prefix, or keeps an
 * `OPENAI_API_KEY ?? VITE_OPENAI_API_KEY`-style fallback that preserves the unsafe path.
 *
 * Public config (VITE_AZURE_TTS_REGION, VITE_APP_VERSION, VITE_COMMIT_SHA) is deliberately NOT covered.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Billable / server-only credential base names — must never be read via a VITE_ prefix in server code. */
const SERVER_ONLY_CREDENTIALS = [
  'OPENAI_API_KEY', 'AZURE_TTS_KEY', 'BRAVE_API_KEY', 'EXA_API_KEY',
  'OPENROUTER_API_KEY', 'PERPLEXITY_API_KEY', 'TAVILY_API_KEY',
]

function serverFiles(): string[] {
  const files: string[] = []
  const apiDir = resolve(ROOT, 'api')
  if (existsSync(apiDir)) {
    const walk = (dir: string) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, d.name)
        if (d.isDirectory()) walk(full)
        else if (d.name.endsWith('.ts') && !d.name.endsWith('.test.ts')) files.push(full)
      }
    }
    walk(apiDir)
  }
  const viteCfg = resolve(ROOT, 'vite.config.ts')
  if (existsSync(viteCfg)) files.push(viteCfg)
  return files
}

/** Strip line AND block comments so a doc mention of a VITE_ name doesn't false-positive. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
}

describe('server-credential contract — no VITE_ prefix on a server-only billable key', () => {
  const files = serverFiles()

  it('finds server files to audit (non-vacuous)', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const cred of SERVER_ONLY_CREDENTIALS) {
    it(`no server file reads VITE_${cred}`, () => {
      const offenders: string[] = []
      for (const f of files) {
        const src = stripComments(readFileSync(f, 'utf8'))
        if (new RegExp(`VITE_${cred}\\b`).test(src)) offenders.push(f.replace(ROOT, '').replace(/\\/g, '/'))
      }
      expect(offenders, `VITE_${cred} read in server code: ${offenders.join(', ')}`).toEqual([])
    })
  }

  it('no OPENAI ?? VITE_OPENAI fallback pattern remains (unsafe path preserved)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf8'))
      if (/OPENAI_API_KEY\s*\?\?\s*[^\n]*VITE_OPENAI_API_KEY/.test(src)) offenders.push(f.replace(ROOT, '').replace(/\\/g, '/'))
    }
    expect(offenders, `unsafe fallback in: ${offenders.join(', ')}`).toEqual([])
  })
})
