/*
 * Stale-build banner — surfaces the versionSync staleness signal (previously dead code).
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaleBuildBanner } from './StaleBuildBanner'
import { detectStaleBuild } from '../services/versionSync'

describe('StaleBuildBanner', () => {
  it('renders a calm reload banner when the served build differs from this bundle', () => {
    const stale = detectStaleBuild('0.128.0-voice-readiness', '0.79.0-pipeline-default-realtime-beta')
    const html = renderToString(React.createElement(StaleBuildBanner, { initialResult: stale }))
    expect(html).toContain('stale-build-banner')
    expect(html).toContain('stale-build-refresh')
    expect(html).toContain('יש גרסה חדשה של האפליקציה')
    expect(html).toContain('רענון')
  })

  it('renders NOTHING when the build matches (no false alarm)', () => {
    const match = detectStaleBuild('0.128.0-voice-readiness', '0.128.0-voice-readiness')
    const html = renderToString(React.createElement(StaleBuildBanner, { initialResult: match }))
    expect(html).toBe('')
  })

  it('renders nothing when the server version is unknown (fail-safe)', () => {
    const unknown = detectStaleBuild('0.128.0-voice-readiness', '')
    const html = renderToString(React.createElement(StaleBuildBanner, { initialResult: unknown }))
    expect(html).toBe('')
  })
})
