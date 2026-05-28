/**
 * Voice ADD UX Contract — integration render tests (P7).
 *
 * Static-source tests guarantee the gate exists; these tests verify the
 * gate WORKS by rendering the actual component with a clean default
 * localStorage and asserting that no diagnostic strings reach the DOM
 * output. This is the integration coverage that catches the runtime
 * vs. source mismatch the live browser QA found.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { VoiceCard } from './VoiceCard'
import { VoiceTraceCard } from './VoiceTraceCard'
import { createInitialTrace } from './voiceTrace'

// Minimal in-memory localStorage shim so the components' isDiagMode
// gate evaluates against a known clean state.
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
  // Force a clean localStorage AND ensure import.meta.env.DEV is false in
  // the test environment (Vitest sets MODE='test', DEV is undefined →
  // both branches of isDiagMode fail closed).
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage
})

// The exact set of strings that triggered the live browser QA blocker.
// None of these may appear in the DOM output of the default render.
const FORBIDDEN_DEFAULT = [
  'DEBUG',
  'מצב הקלטה',
  'העתק אבחון קול',
  'מה שמעתי',
  'transcript-box',
  'transcript-textarea',
  'voice-debug',
  'voice-trace-stage',
  'lפני תיקון',
  'blob:',
  'chunks:',
  'mime:',
  'asr:',
]

describe('VoiceCard render — default localStorage shows zero diagnostic UI', () => {
  it('confirmation mode (parsed, no editing) renders ConfirmCard only — no diagnostic strings', () => {
    const html = renderToString(
      React.createElement(VoiceCard, {
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅', personName: 'גלעד' },
        existingAppts: [],
        onConfirm: () => {},
        onCancel: () => {},
        voiceState: 'parsed',
        rawTranscript: 'תקבעי פגישה למחר בשעה 21 עם הבעל של אופיר',
      }),
    )
    for (const s of FORBIDDEN_DEFAULT) {
      expect(html, `default voice render must not include "${s}"`).not.toContain(s)
    }
    // Must include the ConfirmCard contract buttons.
    expect(html).toContain('כן, לשמור')
    expect(html).toContain('לא, לתקן')
    expect(html).toContain('ביטול')
    expect(html).toContain('הבנתי')
    // Must show normalized person, not raw transcript.
    expect(html).toContain('פגישה עם גלעד')
    expect(html).not.toContain('תקבעי')
    expect(html).not.toContain('תקווה')
  })

  it('with relation.status="resolved", renders the secondary phrase line', () => {
    const html = renderToString(
      React.createElement(VoiceCard, {
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅', personName: 'גלעד' },
        existingAppts: [],
        onConfirm: () => {},
        onCancel: () => {},
        voiceState: 'parsed',
        relation: { status: 'resolved', phrase: 'הבעל של אופיר' },
      }),
    )
    expect(html).toContain('relation-secondary')
    expect(html).toContain('הבעל של אופיר')
    // Still no diagnostic.
    for (const s of FORBIDDEN_DEFAULT) expect(html).not.toContain(s)
  })

  it('with relation.status="missing", renders the calm missing copy', () => {
    const html = renderToString(
      React.createElement(VoiceCard, {
        parsed: { title: 'פגישה עם הבת של מור', date: '2026-05-29', time: '21:00', emoji: '📅', personName: 'הבת של מור' },
        existingAppts: [],
        onConfirm: () => {},
        onCancel: () => {},
        voiceState: 'parsed',
        relation: { status: 'missing', phrase: 'הבת של מור' },
      }),
    )
    expect(html).toContain('relation-missing')
    expect(html).toContain('לא מצאתי בוודאות מי')
    for (const s of FORBIDDEN_DEFAULT) expect(html).not.toContain(s)
  })

  it('with relation.status="ambiguous", renders candidate buttons and the "keep" fallback', () => {
    const html = renderToString(
      React.createElement(VoiceCard, {
        parsed: { title: 'פגישה עם הבן של מור', date: '2026-05-29', time: '21:00', emoji: '📅', personName: 'הבן של מור' },
        existingAppts: [],
        onConfirm: () => {},
        onCancel: () => {},
        voiceState: 'parsed',
        relation: { status: 'ambiguous', phrase: 'הבן של מור', candidates: ['אופיר', 'איילון', 'עילי', 'אדר'] },
      }),
    )
    expect(html).toContain('למי התכוונת?')
    expect(html).toContain('relation-candidate')
    expect(html).toContain('relation-keep')
    expect(html).toContain('להשאיר כמו שאמרתי')
    // Candidates list rendered, no auto-select
    expect(html).toContain('אופיר')
    expect(html).toContain('איילון')
    for (const s of FORBIDDEN_DEFAULT) expect(html).not.toContain(s)
  })
})

describe('VoiceTraceCard render — default localStorage shows nothing in normal flow', () => {
  it('idle trace returns null (renders empty)', () => {
    const trace = createInitialTrace('test-version')
    const html = renderToString(
      React.createElement(VoiceTraceCard, {
        trace,
        onDismiss: () => {},
        onCopied: () => {},
        copied: false,
      }),
    )
    expect(html).toBe('')
  })

  it('non-error stage in normal mode renders nothing (no "מצב הקלטה" card, no metadata)', () => {
    const trace = createInitialTrace('test-version')
    // Simulate "awaiting confirm" — the exact state that previously leaked diagnostic UI.
    const stateful = { ...trace, finalVoiceStage: 'idle' as const, visibleMessage: 'מחכה לאישור שלך לפני שמירה.' }
    const html = renderToString(
      React.createElement(VoiceTraceCard, {
        trace: stateful,
        onDismiss: () => {},
        onCopied: () => {},
        copied: false,
      }),
    )
    // No diagnostic card.
    for (const s of FORBIDDEN_DEFAULT) expect(html).not.toContain(s)
    // And no "מחכה לאישור" leak either — VoiceTraceCard must not render this non-error message in normal mode.
    expect(html).not.toContain('מחכה לאישור')
  })

  it('error trace shows ONLY the user-facing error message — no diagnostic metadata', () => {
    const trace = createInitialTrace('test-version')
    const errorTrace = {
      ...trace,
      finalVoiceStage: 'error' as const,
      error: 'לא הצלחתי להבין את ההקלטה.',
      visibleMessage: 'לא הצלחתי להבין את ההקלטה.',
      mimeType: 'audio/webm',
      blobSize: 12345,
      chunksCount: 3,
      asrModel: 'whisper-large-v3',
    }
    const html = renderToString(
      React.createElement(VoiceTraceCard, {
        trace: errorTrace,
        onDismiss: () => {},
        onCopied: () => {},
        copied: false,
      }),
    )
    // User-facing error message shown.
    expect(html).toContain('בעיה בהקלטה')
    expect(html).toContain('לא הצלחתי להבין את ההקלטה.')
    // No diagnostic metadata leaks.
    for (const s of FORBIDDEN_DEFAULT) expect(html).not.toContain(s)
  })
})

describe('Production gate — isDiagMode requires BOTH DEV build AND localStorage flag', () => {
  it('even with localStorage flag set, default render in test env still suppresses diagnostic UI', () => {
    // Set the flag — but import.meta.env.DEV is false in the test runner,
    // so the AND-gate must keep diagnostic UI hidden.
    ;(globalThis.localStorage as Storage).setItem('abu-voice-debug', 'true')
    const html = renderToString(
      React.createElement(VoiceCard, {
        parsed: { title: 'פגישה עם גלעד', date: '2026-05-29', time: '21:00', emoji: '📅' },
        existingAppts: [],
        onConfirm: () => {},
        onCancel: () => {},
        voiceState: 'parsed',
        rawTranscript: 'raw asr text that must not leak',
      }),
    )
    for (const s of FORBIDDEN_DEFAULT) expect(html).not.toContain(s)
    expect(html).not.toContain('raw asr text')
  })
})

describe('main.tsx — dev-mode service worker self-heal', () => {
  it('main.tsx unregisters prior service workers in DEV builds (anti-stale-cache guard)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const main = readFileSync(resolve(__dirname, '../../main.tsx'), 'utf8')
    expect(main).toContain('import.meta')
    expect(main).toMatch(/env[\s\S]{0,12}DEV/)
    expect(main).toContain('getRegistrations')
    expect(main).toContain('unregister')
  })
})
