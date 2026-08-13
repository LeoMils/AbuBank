/*
 * O5 — health-alert decision + probe. A silent failure (outage / missing env) MUST
 * produce alert=true and a RED Hebrew line, so the nightly cron fires Leo's notification
 * instead of falsely reporting green.
 */
import { describe, it, expect } from 'vitest'
import { evaluateHealth, probeHealth } from './healthAlert'

describe('evaluateHealth — silent failure cannot pass as green', () => {
  it('unreachable → alert, RED line', () => {
    const d = evaluateHealth({ reachable: false, ok: false })
    expect(d.alert).toBe(true); expect(d.healthy).toBe(false)
    expect(d.hebrewLine).toContain('🔴')
  })
  it('reachable but ok=false (missing env) → alert, RED line', () => {
    const d = evaluateHealth({ reachable: true, ok: false })
    expect(d.alert).toBe(true); expect(d.hebrewLine).toContain('🔴')
  })
  it('healthy → no alert, GREEN line with version', () => {
    const d = evaluateHealth({ reachable: true, ok: true, buildVersion: '0.234.0' })
    expect(d.alert).toBe(false); expect(d.healthy).toBe(true)
    expect(d.hebrewLine).toContain('🟢'); expect(d.hebrewLine).toContain('0.234.0')
  })
})

describe('probeHealth — maps a real fetch to a decision', () => {
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch

  it('200 + ok:true → healthy, no alert', async () => {
    const d = await probeHealth('https://x', ok({ ok: true, buildVersion: '0.234.0' }))
    expect(d.healthy).toBe(true); expect(d.alert).toBe(false)
  })
  it('200 + ok:false → alert', async () => {
    const d = await probeHealth('https://x', ok({ ok: false }))
    expect(d.alert).toBe(true)
  })
  it('non-2xx → alert (ok=false path)', async () => {
    const bad = (async () => new Response('err', { status: 503 })) as unknown as typeof fetch
    expect((await probeHealth('https://x', bad)).alert).toBe(true)
  })
  it('fetch throws (unreachable) → alert', async () => {
    const boom = (async () => { throw new Error('network') }) as unknown as typeof fetch
    const d = await probeHealth('https://x', boom)
    expect(d.alert).toBe(true); expect(d.reason).toContain('unreachable')
  })
})
