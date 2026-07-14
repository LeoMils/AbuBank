/*
 * Device acceptance: the visible "Copy Last 20 Turns" button renders (for Leo to grab
 * diagnostics during the iPhone test), and the version badge exposes the expected build.
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { CopyTurnsButton } from './index'
import { APP_VERSION } from '../../version'

describe('Device debug access', () => {
  it('renders a visible Copy Last 20 Turns button', () => {
    const html = renderToString(React.createElement(CopyTurnsButton))
    expect(html).toContain('copy-last-turns')
    expect(html).toContain('העתקת 20 השיחות האחרונות')
  })

  it('version badge exposes a real acceptance build (single-sourced, not a frozen literal)', () => {
    // Track the single source (src/version.ts) instead of pinning an exact
    // string — a hardcoded literal here silently goes stale on every bump.
    // The canonical version-truth contract lives in src/version.test.ts.
    expect(APP_VERSION.version).toMatch(/^\d+\.\d+\.\d+-[a-z0-9-]+$/)
  })
})
