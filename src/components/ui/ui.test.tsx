/*
 * ui.test.tsx — the Abu-ela design-system primitives (CODE).
 * Locks the senior-first invariants (≥56px targets, ≥16px body) and that the shared
 * components render and carry the tokens — so "one system" cannot silently regress.
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { ScreenHeader } from './ScreenHeader'
import { Card } from './Card'
import { PrimaryButton } from './PrimaryButton'
import { MIN_TOUCH, MIN_BODY_PX, space, radius } from '../../design/space'
import { SIZE_BODY, SIZE_LABEL } from '../../design/typography'

describe('design tokens — senior-first minimums', () => {
  it('MIN_TOUCH is at least 56px and MIN_BODY is at least 16px', () => {
    expect(MIN_TOUCH).toBeGreaterThanOrEqual(56)
    expect(MIN_BODY_PX).toBeGreaterThanOrEqual(16)
  })
  it('the body/label type sizes meet the readable minimum', () => {
    expect(SIZE_BODY).toBeGreaterThanOrEqual(16)
    expect(SIZE_LABEL).toBeGreaterThanOrEqual(16)
  })
  it('the spacing + radius scales are present and ordered', () => {
    expect(space.xs).toBeLessThan(space.lg)
    expect(space.lg).toBeLessThan(space.xxl)
    expect(radius.sm).toBeLessThan(radius.xl)
  })
})

describe('PrimaryButton — a ≥56px senior-first action', () => {
  it('renders a ≥56px target with large type and the accent', () => {
    const html = renderToString(React.createElement(PrimaryButton, { accent: '#FDBA74', children: 'לנסות שוב' }))
    expect(html).toContain('min-height:56px')
    expect(html).toContain('לנסות שוב')
    expect(html).toMatch(/font-size:19px/)
  })
  it('a disabled button is dimmed and not a pointer', () => {
    const html = renderToString(React.createElement(PrimaryButton, { disabled: true, children: 'x' }))
    expect(html).toContain('opacity:0.5')
  })
})

describe('Card — pressable ≥56px glass surface', () => {
  it('a pressable card is a ≥56px button with its aria-label', () => {
    const html = renderToString(React.createElement(Card, { onClick: () => {}, ariaLabel: 'פתיחה', children: 'תוכן' }))
    expect(html).toContain('min-height:56px')
    expect(html).toContain('aria-label="פתיחה"')
    expect(html).toContain('תוכן')
  })
  it('a static card renders a div (no button semantics)', () => {
    const html = renderToString(React.createElement(Card, { children: 'סטטי' }))
    expect(html).toContain('סטטי')
    expect(html).not.toContain('<button')
  })
})

describe('ScreenHeader — the shared Abu-ela app header', () => {
  it('renders the always-visible back control + the "Abu <name>" title', () => {
    const html = renderToString(React.createElement(ScreenHeader, { name: 'News' }))
    expect(html).toContain('חזרה למסך הבית') // BackButton aria-label → the hub
    expect(html).toContain('Abu')
    expect(html).toContain('News')
  })
})
