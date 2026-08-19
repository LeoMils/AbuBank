/*
 * failClosed.test.ts — PRODUCTION must never run the billable/private APIs open. (Task C)
 *
 * guardBillable matrix:
 *   • production + BOTH secrets      → enforce (401 without a session)
 *   • production + missing EITHER    → 503 FAIL-CLOSED (never open, no provider call)
 *   • preview/dev + signing secret   → enforce
 *   • preview/dev + no secret        → open (explicit non-production dev/test mode)
 * Plus the mutations the review asked for (missing prod auth config).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { guardBillable, authEnforced, productionMisconfigured, isProduction, signToken, COOKIE, TTL } from './_session'

const SECRET = 'test-signing-secret-abu-ela-000000'
const ENROLL = 'owner-enroll-code-123'

beforeEach(() => {
  delete process.env.VERCEL_ENV
  delete process.env.AUTH_SIGNING_SECRET
  delete process.env.ENROLLMENT_SECRET
})
afterEach(() => {
  delete process.env.VERCEL_ENV
  delete process.env.AUTH_SIGNING_SECRET
  delete process.env.ENROLLMENT_SECRET
})

const bare = () => new Request('https://x/api/abuai-chat', { method: 'POST' })
async function authed() {
  const tok = (await signToken('session', { deviceId: 'd' }, TTL.sessionMs))!
  return new Request('https://x/api/abuai-chat', { method: 'POST', headers: { cookie: `${COOKIE.session}=${tok}` } })
}

describe('PRODUCTION fail-closed', () => {
  it('production + BOTH secrets → enforce (401 without a session, pass with one)', async () => {
    process.env.VERCEL_ENV = 'production'; process.env.AUTH_SIGNING_SECRET = SECRET; process.env.ENROLLMENT_SECRET = ENROLL
    expect(isProduction()).toBe(true)
    expect(productionMisconfigured()).toBe(false)
    expect((await guardBillable(bare()))!.status).toBe(401)
    expect(await guardBillable(await authed())).toBeNull()
  })

  it('production + missing ENROLLMENT_SECRET → 503 FAIL-CLOSED (never open)', async () => {
    process.env.VERCEL_ENV = 'production'; process.env.AUTH_SIGNING_SECRET = SECRET
    expect(productionMisconfigured()).toBe(true)
    const denied = await guardBillable(await authed()) // even a "valid" session is refused while misconfigured
    expect(denied!.status).toBe(503)
  })

  it('production + missing AUTH_SIGNING_SECRET → 503 FAIL-CLOSED', async () => {
    process.env.VERCEL_ENV = 'production'; process.env.ENROLLMENT_SECRET = ENROLL
    expect(productionMisconfigured()).toBe(true)
    expect((await guardBillable(bare()))!.status).toBe(503)
    expect(authEnforced()).toBe(true) // production is ALWAYS enforced (open is impossible)
  })

  it('production + NO secrets → 503 FAIL-CLOSED, never falls back to open', async () => {
    process.env.VERCEL_ENV = 'production'
    expect((await guardBillable(bare()))!.status).toBe(503)
  })
})

describe('non-production explicit dev/test mode', () => {
  it('preview/dev + signing secret → enforce (401 without a session)', async () => {
    process.env.AUTH_SIGNING_SECRET = SECRET // no VERCEL_ENV = local/preview
    expect((await guardBillable(bare()))!.status).toBe(401)
  })
  it('preview/dev + NO secret → open (guard returns null)', async () => {
    expect(await guardBillable(bare())).toBeNull()
    expect(authEnforced()).toBe(false)
  })
  it('a production build can NEVER inherit the open dev mode', async () => {
    // The only path that returns "open" (null) requires !authSecret AND !production.
    process.env.VERCEL_ENV = 'production'
    expect(await guardBillable(bare())).not.toBeNull()
  })
})
