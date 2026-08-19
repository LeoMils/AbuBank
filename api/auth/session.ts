/*
 * /api/auth/session — session/enrollment status + logout.
 * ════════════════════════════════════════════════════════════════════════════
 * GET  → { configured, enrolled, authed } so the client can decide whether to
 *        run the registration ceremony (not enrolled) or the login ceremony
 *        (enrolled, no session). No secrets are ever returned.
 * POST { action:'logout' } → clears the session cookie (keeps the device cert).
 */
import { COOKIE, authConfigured, clearCookie, jsonResponse, parseCookies, requireSession, verifyToken } from '../_session'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'POST') {
    return jsonResponse({ ok: true }, 200, [clearCookie(COOKIE.session)])
  }
  if (req.method !== 'GET') return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 405)

  const device = await verifyToken('device', parseCookies(req)[COOKIE.device])
  const session = await requireSession(req)
  return jsonResponse({
    ok: true,
    configured: authConfigured(),
    enrolled: Boolean(device),
    authed: Boolean(session),
  })
}
