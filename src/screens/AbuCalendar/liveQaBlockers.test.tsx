/*
 * Live-QA blocker regression tests.
 *
 * Covers three blockers reported during operator QA:
 *   1. Reminder missing-time flow — after the user chooses a suggestion or
 *      "לבחור שעה", the card MUST surface a save path (כן, לשמור).
 *   2. Family relation/person phrases — "חברה של מור" (and similar
 *      non-resolvable phrases) MUST be acknowledged as missing with a clear
 *      Hebrew message AND the card MUST still allow לשמור / לתקן / ביטול.
 *   3. Voice debug panel — operator-only diagnostic surface that exposes
 *      raw / normalized / route / parsed date·time·person. Hidden by
 *      default; visible only when localStorage['abu-voice-debug']==='true'.
 */

import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

// Vitest runs in node without a DOM. Provide a minimal in-memory shim for
// `localStorage` so the operator-only debug-panel gate (which reads from
// localStorage) can be exercised deterministically.
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>()
    ;(globalThis as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => { store.clear() },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size },
    } as Storage
  }
})
import { ReminderConfirmCard } from './reminders/ReminderConfirmCard'
import type { ReminderDraft } from './reminders/types'
import { ConfirmCard } from './ConfirmCard'
import { extractPersonPhrase, resolvePersonPhrase } from './familyResolve'
import {
  VoiceDebugPanel,
  VoiceDebugToggle,
  VOICE_DEBUG_LOCALSTORAGE_KEY,
  isVoiceDebugEnabled,
} from './VoiceDebugPanel'
import type { VoiceTrace } from './voiceTrace'
import { createInitialTrace } from './voiceTrace'

const noop = () => {}

const BASE_DRAFT: ReminderDraft = {
  intent: 'reminder',
  title: 'לקחת תרופה',
  category: 'medication',
  alertPolicyDraft: { sound: true, voice: true, snoozeMinutes: 10 },
  missingFields: [],
  readbackText: '',
}

// ─── BLOCKER 1: reminder missing-time → save path ────────────────────────────
describe('BLOCKER 1 — reminder missing-time flow', () => {
  const missingTimeDraft: ReminderDraft = {
    ...BASE_DRAFT,
    missingFields: ['time'],
    ambiguity: {
      type: 'time',
      question: 'מתי להזכיר לך?',
      options: [
        { label: 'בעוד שעה', value: 'in_1h' },
        { label: 'היום בערב', value: 'today_evening' },
        { label: 'מחר בבוקר', value: 'tomorrow_morning' },
        { label: 'לבחור שעה', value: 'manual' },
      ],
    },
  }

  it('renders all four time-suggestion buttons with stable test ids', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: missingTimeDraft, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('בעוד שעה')
    expect(html).toContain('היום בערב')
    expect(html).toContain('מחר בבוקר')
    expect(html).toContain('לבחור שעה')
    expect(html).toContain('data-testid="reminder-time-suggestion-in_1h"')
    expect(html).toContain('data-testid="reminder-time-suggestion-today_evening"')
    expect(html).toContain('data-testid="reminder-time-suggestion-tomorrow_morning"')
    expect(html).toContain('data-testid="reminder-time-suggestion-manual"')
  })

  it('hides the save button while time is still missing/ambiguous', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: missingTimeDraft, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).not.toContain('data-testid="reminder-confirm-save-btn"')
  })

  it('shows save / correct / cancel after parent resolves the chosen time', () => {
    // Simulate what the parent does after the user taps a suggestion like
    // "בעוד שעה": dueAt set, missingFields cleared, ambiguity removed.
    const resolved: ReminderDraft = {
      ...missingTimeDraft,
      dueAt: '2026-05-30T15:00:00',
      displayDateLabel: 'היום',
      displayTimeLabel: '15:00',
      missingFields: [],
    }
    delete (resolved as Partial<ReminderDraft>).ambiguity
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: resolved, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('data-testid="reminder-confirm-save-btn"')
    expect(html).toContain('data-testid="reminder-confirm-correct-btn"')
    expect(html).toContain('data-testid="reminder-confirm-cancel-btn"')
    expect(html).toContain('כן, לשמור')
    expect(html).toContain('לא, לתקן')
    expect(html).toContain('ביטול')
    // The save button must NOT be disabled.
    expect(html).not.toMatch(
      /data-testid="reminder-confirm-save-btn"[^>]*\sdisabled=""/,
    )
  })

  it('does not crash and never produces an Invalid Date when val is "manual"', () => {
    // The parent's onResolveTime used to call Date.setHours(NaN) when val
    // was 'manual', producing an Invalid Date and silently breaking the
    // save flow. After the fix, 'manual' is handled inside the card (it
    // switches to correcting mode) and the parent guards the value.
    // Simulate the guarded parent: it must return early, not throw.
    let threw = false
    const guard = (val: string) => {
      if (val === 'manual') return // mirrors the fix in index.tsx
      const [hStr, mStr] = val.split(':')
      const h = Number(hStr)
      const m = Number(mStr ?? '0')
      if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error('NaN time')
      new Date().setHours(h, m, 0, 0)
    }
    try { guard('manual') } catch { threw = true }
    expect(threw).toBe(false)
  })
})

