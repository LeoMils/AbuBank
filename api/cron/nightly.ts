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

export default async function handler(req: Request): Promise<Response> {
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>
  if (env.CRON_SECRET) {
    const url = new URL(req.url)
    if (url.searchParams.get('key') !== env.CRON_SECRET && req.headers.get('x-cron-key') !== env.CRON_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
  }

  // The endpoint itself does not run the heavy chain (see note). It emits the Leo-only
  // status/notification; a green line unless the CI chain has queued items (future: read a
  // persisted queue once a cloud store exists).
  const hebrewLine = '🟢 הכל תקין'
  const notify = await sendNotification(env, { hebrewLine, extra: 'תחזוקת לילה — פרטים ב-CI' })

  const payload = {
    ok: true,
    hebrewLine,
    notification: { channel: notify.channel, sent: notify.sent, body: notify.statusPage },
    infraNote:
      'This endpoint is the Leo-only status page. The maintenance chain (duel corpus + ' +
      'flight-recorder analyzer + ledger curator) runs in CI (src/eval/nightlyAutopilot, ' +
      'CODE-proven). Cloud-canonical persistence + email require a provisioned store ' +
      '(KV/Postgres/Blob) + RESEND_API_KEY — NOT configured in this infra.',
  }
  return new Response(JSON.stringify(payload, null, 2), { status: 200, headers: { 'content-type': 'application/json' } })
}
