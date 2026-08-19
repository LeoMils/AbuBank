/*
 * NOTIFY — Leo-only notification with an honest fallback.
 */
import { describe, it, expect, vi } from 'vitest'
import { sendNotification, chooseNotifyChannel } from './notify'

describe('sendNotification', () => {
  it('falls back to the Leo-only status page when no email provider is configured', async () => {
    const r = await sendNotification({}, { hebrewLine: '🟢 הכל תקין' })
    expect(r.channel).toBe('status-page')
    expect(r.sent).toBe(false)
    expect(r.statusPage.subject).toContain('🟢')
  })

  it('POSTs to the email provider when a key + recipient exist', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }))
    const r = await sendNotification(
      { RESEND_API_KEY: 'k', LEDGER_RECIPIENT: 'leo@example.com' },
      { hebrewLine: '🟠 נמצאו 3 דברים לתיקון', fixPrompt: 'FIX on rc5' },
      fetchMock as unknown as typeof fetch,
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(r.channel).toBe('email')
    expect(r.sent).toBe(true)
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.to).toBe('leo@example.com')
    expect(body.text).toContain('FIX on rc5')
  })

  it('never throws — a provider failure degrades to not-sent', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('down') })
    const r = await sendNotification({ RESEND_API_KEY: 'k', LEDGER_RECIPIENT: 'a@b.c' }, { hebrewLine: 'x' }, fetchMock as unknown as typeof fetch)
    expect(r.sent).toBe(false)
    expect(r.statusPage).toBeTruthy()
  })

  it('channel decision is honest about this infra (no provider → status page)', () => {
    expect(chooseNotifyChannel({}).channel).toBe('status-page')
  })
})
