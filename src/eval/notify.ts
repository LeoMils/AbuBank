/*
 * LEO-ONLY NOTIFICATION — email if configured, else an honest Leo-only status page.
 * Light module (no engine imports) so the serverless cron endpoint can use it directly.
 * NOTHING here is ever Martita-facing.
 */
export type NotifyChannel = 'email' | 'status-page'
export interface NotifyDecision { channel: NotifyChannel; recipient: string | null; reason: string }

/** Decide the channel from env — email needs a provider key AND a recipient; else status page. */
export function chooseNotifyChannel(env: Record<string, string | undefined>): NotifyDecision {
  const hasProvider = !!(env.RESEND_API_KEY || env.SENDGRID_API_KEY || env.SMTP_URL)
  const recipient = env.LEDGER_RECIPIENT ?? env.LEO_EMAIL ?? null
  if (hasProvider && recipient) return { channel: 'email', recipient, reason: 'email provider + recipient configured' }
  return { channel: 'status-page', recipient, reason: hasProvider ? 'no recipient configured' : 'no email provider configured — Leo-only status page' }
}

export interface NotifyContent { hebrewLine: string; summaryHe?: string; extra?: string; fixPrompt?: string | null }
export function notificationBody(c: NotifyContent): { subject: string; text: string } {
  const subject = `AbuBank — ${c.hebrewLine}`
  const text = [c.hebrewLine, c.summaryHe ?? '', c.extra ?? '', c.fixPrompt ? '\n— Fix prompt —\n' + c.fixPrompt : ''].filter(Boolean).join('\n')
  return { subject, text }
}

/**
 * Send Leo the notification. Uses raw fetch to Resend when a key + recipient exist (no new
 * dep). Otherwise returns the status-page payload (the caller serves it as JSON). Never throws.
 */
export async function sendNotification(
  env: Record<string, string | undefined>,
  content: NotifyContent,
  fetchImpl: typeof fetch = fetch,
): Promise<{ channel: NotifyChannel; sent: boolean; statusPage: { subject: string; text: string } }> {
  const decision = chooseNotifyChannel(env)
  const body = notificationBody(content)
  if (decision.channel === 'email' && env.RESEND_API_KEY && decision.recipient) {
    try {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.LEDGER_FROM ?? 'abubank@resend.dev', to: decision.recipient, subject: body.subject, text: body.text }),
      })
      return { channel: 'email', sent: res.ok, statusPage: body }
    } catch { return { channel: 'email', sent: false, statusPage: body } }
  }
  return { channel: 'status-page', sent: false, statusPage: body }
}
