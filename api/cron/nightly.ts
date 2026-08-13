/*
 * /api/cron/nightly — the Leo-only nightly autopilot SURFACE (Constitution §3/§4).
 * ═══════════════════════════════════════════════════════════════════════════════
 * Edge function, intentionally LIGHT (no family/ledger engine imports — those are not
 * serverless-bundle-safe and depend on browser globals). It emits Leo's notification:
 * email when RESEND_API_KEY + LEDGER_RECIPIENT are configured, otherwise THIS endpoint IS
 * the Leo-only status page (returns the status JSON). NOTHING here is Martita-facing.
 *
 * HONEST INFRA NOTE (returned in the payload): the actual maintenance CHAIN — the
 * duel/guard corpus, the flight-recorder analyzer, and the ledger curator — runs in the
 * test/CI harness (src/eval/nightlyAutopilot + src/truth/ledgerCurator, CODE-proven),
 * because it needs the engines' browser env. And "cloud-canonical" persistence + real email
 * need a provisioned store (KV/Postgres/Blob) + RESEND_API_KEY, NOT configured in this infra.
 */
export const config = { runtime: 'edge' }

import { sendNotification } from '../../src/eval/notify'
import { probeHealth } from '../../src/services/healthAlert'

export default async function handler(req: Request): Promise<Response> {
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>
  if (env.CRON_SECRET) {
    const url = new URL(req.url)
    if (url.searchParams.get('key') !== env.CRON_SECRET && req.headers.get('x-cron-key') !== env.CRON_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
  }

  // O5 — HEARTBEAT ALERT: actually PROBE the deployment's own /api/health so a silent
  // failure (outage / missing env) cannot report green. An unreachable or ok=false health
  // ⇒ a RED line and Leo's notification fires; otherwise the green maintenance line.
  const origin = new URL(req.url).origin
  const health = await probeHealth(origin)
  const hebrewLine = health.healthy ? '🟢 הכל תקין' : health.hebrewLine
  const notify = await sendNotification(env, {
    hebrewLine,
    extra: health.healthy ? 'תחזוקת לילה — פרטים ב-CI' : `בריאות: ${health.reason}`,
  })

  const payload = {
    ok: health.healthy,
    hebrewLine,
    health: { healthy: health.healthy, alert: health.alert, reason: health.reason },
    notification: { channel: notify.channel, sent: notify.sent, body: notify.statusPage },
    infraNote:
      'This endpoint is the Leo-only status page. The maintenance chain (duel corpus + ' +
      'flight-recorder analyzer + ledger curator) runs in CI (src/eval/nightlyAutopilot, ' +
      'CODE-proven). Cloud-canonical persistence + email require a provisioned store ' +
      '(KV/Postgres/Blob) + RESEND_API_KEY — NOT configured in this infra.',
  }
  return new Response(JSON.stringify(payload, null, 2), { status: 200, headers: { 'content-type': 'application/json' } })
}
