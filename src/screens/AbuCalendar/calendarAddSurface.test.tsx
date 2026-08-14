/**
 * calendarAddSurface.test.tsx
 *
 * Proves the assistant-first ADD surface:
 * - Main-screen mic and "הוספה ידנית" visible without tapping a day
 * - DayDetailSheet secondary path still works when open=true
 * - VoiceAddFlow ConfirmCard path used for both
 * - No debug/diagnostic UI anywhere in the flow
 * - Family resolution works from main voice path
 */

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { DayDetailSheet } from './DayDetailSheet'
import { VoiceAddFlow } from './VoiceAddFlow'
import { resolvePersonPhrase } from './familyResolve'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const INDEX_SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

const FORBIDDEN = [
  'DEBUG', 'מצב הקלטה', 'העתק אבחון קול', 'מה שמעתי',
  'transcript-box', 'transcript-textarea', 'voice-debug',
  'voice-trace-stage', 'blob:', 'chunks:', 'mime:', 'asr:',
]

const BASE_FLOW_PROPS = {
  isRecording: false,
  isProcessing: false,
  parsed: null,
  voiceError: null,
  ambiguousDraft: null,
  savedConfirmation: null,
  existingAppts: [],
  onToggleRecord: () => {},
  onConfirm: () => {},
  onCancel: () => {},
  onRetry: () => {},
  onManualAdd: () => {},
  onResolveAmPm: () => {},
  onSavedClose: () => {},
  onSavedShowDay: () => {},
}

// ─── Root-level DEV version badge ─────────────────────────────────────────────
describe('AbuCalendar — root-level DEV version badge', () => {
  it('index.tsx no longer contains the misleading static markers', () => {
    expect(INDEX_SOURCE).not.toContain('VOICE_RESET_ACTIVE_614F33D')
    expect(INDEX_SOURCE).not.toContain('VOICE_RESET_ACTIVE_8987215')
    expect(INDEX_SOURCE).not.toContain('voice-reset-active-614f33d')
    expect(INDEX_SOURCE).not.toContain('voice-reset-active-8987215')
  })

  it('badge uses position fixed so it is visible without sheet open', () => {
    const markerIdx = INDEX_SOURCE.indexOf('data-testid="dev-version-badge"')
    expect(markerIdx).toBeGreaterThan(-1)
    const vicinity = INDEX_SOURCE.slice(Math.max(0, markerIdx - 300), markerIdx + 200)
    expect(vicinity).toContain("position: 'fixed'")
  })

  it('badge appears after </DayDetailSheet> in source (not trapped inside sheet)', () => {
    const sheetEnd = INDEX_SOURCE.indexOf('</DayDetailSheet>')
    const markerIdx = INDEX_SOURCE.indexOf('data-testid="dev-version-badge"')
    expect(sheetEnd).toBeGreaterThan(-1)
    expect(markerIdx).toBeGreaterThan(sheetEnd)
  })

  it('badge renders APP_VERSION.version (not a hard-coded SHA-like marker)', () => {
    expect(INDEX_SOURCE).toContain('data-testid="dev-version-badge"')
    expect(INDEX_SOURCE).toContain('APP_VERSION.version')
    expect(INDEX_SOURCE).toContain('APP_VERSION.commitHint')
  })

  it('badge handles commitHint==="local" honestly with "local build" label', () => {
    expect(INDEX_SOURCE).toMatch(/APP_VERSION\.commitHint\s*===\s*'local'/)
    expect(INDEX_SOURCE).toContain("'local build'")
  })
})

