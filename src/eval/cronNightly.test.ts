/*
 * /api/cron/nightly handler — the scheduled endpoint runs the server-safe chain and emits
 * the Leo-only status page (honest fallback). Proves the endpoint responds with the status
 * JSON + notification channel + honest infra note; never Martita-facing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import handler from '../../api/cron/nightly'

beforeEach(() => {
  const s: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: (k: string) => { delete s[k] } })
})

describe('/api/cron/nightly', () => {
  it('runs the server-safe chain and returns the Leo-only status page (no email in this infra)', async () => {
    const res = await handler(new Request('https://x/api/cron/nightly'))
    expect(res.status).toBe(200)
    const body = await res.json() as { hebrewLine: string; notification: { channel: string }; infraNote: string; curation: { actions: number } }
    expect(body.hebrewLine).toMatch(/^🟢 הכל תקין$|^🟠/)
    expect(body.notification.channel).toBe('status-page')      // honest fallback (no provider)
    expect(body.infraNote).toContain('NOT configured in this infra')
    expect(typeof body.curation.actions).toBe('number')
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
