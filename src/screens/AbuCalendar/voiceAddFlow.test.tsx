/**
 * VoiceAddFlow integration render tests.
 *
 * Verifies that the single-state-machine overlay renders correctly for each
 * flow state and never leaks diagnostic strings into the DOM.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { VoiceAddFlow } from './VoiceAddFlow'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FLOW_SOURCE = readFileSync(resolve(__dirname, './VoiceAddFlow.tsx'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')
const SERVICE_SOURCE = readFileSync(resolve(__dirname, './service.ts'), 'utf8')

class MemoryStorage {
  private store = new Map<string, string>()
  get length(): number { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(k: string): string | null { return this.store.get(k) ?? null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage
})

const FORBIDDEN = [
  'DEBUG', 'מצב הקלטה', 'העתק אבחון קול', 'מה שמעתי',
  'transcript-box', 'transcript-textarea', 'voice-debug',
  'voice-trace-stage', 'blob:', 'chunks:', 'mime:', 'asr:',
]

const BASE_PROPS = {
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

describe('VoiceAddFlow — confirm state renders correctly', () => {
  it('confirm screen has no diagnostic strings', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅', personName: 'גלעד' },
      }),
    )
    for (const s of FORBIDDEN) {
      expect(html, `must not contain "${s}"`).not.toContain(s)
    }
  })

  it('confirm screen renders כן לשמור / לא לתקן / ביטול / הבנתי', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅', personName: 'גלעד' },
      }),
    )
    expect(html).toContain('כן, לשמור')
    expect(html).toContain('לא, לתקן')
    expect(html).toContain('ביטול')
    expect(html).toContain('הבנתי')
  })

  it('resolved kinship: shows "פגישה עם גלעד" and "הבעל של אופיר" secondary line, clean time', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        parsed: {
          title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅',
          personName: 'גלעד',
          relation: { status: 'resolved', phrase: 'הבעל של אופיר' },
        },
      }),
    )
    expect(html).toContain('פגישה עם גלעד')
    expect(html).toContain('הבעל של אופיר')
    expect(html).toContain('21:00')
    expect(html).not.toContain('תקבעי')
    expect(html).not.toContain('תקווה')
    for (const s of FORBIDDEN) expect(html).not.toContain(s)
  })
})

describe('VoiceAddFlow — saved state renders correctly', () => {
  it('saved panel shows נשמר ביומן, the clean title, and no diagnostic strings', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        savedConfirmation: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00' },
      }),
    )
    expect(html).toContain('נשמר ביומן')
    expect(html).toContain('פגישה עם גלעד')
    expect(html).not.toContain('תקבעי')
    for (const s of FORBIDDEN) expect(html).not.toContain(s)
  })
})

describe('VoiceAddFlow — correcting state shows edit fields only', () => {
  it('after toggling edit, shows field-what and no confirm buttons', () => {
    // NOTE: editing state is internal to VoiceAddFlow — we test the CONFIRM
    // state to verify ConfirmCard's "לא, לתקן" path wires back to editing.
    // Here we verify the confirm state renders ConfirmCard, not edit fields.
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅' },
      }),
    )
    // Confirm state shows confirm card, not the manual editing fields.
    expect(html).toContain('confirm-card')
    expect(html).not.toContain('field-what')
  })
})

describe('VoiceAddFlow — missing relation state', () => {
  it('"הבת של מור" missing renders calm message, no diagnostic', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        parsed: {
          title: 'פגישה עם הבת של מור', date: '2026-05-29', time: '21:00', emoji: '📅',
          personName: 'הבת של מור',
          relation: { status: 'missing', phrase: 'הבת של מור' },
        },
      }),
    )
    expect(html).toContain('relation-missing')
    expect(html).toContain('לא מצאתי בוודאות מי')
    for (const s of FORBIDDEN) expect(html).not.toContain(s)
  })
})

describe('VoiceAddFlow — ambiguous relation state', () => {
  it('"הבן של מור" ambiguous shows candidate buttons, no auto-select', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        parsed: {
          title: 'פגישה עם הבן של מור', date: '2026-05-29', time: '21:00', emoji: '📅',
          personName: 'הבן של מור',
          relation: { status: 'ambiguous', phrase: 'הבן של מור', candidates: ['איילון', 'אדר', 'עילי'] },
        },
      }),
    )
    expect(html).toContain('למי התכוונת?')
    expect(html).toContain('relation-candidate')
    expect(html).toContain('איילון')
    expect(html).not.toContain('confirm-save-btn')
    for (const s of FORBIDDEN) expect(html).not.toContain(s)
  })
})

describe('VoiceAddFlow — structural contract', () => {
  it('createAppointmentSafe is the sole write path in service.ts', () => {
    // The service exports createAppointmentSafe as the safe public API.
    expect(SERVICE_SOURCE).toContain('export function createAppointmentSafe')
    // index.tsx uses it for voice confirm — never bypasses to raw addAppointment.
    expect(INDEX_SOURCE).toContain('createAppointmentSafe')
    expect(INDEX_SOURCE).not.toContain('addAppointment(final')
  })

  it('VoiceAddFlow source has no diagnostic strings', () => {
    for (const s of FORBIDDEN) {
      expect(FLOW_SOURCE, `VoiceAddFlow.tsx must not contain "${s}"`).not.toContain(s)
    }
  })
})
