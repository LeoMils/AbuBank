/*
 * AbuLogo.test.tsx — the per-app logo family (CODE). One system, distinct per app,
 * every one carrying its accent + the constant Abu spark.
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { AbuLogo, APP_ACCENT, type AbuAppId } from './AbuLogo'

const APPS: AbuAppId[] = ['ai', 'news', 'bank', 'whatsapp', 'weather', 'games', 'calendar']

describe('Abu logo family', () => {
  const htmls = APPS.map((a) => renderToString(React.createElement(AbuLogo, { app: a })))

  it('renders all seven, each labelled and carrying its accent colour', () => {
    APPS.forEach((app, i) => {
      expect(htmls[i]).toContain(`aria-label="Abu ${app}"`)
      expect(htmls[i]!.toUpperCase()).toContain(APP_ACCENT[app].toUpperCase())
    })
  })

  it('the seven glyphs are DISTINCT (not the same mark seven times)', () => {
    expect(new Set(htmls).size).toBe(APPS.length)
  })

  it('every mark carries the shared frame — a circular emblem (the one-family construction)', () => {
    for (const h of htmls) expect(h).toContain('<circle') // the emblem disc + rim + spark core
  })
})
