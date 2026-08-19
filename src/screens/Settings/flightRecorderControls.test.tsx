/*
 * Flight Recorder controls render in Settings: a user off-switch toggle + an export
 * button. Senior-first plain Hebrew, discoverable test ids. The toggle reflects the
 * persisted state; the privacy promise (local, text-only) is shown.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { FlightRecorderControls } from './index'
import { setRecorderOff } from '../../evolution/recorderSwitch'

let store: Record<string, string> = {}
beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] } })
})

describe('FlightRecorderControls', () => {
  it('renders the off-switch toggle and export button with plain-Hebrew labels', () => {
    const html = renderToString(React.createElement(FlightRecorderControls))
    expect(html).toContain('flight-recorder-toggle')
    expect(html).toContain('flight-recorder-export')
    expect(html).toContain('שמירת שיחות')
    expect(html).toContain('ייצוא השיחות שנשמרו')
    // Privacy promise is visible: local + text only, no audio.
    expect(html).toContain('בלי הקלטות קול')
  })

  it('reflects the ON default (recording enabled, aria-pressed true)', () => {
    const html = renderToString(React.createElement(FlightRecorderControls))
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('נשמר מקומית בלבד')
  })

  it('reflects the OFF state when the user has disabled capture', () => {
    setRecorderOff(true)
    const html = renderToString(React.createElement(FlightRecorderControls))
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('כבוי — שום שיחה לא נשמרת')
  })
})
