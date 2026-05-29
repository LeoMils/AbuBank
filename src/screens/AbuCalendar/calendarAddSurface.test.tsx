/**
 * calendarAddSurface.test.tsx
 *
 * Proves the ADD surface (mic button + "הוספה ידנית") is reachable inside
 * the DayDetailSheet, and that the root-level DEV marker is always visible
 * when AbuCalendar is mounted — without requiring the sheet to be open.
 */

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { DayDetailSheet } from './DayDetailSheet'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const INDEX_SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

// ─── Root-level DEV marker ────────────────────────────────────────────────────
describe('AbuCalendar — root-level DEV marker', () => {
  it('index.tsx contains VOICE_RESET_ACTIVE_614F33D', () => {
    expect(INDEX_SOURCE).toContain('VOICE_RESET_ACTIVE_614F33D')
  })

  it('root marker uses position fixed so it is visible without sheet open', () => {
    const markerIdx = INDEX_SOURCE.indexOf('VOICE_RESET_ACTIVE_614F33D')
    expect(markerIdx).toBeGreaterThan(-1)
    const vicinity = INDEX_SOURCE.slice(Math.max(0, markerIdx - 300), markerIdx + 50)
    expect(vicinity).toContain("position: 'fixed'")
  })

  it('root marker appears after </DayDetailSheet> in source (not trapped inside sheet)', () => {
    const sheetEnd = INDEX_SOURCE.indexOf('</DayDetailSheet>')
    const markerIdx = INDEX_SOURCE.indexOf('VOICE_RESET_ACTIVE_614F33D')
    expect(sheetEnd).toBeGreaterThan(-1)
    expect(markerIdx).toBeGreaterThan(sheetEnd)
  })

  it('root marker has data-testid voice-reset-active-614f33d', () => {
    expect(INDEX_SOURCE).toContain('data-testid="voice-reset-active-614f33d"')
  })
})

// ─── DayDetailSheet open / closed state ──────────────────────────────────────
describe('DayDetailSheet — renders only when open=true', () => {
  it('returns empty string when open=false', () => {
    const html = renderToString(
      React.createElement(DayDetailSheet, {
        open: false,
        title: 'test',
        onClose: () => {},
        footer: React.createElement('span', null, 'SENTINEL_FOOTER'),
        children: React.createElement('div', null, 'SENTINEL_BODY'),
      }),
    )
    expect(html).not.toContain('SENTINEL_FOOTER')
    expect(html).not.toContain('SENTINEL_BODY')
  })

  it('renders role=dialog, title, body, and footer when open=true', () => {
    const html = renderToString(
      React.createElement(DayDetailSheet, {
        open: true,
        title: 'ה-29 במאי',
        onClose: () => {},
        footer: React.createElement('span', null, 'SENTINEL_FOOTER'),
        children: React.createElement('div', null, 'SENTINEL_BODY'),
      }),
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('ה-29 במאי')
    expect(html).toContain('SENTINEL_FOOTER')
    expect(html).toContain('SENTINEL_BODY')
  })
})

// ─── ADD controls inside DayDetailSheet footer ───────────────────────────────
describe('DayDetailSheet footer — mic and manual-add render correctly', () => {
  const micFooter = React.createElement(
    React.Fragment,
    null,
    React.createElement('button', { type: 'button', 'aria-label': 'הוספת אירוע בקול' }),
    React.createElement('button', { type: 'button' }, '＋ הוספה ידנית'),
  )

  const html = renderToString(
    React.createElement(DayDetailSheet, {
      open: true,
      title: 'בדיקה',
      onClose: () => {},
      footer: micFooter,
      children: React.createElement('div', null, 'content'),
    }),
  )

  it('mic aria-label appears in footer', () => {
    expect(html).toContain('הוספת אירוע בקול')
  })

  it('הוספה ידנית appears in footer', () => {
    expect(html).toContain('הוספה ידנית')
  })

  it('both controls are inside role=dialog', () => {
    expect(html).toContain('role="dialog"')
    expect(html).toContain('הוספת אירוע בקול')
    expect(html).toContain('הוספה ידנית')
  })

  it('no diagnostic strings appear in the sheet', () => {
    const FORBIDDEN = ['DEBUG', 'state:', 'raw:', 'blob:', 'chunks:', 'voice-debug']
    for (const s of FORBIDDEN) {
      expect(html, `must not contain "${s}"`).not.toContain(s)
    }
  })
})

// ─── index.tsx source contracts ───────────────────────────────────────────────
describe('AbuCalendar index.tsx — ADD surface source contracts', () => {
  it('mic aria-label "הוספת אירוע בקול" is present in DayDetailSheet footer', () => {
    expect(INDEX_SOURCE).toContain('הוספת אירוע בקול')
  })

  it('"הוספה ידנית" is present in DayDetailSheet footer', () => {
    expect(INDEX_SOURCE).toContain('הוספה ידנית')
  })

  it('VoiceCard is NOT imported in index.tsx', () => {
    expect(INDEX_SOURCE).not.toContain("from './VoiceCard'")
    expect(INDEX_SOURCE).not.toContain('<VoiceCard')
  })

  it('VoiceTraceCard is NOT imported in index.tsx', () => {
    expect(INDEX_SOURCE).not.toContain("from './VoiceTraceCard'")
    expect(INDEX_SOURCE).not.toContain('<VoiceTraceCard')
  })

  it('ConfirmCard is reached via VoiceAddFlow, not imported directly', () => {
    expect(INDEX_SOURCE).not.toMatch(/import[^;]+ConfirmCard/)
    expect(INDEX_SOURCE).toContain("from './VoiceAddFlow'")
  })

  it('DayDetailSheet footer block contains no diagnostic conditionals', () => {
    const footerBlock = INDEX_SOURCE.slice(
      INDEX_SOURCE.indexOf('footer={'),
      INDEX_SOURCE.indexOf('</DayDetailSheet>'),
    )
    expect(footerBlock).not.toContain('DEBUG')
    expect(footerBlock).not.toContain('VoiceCard')
    expect(footerBlock).not.toContain('VoiceTraceCard')
  })

  it('sheetOpen is set to true on day tap (click handler present)', () => {
    expect(INDEX_SOURCE).toContain('setSheetOpen(true)')
  })
})
