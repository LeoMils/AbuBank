/*
 * /api/cron/nightly handler — the scheduled endpoint runs the server-safe chain and emits
 * the Leo-only status page (honest fallback). Proves the endpoint responds with the status
 * JSON + notification channel + honest infra note; never Martita-facing.
 */
import { describe, it, expect } from 'vitest'
import handler from '../../api/cron/nightly'

describe('/api/cron/nightly', () => {
  it('returns the Leo-only status page with an honest infra note (no email in this infra)', async () => {
    const res = await handler(new Request('https://x/api/cron/nightly'))
    expect(res.status).toBe(200)
    const body = await res.json() as { hebrewLine: string; notification: { channel: string }; infraNote: string }
    expect(body.hebrewLine).toMatch(/^🟢 הכל תקין$|^🟠/)
    expect(body.notification.channel).toBe('status-page')      // honest fallback (no provider)
    expect(body.infraNote).toContain('NOT configured in this infra')
  })

  it('honors a CRON_SECRET guard when set (Leo-only)', async () => {
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