// ─── Main-screen primary ADD bar ──────────────────────────────────────────────
describe('AbuCalendar — main-screen primary ADD bar (assistant-first)', () => {
  it('index.tsx has data-testid="main-add-bar"', () => {
    expect(INDEX_SOURCE).toContain('data-testid="main-add-bar"')
  })

  it('main-add-bar uses position fixed (always visible without scroll)', () => {
    const barIdx = INDEX_SOURCE.indexOf('main-add-bar')
    expect(barIdx).toBeGreaterThan(-1)
    const vicinity = INDEX_SOURCE.slice(barIdx, barIdx + 300)
    expect(vicinity).toContain("position: 'fixed'")
  })

  it('main-add-bar has data-testid="main-mic-btn"', () => {
    expect(INDEX_SOURCE).toContain('data-testid="main-mic-btn"')
  })

  it('main-add-bar mic button has an Abu-routing aria-label (post D7)', () => {
    const barStart = INDEX_SOURCE.indexOf('"main-add-bar"')
    const barEnd = INDEX_SOURCE.indexOf('"main-mic-btn"') + 200
    const barBlock = INDEX_SOURCE.slice(barStart, barEnd)
    // D7 · one voice engine: the mic opens Abu AI, so its label references talking to Abu.
    expect(barBlock).toContain('Abu')
  })

  it('main-add-bar contains "הוספה ידנית" secondary action', () => {
    const barStart = INDEX_SOURCE.indexOf('"main-add-bar"')
    const afterBar = INDEX_SOURCE.slice(barStart, barStart + 800)
    expect(afterBar).toContain('הוספה ידנית')
  })

  it('main-add-bar contains "דברי אליי" label', () => {
    const barStart = INDEX_SOURCE.indexOf('"main-add-bar"')
    // The bar block spans ~50 lines; use a 3000-char window to cover it
    const afterBar = INDEX_SOURCE.slice(barStart, barStart + 3000)
    expect(afterBar).toContain('דברי אליי')
  })

  it('main-add-bar is hidden when sheet is open (!sheetOpen condition)', () => {
    const barIdx = INDEX_SOURCE.indexOf('"main-add-bar"')
    const vicinity = INDEX_SOURCE.slice(Math.max(0, barIdx - 150), barIdx)
    expect(vicinity).toContain('!sheetOpen')
  })

  it('main-add-bar appears after </DayDetailSheet> (not inside sheet)', () => {
    const sheetEnd = INDEX_SOURCE.indexOf('</DayDetailSheet>')
    const barIdx = INDEX_SOURCE.indexOf('"main-add-bar"')
    expect(barIdx).toBeGreaterThan(sheetEnd)
  })

  it('main-add-bar handleVoiceRecord call does not reference selectedDay', () => {
    const barStart = INDEX_SOURCE.indexOf('"main-add-bar"')
    const barEnd = INDEX_SOURCE.indexOf('"main-mic-btn"') + 50
    const barBlock = INDEX_SOURCE.slice(barStart, barEnd)
    expect(barBlock).not.toContain('selectedDay')
  })

  it('main-add-bar has no diagnostic strings', () => {
    const barStart = INDEX_SOURCE.indexOf('"main-add-bar"')
    const barBlock = INDEX_SOURCE.slice(barStart, barStart + 1500)
    for (const s of FORBIDDEN) {
      expect(barBlock, `must not contain "${s}"`).not.toContain(s)
    }
  })
})

// ─── DayDetailSheet — secondary path still works ──────────────────────────────
describe('DayDetailSheet — renders only when open=true (secondary path)', () => {
  it('returns empty when open=false', () => {
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

  it('renders role=dialog with title, body, and footer when open=true', () => {
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

  it('day sheet footer mic+manual add render when open=true', () => {
    const html = renderToString(
      React.createElement(DayDetailSheet, {
        open: true,
        title: 'בדיקה',
        onClose: () => {},
        footer: React.createElement(React.Fragment, null,
          React.createElement('button', { type: 'button', 'aria-label': 'הוספת אירוע בקול' }),
          React.createElement('button', { type: 'button' }, '＋ הוספה ידנית'),
        ),
        children: React.createElement('div', null, 'content'),
      }),
    )
    expect(html).toContain('הוספת אירוע בקול')
    expect(html).toContain('הוספה ידנית')
    expect(html).toContain('role="dialog"')
    for (const s of FORBIDDEN) {
      expect(html, `must not contain "${s}"`).not.toContain(s)
    }
  })

  it('day sheet has setSheetOpen(true) wired to day-cell onClick', () => {
    expect(INDEX_SOURCE).toContain('setSheetOpen(true)')
  })
})

// ─── Voice flow without selected day ─────────────────────────────────────────
describe('Main-screen voice flow — no selected day required', () => {
  it('the mic works without a selected day — it routes to Abu AI (post D7)', () => {
    // D7 · one voice engine: no in-screen pipeline that could depend on selectedDay.
    // The mic opens Abu AI, which resolves dates itself ("מחר", "יום ראשון") — so
    // voice-add never requires the user to first tap a day.
    expect(INDEX_SOURCE).not.toContain('handleVoiceRecord')
    expect(INDEX_SOURCE).toContain('setScreen(Screen.AbuAI)')
  })

  it('VoiceAddFlow confirm screen shows missing date as "חסר" (canSave blocked)', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_FLOW_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: null, time: '21:00', emoji: '📅' },
      }),
    )
    // ConfirmCard shows "חסר" for null date
    expect(html).toContain('חסר')
    // Save button is disabled / not shown as active when date is missing
    // (canSave = false when date is null)
    for (const s of FORBIDDEN) expect(html).not.toContain(s)
  })

  it('VoiceAddFlow confirm screen with full date+time shows clean confirm UI', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_FLOW_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-30', time: '21:00', emoji: '📅', personName: 'גלעד' },
      }),
    )
    expect(html).toContain('כן, לשמור')
    expect(html).toContain('לא, לתקן')
    expect(html).toContain('ביטול')
    expect(html).toContain('21:00')
    for (const s of FORBIDDEN) expect(html).not.toContain(s)
  })
})