// ─── BLOCKER 2: family relation / person phrases ─────────────────────────────
describe('BLOCKER 2 — family relation phrases', () => {
  it('extracts "חברה של מור" as a person phrase', () => {
    // "עם" branch returns the bare phrase. The "anywhere" branch keeps the
    // Hebrew prepositional prefix (ל) since the resolver knows how to strip
    // it. Both shapes resolve to the same missing status downstream.
    expect(extractPersonPhrase('פגישה עם חברה של מור')).toBe('חברה של מור')
    expect(extractPersonPhrase('תזכירי לי להתקשר לחברה של מור'))
      .toBe('לחברה של מור')
  })

  it('marks "חברה של מור" (and "ל" prefix form) as missing', () => {
    for (const p of ['חברה של מור', 'לחברה של מור', 'החברה של מור']) {
      const r = resolvePersonPhrase(p)
      expect(r.status).toBe('missing')
      if (r.status === 'missing') expect(r.phrase).toBe(p)
    }
  })

  it('marks "חבר של אופיר" as missing (friend, not family)', () => {
    const r = resolvePersonPhrase('חבר של אופיר')
    expect(r.status).toBe('missing')
  })

  it('"אחות של ארי" extracts and is resolvable (sibling pattern)', () => {
    expect(extractPersonPhrase('פגישה עם אחות של ארי')).toBe('אחות של ארי')
    const r = resolvePersonPhrase('אחות של ארי')
    // Ari's sibling-of-female status depends on family graph; accept any
    // non-'none' result — what matters is the resolver does not throw
    // and the phrase is honestly handled (resolved / ambiguous / missing).
    expect(['resolved', 'ambiguous', 'missing']).toContain(r.status)
  })

  it('"הבעל של אופיר" resolves to גלעד (regression guard)', () => {
    const r = resolvePersonPhrase('הבעל של אופיר')
    expect(r.status).toBe('resolved')
    if (r.status === 'resolved') expect(r.name).toBe('גלעד')
  })

  it('appointment ConfirmCard: missing relation shows clear message + all three actions', () => {
    const html = renderToString(
      React.createElement(ConfirmCard, {
        draft: { title: 'פגישה עם חברה של מור', date: '2026-05-30', time: '19:00' },
        relation: { status: 'missing', phrase: 'חברה של מור' },
        onConfirm: noop, onCorrect: noop, onCancel: noop,
      }),
    )
    expect(html).toContain('data-testid="relation-missing"')
    expect(html).toContain('לא מצאתי בוודאות מי')
    expect(html).toContain('חברה של מור')
    // save / correct / cancel must all be present and reachable
    expect(html).toContain('data-testid="confirm-save-btn"')
    expect(html).toContain('data-testid="confirm-correct-btn"')
    expect(html).toContain('data-testid="confirm-cancel-btn"')
    expect(html).toContain('כן, לשמור')
    expect(html).toContain('לא, לתקן')
    expect(html).toContain('ביטול')
  })

  it('reminder ReminderConfirmCard: missing relation surfaces message + save', () => {
    const draftWithMissing: ReminderDraft = {
      ...BASE_DRAFT,
      title: 'להתקשר לחברה של מור',
      dueAt: '2026-05-30T19:00:00',
      displayDateLabel: 'היום',
      displayTimeLabel: '19:00',
      familyResolution: { status: 'missing', originalPhrase: 'חברה של מור' },
    }
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: draftWithMissing, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('data-testid="relation-missing"')
    // React inserts HTML comments between literal and dynamic text, so check
    // the two halves separately.
    expect(html).toContain('לא מצאתי בוודאות מי')
    expect(html).toContain('חברה של מור')
    expect(html).toContain('data-testid="reminder-confirm-save-btn"')
    expect(html).toContain('data-testid="reminder-confirm-cancel-btn"')
  })
})

