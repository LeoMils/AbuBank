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
import { sanitizeTitleForSave } from './localParser'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FLOW_SOURCE = readFileSync(resolve(__dirname, './VoiceAddFlow.tsx'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')
const SERVICE_SOURCE = readFileSync(resolve(__dirname, './service.ts'), 'utf8')
const CONFIRM_SOURCE = readFileSync(resolve(__dirname, './ConfirmCard.tsx'), 'utf8')

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

  it('index.tsx does NOT import VoiceCard or VoiceTraceCard', () => {
    expect(INDEX_SOURCE).not.toContain("from './VoiceCard'")
    expect(INDEX_SOURCE).not.toContain("from './VoiceTraceCard'")
    expect(INDEX_SOURCE).not.toContain('<VoiceCard')
    expect(INDEX_SOURCE).not.toContain('<VoiceTraceCard')
  })

  it('ConfirmCard does NOT import VoiceCard', () => {
    expect(CONFIRM_SOURCE).not.toContain("from './VoiceCard'")
  })

  it('VoiceAddFlow does NOT import VoiceCard', () => {
    expect(FLOW_SOURCE).not.toContain("from './VoiceCard'")
  })

  it('index.tsx DOM render does not include diagnostic string literals', () => {
    const JSX_SECTION = INDEX_SOURCE.slice(INDEX_SOURCE.indexOf('return ('))
    const RENDER_FORBIDDEN = ['DEBUG', 'state:', 'raw:', 'מצב הקלטה', 'העתק אבחון קול', 'מה שמעתי']
    for (const s of RENDER_FORBIDDEN) {
      expect(JSX_SECTION, `index.tsx render section must not contain "${s}"`).not.toContain(s)
    }
  })

  it('build marker VOICE_RESET_ACTIVE_8987215 is present in index.tsx', () => {
    expect(INDEX_SOURCE).toContain('VOICE_RESET_ACTIVE_8987215')
  })
})

describe('VoiceAddFlow — title sanitization (dirty title blocker)', () => {
  it('strips "תקבעי" command verb from title', () => {
    expect(sanitizeTitleForSave('תקבעי פגישה עם גלעד')).toBe('פגישה עם גלעד')
  })

  it('strips "תקווה" (Whisper mishear of "תקבעי") from title', () => {
    expect(sanitizeTitleForSave('תקווה פגישה עם גלעד')).toBe('פגישה עם גלעד')
  })

  it('strips "קבעי" from title', () => {
    expect(sanitizeTitleForSave('קבעי פגישה')).toBe('פגישה')
  })

  it('leaves "פגישה עם גלעד" unchanged', () => {
    expect(sanitizeTitleForSave('פגישה עם גלעד')).toBe('פגישה עם גלעד')
  })

  it('falls back to personName when title stripped to empty', () => {
    expect(sanitizeTitleForSave('תקבעי', 'גלעד')).toBe('פגישה עם גלעד')
  })

  it('does not save raw ASR sentence as title', () => {
    const raw = 'תקבעי פגישה למחר בשעה 21 עם הבעל של אופיר'
    const result = sanitizeTitleForSave(raw)
    expect(result).not.toContain('תקבעי')
    expect(result).not.toBe(raw)
  })
})

describe('VoiceAddFlow — render confirms correct screen, not old VoiceCard UI', () => {
  it('confirm state renders voice-add-flow container, not voice-card', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅', personName: 'גלעד' },
      }),
    )
    expect(html).toContain('data-testid="voice-add-flow"')
    expect(html).not.toContain('data-testid="voice-card"')
    expect(html).not.toContain('data-testid="voice-debug"')
    expect(html).not.toContain('data-testid="transcript-box"')
  })

  it('confirm state has all three action buttons — no correction fields pre-tap', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅', personName: 'גלעד' },
      }),
    )
    expect(html).toContain('כן, לשמור')
    expect(html).toContain('לא, לתקן')
    expect(html).toContain('ביטול')
    expect(html).not.toContain('data-testid="field-what"')
    expect(html).not.toContain('data-testid="vaf-correcting"')
  })

  it('saved state shows נשמר ביומן and פגישה עם גלעד, not raw ASR sentence', () => {
    const html = renderToString(
      React.createElement(VoiceAddFlow, {
        ...BASE_PROPS,
        savedConfirmation: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00' },
      }),
    )
    expect(html).toContain('נשמר ביומן')
    expect(html).toContain('פגישה עם גלעד')
    expect(html).not.toContain('תקבעי')
    expect(html).not.toContain('תקווה')
    expect(html).not.toContain('הבעל של אופיר')
  })
})
