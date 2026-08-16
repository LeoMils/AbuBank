/*
 * CLIENT-SECRET FAIL-CLOSED RELEASE GATE (P0 remediation).
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Zero client-side provider credential reads are allowed. This gate scans the REAL src/ tree
 * and goes RED if ANY `import.meta.env.VITE_*_API_KEY` provider-secret read is (re)introduced —
 * billable OR free-tier. It is the release-critical mirror of serverCredentialContract.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanClientSource, summarizeClientSecretReads, type ClientSecretRead } from './clientSecretFallback'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function clientFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, d.name)
      if (d.isDirectory()) walk(full)
      else if ((d.name.endsWith('.ts') || d.name.endsWith('.tsx')) && !/\.test\.tsx?$/.test(d.name)) out.push(full)
    }
  }
  walk(resolve(ROOT, 'src'))
  return out
}

describe('client-secret fail-closed gate — ZERO client provider credential reads', () => {
  const reads: ClientSecretRead[] = []
  for (const f of clientFiles()) {
    const rel = f.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
    reads.push(...scanClientSource(rel, readFileSync(f, 'utf8')))
  }
  const summary = summarizeClientSecretReads(reads)

  it('non-vacuous: the gate actually scanned client files', () => {
    expect(clientFiles().length).toBeGreaterThan(20)
  })

  it('NO billable client provider secret read exists (a leak-class defect)', () => {
    const billable = reads.filter((r) => r.tier === 'BILLABLE')
    expect(billable, JSON.stringify(billable)).toEqual([])
  })

  it('NO client provider secret read of ANY tier exists (Gemini/Groq removed — fail closed)', () => {
    expect(summary.reads, `client provider-secret reads: ${JSON.stringify(summary.reads)}`).toEqual([])
    expect(summary.clean).toBe(true)
  })
})
