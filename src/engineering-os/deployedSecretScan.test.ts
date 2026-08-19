/*
 * deployedSecretScan.test.ts — CALIBRATE the security detector before it is release authority. (A2)
 * clean A → CLEAN · synthetic dirty B → EXPOSED · swap → outcomes swap · unreachable → fail-closed
 * (never CLEAN) · minified/inlined synthetic credential in a LAZY chunk → EXPOSED (chunk-graph crawl) ·
 * public config → specificity CLEAN · synthetic secret removed → restoration CLEAN. Calibration inputs
 * are synthetic; the real certification candidate is never contaminated.
 */
import { describe, it, expect } from 'vitest'
import { scanTarget, scanTargets, type ScanFetch } from './deployedSecretScan'

// A fake OpenAI-shaped token — NOT a real key. Used only to prove the detector fires.
const PLANTED = `sk-proj-${'A1b2C3d4'.repeat(6)}xyz`

/** Mock a deployed site: '/' returns HTML referencing the chunk keys; each key returns its content. */
function mockSite(chunks: Record<string, string>): ScanFetch {
  return async (url: string) => {
    const path = new URL(url).pathname
    if (path === '/' || path === '') {
      const refs = Object.keys(chunks).map((k) => `<script type="module" src="${k}"></script>`).join('')
      return { ok: true, text: async () => `<!doctype html><html><head>${refs}</head></html>` }
    }
    const c = chunks[path]
    if (c === undefined) return { ok: false, text: async () => '' }
    return { ok: true, text: async () => c }
  }
}
const CLEAN_SITE = mockSite({ '/assets/index-clean.js': 'const v="0.288.0";const city="Kfar Saba";' })
const DIRTY_SITE = mockSite({ '/assets/index-dirty.js': `const k="${PLANTED}";const v="0.288.0";` })

describe('deployed secret scanner — calibration (QA-of-QA)', () => {
  it('clean target → CLEAN', async () => {
    const r = await scanTarget('https://clean.example', CLEAN_SITE)
    expect(r.verdict).toBe('CLEAN')
    expect(r.reachable).toBe(true)
    expect(r.findings.length).toBe(0)
  })

  it('synthetic dirty target → EXPOSED (credential MATERIAL, not just names)', async () => {
    const r = await scanTarget('https://dirty.example', DIRTY_SITE)
    expect(r.verdict).toBe('EXPOSED')
    expect(r.clean).toBe(false)
    expect(r.findings.length).toBeGreaterThan(0)
    // redacted only — the raw token value is never surfaced.
    for (const f of r.findings) expect(f.redactedFingerprint).not.toContain(PLANTED)
  })

  it('swap targets → outcomes swap; any dirty target fails the whole scan', async () => {
    const clean = await scanTargets(['https://clean.example'], CLEAN_SITE)
    expect(clean.pass).toBe(true)
    const withDirty = await scanTargets(['https://a.example', 'https://b.example'], mockSite({
      '/assets/a.js': 'const ok="clean";',
      '/assets/b.js': `const k="${PLANTED}";`,
    }))
    expect(withDirty.pass).toBe(false)
  })

  it('UNREACHABLE target → fail closed, NEVER CLEAN', async () => {
    const thrown = await scanTarget('https://down.example', async () => { throw new Error('ECONNREFUSED') })
    expect(thrown.verdict).toBe('UNREACHABLE')
    expect(thrown.verdict).not.toBe('CLEAN')
    const notOk = await scanTarget('https://5xx.example', async () => ({ ok: false, text: async () => '' }))
    expect(notOk.verdict).toBe('UNREACHABLE')
  })

  it('a no-http / empty target is refused (UNREACHABLE), never silently certified', async () => {
    expect((await scanTarget('', CLEAN_SITE)).verdict).toBe('UNREACHABLE')
    expect((await scanTarget('not-a-url', CLEAN_SITE)).verdict).toBe('UNREACHABLE')
  })

  it('minified/inlined credential in a LAZY chunk (not in HTML) is still caught (chunk-graph crawl)', async () => {
    const site = mockSite({
      '/assets/entry.js': 'console.log("app");import("./assets/lazy-9f3a.js");',   // entry references the lazy chunk
      '/assets/lazy-9f3a.js': `const t="${PLANTED}";`,                              // the token hides in the lazy chunk
    })
    const r = await scanTarget('https://lazy.example', site)
    expect(r.chunks).toBeGreaterThanOrEqual(2)
    expect(r.verdict).toBe('EXPOSED')
  })

  it('public client configuration → specificity CLEAN (VITE_APP_VERSION is not a leak)', async () => {
    const r = await scanTarget('https://pub.example', mockSite({ '/assets/i.js': 'const x="VITE_APP_VERSION=0.288.0";const c="VITE_COMMIT_SHA=abc";' }))
    expect(r.verdict).toBe('CLEAN')
    expect(r.confirmedSecretNames.length).toBe(0)
  })

  it('restoration: removing the synthetic secret returns to CLEAN', async () => {
    expect((await scanTarget('https://x.example', DIRTY_SITE)).verdict).toBe('EXPOSED')
    expect((await scanTarget('https://x.example', CLEAN_SITE)).verdict).toBe('CLEAN')
  })
})
