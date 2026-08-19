/*
 * ErrorBoundary — a generic "משהו לא עבד" must (a) stay calm for Martita,
 * (b) offer recovery, and (c) surface the technical REASON + a copyable
 * last-20-turns dump so Leo can debug it. Rendered via react-dom/server.
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ErrorBoundary } from './index'

// renderToString (legacy) rethrows instead of rendering an error-boundary fallback,
// so render the fallback directly by driving the boundary into its error state
// (exactly what getDerivedStateFromError produces for a real thrown error).
describe('ErrorBoundary — recoverable + debuggable', () => {
  const eb = new ErrorBoundary({ children: null })
  Object.assign(eb, { state: { ...ErrorBoundary.getDerivedStateFromError(new Error('calendar save failed: quota exceeded')), stack: 'at ApptCard', copied: false } })
  const html = renderToString(eb.render() as React.ReactElement)

  it('shows the calm message and a recovery action', () => {
    expect(html).toContain('משהו לא עבד')
    expect(html).toContain('חזרה הביתה')   // recovery: go home
    expect(html).toContain('רענון מלא')     // recovery: full reload
  })

  it('surfaces the exact technical reason (never a bare generic error)', () => {
    expect(html).toContain('calendar save failed: quota exceeded')
    expect(html).toContain('error-reason')
  })

  it('offers a visible "copy details" action (reason + last 20 turns)', () => {
    expect(html).toContain('העתקת פרטים לתמיכה')
    expect(html).toContain('error-copy-details')
  })
})