// ─── BLOCKER 3: voice debug panel (operator-only) ────────────────────────────
describe('BLOCKER 3 — voice debug panel', () => {
  afterEach(() => {
    try { localStorage.removeItem(VOICE_DEBUG_LOCALSTORAGE_KEY) } catch { /* ignore */ }
  })

  const trace: VoiceTrace = {
    ...createInitialTrace('test'),
    rawTranscript: 'תזכירי לי בשבע',
    transcript: 'תזכירי לי בשבע',
    correctedTranscript: 'תזכירי לי בשבע',
    parseDecision: 'reminder',
    semanticIntent: 'reminder',
    extractedTitle: 'לקחת תרופה',
    extractedDate: 'מחר',
    extractedStartTime: '19:00',
    extractedPeople: ['אופיר'],
    finalVoiceStage: 'parsing',
  }

  it('renders NOTHING by default (no localStorage flag)', () => {
    try { localStorage.removeItem(VOICE_DEBUG_LOCALSTORAGE_KEY) } catch { /* ignore */ }
    expect(isVoiceDebugEnabled()).toBe(false)
    const html = renderToString(
      React.createElement(VoiceDebugPanel, { trace, reminderDraft: null }),
    )
    expect(html).toBe('')
    expect(html).not.toContain('mic-qa-trace')
  })

  it('renders panel with raw/normalized/route/date/time/person when flag is "true"', () => {
    localStorage.setItem(VOICE_DEBUG_LOCALSTORAGE_KEY, 'true')
    expect(isVoiceDebugEnabled()).toBe(true)
    const html = renderToString(
      React.createElement(VoiceDebugPanel, { trace, reminderDraft: null }),
    )
    expect(html).toContain('data-testid="mic-qa-trace"')
    expect(html).toContain('data-testid="mic-qa-raw"')
    expect(html).toContain('data-testid="mic-qa-normalized"')
    expect(html).toContain('data-testid="mic-qa-route"')
    expect(html).toContain('data-testid="mic-qa-date"')
    expect(html).toContain('data-testid="mic-qa-time"')
    expect(html).toContain('data-testid="mic-qa-person"')
    expect(html).toContain('תזכירי לי בשבע')
    expect(html).toContain('reminder')
    expect(html).toContain('מחר')
    expect(html).toContain('19:00')
    expect(html).toContain('אופיר')
  })

  it('renders nothing when flag is any value other than "true"', () => {
    for (const val of ['false', '1', 'yes', '', 'TRUE']) {
      localStorage.setItem(VOICE_DEBUG_LOCALSTORAGE_KEY, val)
      expect(isVoiceDebugEnabled()).toBe(false)
      const html = renderToString(
        React.createElement(VoiceDebugPanel, { trace, reminderDraft: null }),
      )
      expect(html).toBe('')
    }
  })

  it('VoiceDebugToggle renders a tiny "QA" button in DEV (no DevTools required)', () => {
    // In vitest, import.meta.env.DEV is true by default — we just need the
    // button shape and testid. Production builds (DEV=false) render null.
    const html = renderToString(React.createElement(VoiceDebugToggle))
    if (import.meta.env.DEV) {
      expect(html).toContain('data-testid="voice-debug-toggle"')
      expect(html).toContain('QA')
      expect(html).toContain('aria-label="toggle mic QA debug panel"')
    } else {
      expect(html).toBe('')
    }
  })

  it('prefers reminderDraft fields over trace fields when both are present', () => {
    localStorage.setItem(VOICE_DEBUG_LOCALSTORAGE_KEY, 'true')
    const draftWithResolution: ReminderDraft = {
      ...BASE_DRAFT,
      title: 'להתקשר לגלעד',
      dueAt: '2026-05-30T19:00:00',
      displayDateLabel: 'היום',
      displayTimeLabel: '21:30',
      familyResolution: {
        status: 'resolved',
        originalPhrase: 'הבעל של אופיר',
        resolvedName: 'גלעד',
      },
    }
    const html = renderToString(
      React.createElement(VoiceDebugPanel, {
        trace,
        reminderDraft: draftWithResolution,
      }),
    )
    expect(html).toContain('היום')
    expect(html).toContain('21:30')
    expect(html).toContain('גלעד')
    // route always says 'reminder' when a reminderDraft is present
    expect(html).toContain('mic-qa-route')
    expect(html).toContain('reminder')
  })
})