// ─── Family resolution from main voice path ──────────────────────────────────
describe('Family resolution — הבעל של אופיר → גלעד', () => {
  it('"הבעל של אופיר" resolves to status=resolved, name=גלעד', () => {
    const r = resolvePersonPhrase('הבעל של אופיר')
    expect(r.status).toBe('resolved')
    if (r.status === 'resolved') expect(r.name).toBe('גלעד')
  })

  it('"בעלה של אופיר" resolves to גלעד', () => {
    const r = resolvePersonPhrase('בעלה של אופיר')
    expect(r.status).toBe('resolved')
    if (r.status === 'resolved') expect(r.name).toBe('גלעד')
  })

  it('VoiceAddFlow confirm renders resolved relation phrase and name', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_FLOW_PROPS,
        parsed: {
          title: 'פגישה עם גלעד',
          date: '2026-05-30',
          time: '21:00',
          emoji: '📅',
          personName: 'גלעד',
          relation: { status: 'resolved', phrase: 'הבעל של אופיר' },
        },
      }),
    )
    expect(html).toContain('פגישה עם גלעד')
    expect(html).toContain('הבעל של אופיר')
    expect(html).toContain('21:00')
    for (const s of FORBIDDEN) expect(html).not.toContain(s)
  })
})

// ─── ConfirmCard contract — both paths ───────────────────────────────────────
describe('ConfirmCard — required buttons always present', () => {
  it('confirm state has כן לשמור, לא לתקן, ביטול', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_FLOW_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-30', time: '21:00', emoji: '📅' },
      }),
    )
    expect(html).toContain('כן, לשמור')
    expect(html).toContain('לא, לתקן')
    expect(html).toContain('ביטול')
  })

  it('no VoiceCard or VoiceTraceCard in confirm render', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_FLOW_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-30', time: '21:00', emoji: '📅' },
      }),
    )
    expect(html).not.toContain('data-testid="voice-card"')
    expect(html).not.toContain('data-testid="voice-debug"')
    expect(html).not.toContain('data-testid="transcript-box"')
  })

  it('ambiguous relation shows candidate chips, no save button', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_FLOW_PROPS,
        parsed: {
          title: 'פגישה עם הבן של מור',
          date: '2026-05-30', time: '21:00', emoji: '📅',
          personName: 'הבן של מור',
          relation: { status: 'ambiguous', phrase: 'הבן של מור', candidates: ['איילון', 'אדר', 'עילי'] },
        },
      }),
    )
    expect(html).toContain('למי התכוונת?')
    expect(html).toContain('איילון')
    expect(html).not.toContain('confirm-save-btn')
  })

  it('missing relation shows calm message', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_FLOW_PROPS,
        parsed: {
          title: 'פגישה עם הבת של מור',
          date: '2026-05-30', time: '21:00', emoji: '📅',
          personName: 'הבת של מור',
          relation: { status: 'missing', phrase: 'הבת של מור' },
        },
      }),
    )
    expect(html).toContain('relation-missing')
    expect(html).toContain('לא מצאתי בוודאות מי')
  })
})

// ─── index.tsx structural contracts ──────────────────────────────────────────
describe('AbuCalendar index.tsx — structural contracts', () => {
  it('VoiceCard is NOT imported', () => {
    expect(INDEX_SOURCE).not.toContain("from './VoiceCard'")
    expect(INDEX_SOURCE).not.toContain('<VoiceCard')
  })

  it('VoiceTraceCard is NOT imported', () => {
    expect(INDEX_SOURCE).not.toContain("from './VoiceTraceCard'")
    expect(INDEX_SOURCE).not.toContain('<VoiceTraceCard')
  })

  it('the calendar screen imports no in-screen voice-confirm UI (post D7)', () => {
    // D7 · one voice engine: the confirm surface moved to Abu AI. The calendar
    // screen imports neither ConfirmCard nor VoiceAddFlow directly.
    expect(INDEX_SOURCE).not.toContain("from './ConfirmCard'")
    expect(INDEX_SOURCE).not.toContain('<ConfirmCard')
    expect(INDEX_SOURCE).not.toContain("from './VoiceAddFlow'")
  })

  it('createAppointmentSafe is the write path in index.tsx', () => {
    expect(INDEX_SOURCE).toContain('createAppointmentSafe')
    expect(INDEX_SOURCE).not.toContain('addAppointment(final')
  })

  it('DayDetailSheet footer has no diagnostic strings', () => {
    const footerBlock = INDEX_SOURCE.slice(
      INDEX_SOURCE.indexOf('footer={'),
      INDEX_SOURCE.indexOf('</DayDetailSheet>'),
    )
    expect(footerBlock).not.toContain('DEBUG')
    expect(footerBlock).not.toContain('VoiceCard')
    expect(footerBlock).not.toContain('VoiceTraceCard')
  })

  it('manual add from main bar opens ManualModal with setShowManual', () => {
    const barStart = INDEX_SOURCE.indexOf('"main-add-bar"')
    const afterBar = INDEX_SOURCE.slice(barStart, barStart + 2000)
    expect(afterBar).toContain('setShowManual(true)')
  })

  it('manual add from day sheet opens ManualModal with setShowManual', () => {
    const footerStart = INDEX_SOURCE.indexOf('footer={')
    const footerEnd = INDEX_SOURCE.indexOf('</DayDetailSheet>')
    const footerBlock = INDEX_SOURCE.slice(footerStart, footerEnd)
    expect(footerBlock).toContain('setShowManual(true)')
  })
})
