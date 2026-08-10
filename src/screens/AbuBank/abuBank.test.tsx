/*
 * abuBank.test.tsx — the services now live inside the Abu Bank app (CODE).
 * Proves the former Home services grid moved intact and keeps a way back to the hub.
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { AbuBank } from './index'
import { SERVICES } from '../Home/data'

describe('Abu Bank — the services app inside the hub', () => {
  it('renders every Kfar-Saba service from the shared SERVICES data (contents unchanged)', () => {
    // React HTML-escapes quotes in attributes/text (ארנונה כ"ס → …כ&quot;ס), so decode first.
    const html = renderToString(React.createElement(AbuBank)).replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
    expect(SERVICES.length).toBe(9)
    for (const s of SERVICES) expect(html, `service "${s.label}" missing`).toContain(s.label)
  })

  it('has an always-visible way back to the hub', () => {
    const html = renderToString(React.createElement(AbuBank))
    expect(html).toContain('חזרה למסך הבית') // BackButton aria-label → Screen.Home
  })
})
