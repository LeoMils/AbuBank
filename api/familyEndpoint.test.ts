/*
 * familyEndpoint.test.ts — /api/family is authenticated + non-caching. (Task B)
 *   • unauthenticated GET → 401, no data
 *   • authenticated GET → the dataset, with Cache-Control: private, no-store
 *   • non-GET → 405
 */
import { describe, it, expect, beforeEach } from 'vitest'
import family from './family'
import { signToken, COOKIE, TTL } from './_session'

const SECRET = 'test-signing-secret-abu-ela-000000'

beforeEach(() => {
  process.env.AUTH_SIGNING_SECRET = SECRET
  process.env.ENROLLMENT_SECRET = 'owner-enroll-code-123'
  delete process.env.VERCEL_ENV
})

const get = (headers: Record<string, string> = {}) =>
  new Request('https://abu-ela.example/api/family', { method: 'GET', headers })

describe('/api/family — private, authenticated', () => {
  it('unauthenticated GET → 401 and returns NO family data', async () => {
    const res = await family(get())
    expect(res.status).toBe(401)
    const body = await res.text()
    expect(body).not.toMatch(/family|canonical_name/)
  })

  it('authenticated GET → 200 with the dataset and a private, no-store cache policy', async () => {
    const tok = (await signToken('session', { deviceId: 'd1' }, TTL.sessionMs))!
    const res = await family(get({ cookie: `${COOKIE.session}=${tok}` }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toMatch(/private/)
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/)
    const data = (await res.json()) as { family?: unknown }
    expect(data.family).toBeTruthy()
  })

  it('non-GET → 405', async () => {
    const res = await family(new Request('https://abu-ela.example/api/family', { method: 'POST' }))
    expect(res.status).toBe(405)
  })
})
