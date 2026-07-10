import { describe, it, expect } from 'vitest'
import { detectStaleBuild, fetchServerVersion } from './versionSync'

describe('stale build detection (#13)', () => {
  it('flags a client/server version mismatch', () => {
    expect(detectStaleBuild('0.59.1', '0.59.1').stale).toBe(false)
    expect(detectStaleBuild('0.59.0', '0.59.1').stale).toBe(true)
    expect(detectStaleBuild('0.59.0', '0.59.1').reason).toBe('mismatch')
  })
  it('is inconclusive (not stale) when a version is unknown', () => {
    expect(detectStaleBuild(undefined, '0.59.1')).toMatchObject({ stale: false, reason: 'unknown' })
  })
  it('fetchServerVersion reads /api/health buildVersion', async () => {
    const fakeFetch = (async () => ({ ok: true, json: async () => ({ buildVersion: '0.59.1-x' }) })) as unknown as typeof fetch
    expect(await fetchServerVersion(fakeFetch)).toBe('0.59.1-x')
    const badFetch = (async () => ({ ok: false })) as unknown as typeof fetch
    expect(await fetchServerVersion(badFetch)).toBeNull()
  })
})
