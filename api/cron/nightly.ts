/*
 * /api/cron/nightly — the Leo-only nightly autopilot surface (Constitution §3/§4).
 * ═══════════════════════════════════════════════════════════════════════════════
 * Runs the SERVER-SAFE part of the nightly chain (the ledger curator over the persisted
 * ledger) and emits Leo's notification: email when RESEND_API_KEY + LEDGER_RECIPIENT are
 * configured, otherwise this endpoint IS the Leo-only status page (returns the status JSON).
 * NOTHING here is Martita-facing.
 *
 * HONEST INFRA NOTE (returned in the payload): the heavy corpus (parity/marathon/mirror
 * duel + flight-recorder analyzer) needs the family/calendar engines' browser env and runs
 * in CI via src/eval/nightlyAutopilot; and the "cloud-canonical" ledger needs a persistent
 * store (KV/Postgres/Blob) that is NOT provisioned in this infra — see the report/checkpoint.
 * Node runtime (not edge) so process.env + a heavier import are available.
 */
export const config = { runtime: 'nodejs' }

import { LedgerService, localLedgerStore } from '../../src/truth/ledgerService'
import { sendNotification } from '../../src/eval/notify'

export default async function handler(req: Request): Promise<Response> {
  const env = process.env as Record<string, string | undefined>
  // Optional guard: if a CRON_SECRET is set, require it (Leo-only). Absent → open status page.
  if (env.CRON_SECRET) {
    const url = new URL(req.url)
    if (url.searchParams.get('key') !== env.CRON_SECRET && req.headers.get('x-cron-key') !== env.CRON_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
  }

  let curationActions = 0
  const curationLines: string[] = []
  try {
    const svc = new LedgerService(localLedgerStore())
    const r = svc.curate()
    curationActions = r.actions.length
    curationLines.push(...r.actions.map((a) => a.line))
  } catch { /* no persistent ledger in this infra → nothing to curate */ }

  const hebrewLine = curationActions === 0 ? '🟢 הכל תקין' : `🟠 נמצאו ${curationActions} דברים לתיקון`
  const notify = await sendNotification(env, { hebrewLine, extra: curationLines.join(' | ') })

  const payload = {
    ok: curationActions === 0,
    hebrewLine,
    curation: { actions: curationActions, lines: curationLines },
    notification: { channel: notify.channel, sent: notify.sent, body: notify.statusPage },
    infraNote:
      'Server-safe chain (ledger curator) ran here. Full corpus duel + flight-recorder analyzer ' +
      'run in CI (src/eval/nightlyAutopilot). Cloud-canonical persistence + email require a ' +
      'provisioned store (KV/Postgres/Blob) + RESEND_API_KEY — NOT configured in this infra; ' +
      'this endpoint is the Leo-only status page fallback.',
  }
  return new Response(JSON.stringify(payload, null, 2), { status: 200, headers: { 'content-type': 'application/json' } })
}
