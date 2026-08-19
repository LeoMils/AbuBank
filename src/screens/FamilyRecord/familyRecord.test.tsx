/*
 * תעודת המשפחה — the screen renders the ledger view + the paste/commit/export/undo controls.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { FamilyRecord } from './index'

let store: Record<string, string> = {}
beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] } })
})

describe('FamilyRecord screen', () => {
  it('renders the canonical Hebrew ledger view + the senior-safe controls', () => {
    const html = renderToString(React.createElement(FamilyRecord))
    expect(html).toContain('תעודת המשפחה')
    expect(html).toContain('family-record-view')
    expect(html).toContain('פנקס המשפחה')          // the rendered ledger header
    expect(html).toContain('family-record-paste')   // paste box
    expect(html).toContain('family-record-check')    // check button
    expect(html).toContain('family-record-export')   // export backup
    expect(html).toContain('family-record-undo')     // undo
  })
})
