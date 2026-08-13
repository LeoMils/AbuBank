/*
 * /api/cron/nightly handler — the scheduled endpoint now PROBES /api/health (O5) and emits
 * the Leo-only status/notification. Proves: a healthy deploy → green + ok:true; an unhealthy
 * or unreachable deploy → RED line + ok:false so Leo's notification fires (silent failure
 * cannot pass as green). Never Martita-facing.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import handler from '../../api/cron/nightly'

const stubHealth = (body: unknown, status = 200) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))

afterEach(() => vi.unstubAllGlobals())

describe('/api/cron/nightly', () => {
  it('healthy /api/health → green line, ok:true, honest infra note', async () => {
    stubHealth({ ok: true, buildVersion: '0.235.0' })
    const res = await handler(new Request('https://x/api/cron/nightly'))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; hebrewLine: string; notification: { channel: string }; infraNote: string; health: { healthy: boolean } }
    expect(body.ok).toBe(true)
    expect(body.hebrewLine).toMatch(/^🟢 הכל תקין/)     // may carry a (version) suffix
    expect(body.health.healthy).toBe(true)
    expect(body.notification.channel).toBe('status-page') // honest fallback (no email provider)
    expect(body.infraNote).toContain('NOT configured in this infra')
  })

  it('unreachable /api/health → RED line + ok:false (silent failure surfaces)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const res = await handler(new Request('https://x/api/cron/nightly'))
    const body = await res.json() as { ok: boolean; hebrewLine: string; health: { healthy: boolean; alert: boolean } }
    expect(body.ok).toBe(false)
    expect(body.hebrewLine).toContain('🔴')
    expect(body.health.alert).toBe(true)
  })

  it('ok:false /api/health (missing env) → RED line + ok:false', async () => {
    stubHealth({ ok: false })
    const res = await handler(new Request('https://x/api/cron/nightly'))
    const body = await res.json() as { ok: boolean; hebrewLine: string }
    expect(body.ok).toBe(false)
    expect(body.hebrewLine).toContain('🔴')
  })

  it('honors a CRON_SECRET guard when set (Leo-only)', async () => {
    stubHealth({ ok: true })
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'shh'
    try {
      const denied = await handler(new Request('https://x/api/cron/nightly'))
      expect(denied.status).toBe(401)
      const ok = await handler(new Request('https://x/api/cron/nightly?key=shh'))
      expect(ok.status).toBe(200)
    } finally { if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev }
  })
})
