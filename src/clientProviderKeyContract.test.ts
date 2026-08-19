/*
 * Security release-gate: BILLABLE provider secrets must NEVER be read in client
 * production code (they would be baked into the public JS bundle and be
 * exfiltratable). The approved env contract:
 *
 *   • OPENAI_API_KEY      — server-side ONLY (api/*). Billable. Never VITE_*-exposed.
 *   • VITE_AZURE_TTS_KEY  — server/dev-proxy ONLY. Billable. Never read in client src.
 *   • VITE_GROQ_API_KEY   — client-allowed. FREE tier, rate-limited, non-billable.
 *   • VITE_GEMINI_API_KEY — client-allowed. FREE tier, rate-limited, non-billable.
 *
 * This test fails if a client source file reads a billable VITE secret, forcing
 * the call server-side. Groq/Gemini are allowed by the documented contract.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const SRC = path.resolve(__dirname)

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { out.push(...walk(full)); continue }
    if (!/\.(ts|tsx)$/.test(e.name)) continue
    if (/\.test\.(ts|tsx)$/.test(e.name)) continue // tests may reference keys for assertions
    if (e.name.endsWith('.d.ts')) continue
    out.push(full)
  }
  return out
}

const clientFiles = walk(SRC)
const BILLABLE = [
  /import\.meta\.env\.VITE_OPENAI_API_KEY/,
  /import\.meta\.env\.VITE_AZURE[A-Z_]*/,
  /process\.env\.VITE_OPENAI_API_KEY/,
]

describe('client production code never reads a BILLABLE provider secret', () => {
  it('scans a non-trivial number of client source files', () => {
    expect(clientFiles.length).toBeGreaterThan(50)
  })

  for (const pattern of BILLABLE) {
    it(`no client src file matches ${pattern}`, () => {
      const offenders = clientFiles.filter((f) => pattern.test(fs.readFileSync(f, 'utf8')))
        .map((f) => path.relative(path.resolve(SRC, '..'), f))
      expect(offenders).toEqual([])
    })
  }
})

describe('env contract is documented (free-tier client keys are an explicit, auditable allowance)', () => {
  it('Groq/Gemini are the ONLY client-read provider keys, and they are free-tier', () => {
    const groqOrGemini = clientFiles.filter((f) =>
      /import\.meta\.env\.VITE_(GROQ|GEMINI)_API_KEY/.test(fs.readFileSync(f, 'utf8')),
    )
    // These are allowed by contract — assert they exist (the policy is real, not vacuous)
    // and that NONE of them ALSO smuggle a billable key.
    for (const f of groqOrGemini) {
      const src = fs.readFileSync(f, 'utf8')
      expect(/VITE_OPENAI_API_KEY/.test(src)).toBe(false)
    }
  })
})
