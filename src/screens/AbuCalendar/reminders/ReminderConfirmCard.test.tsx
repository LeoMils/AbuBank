import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ReminderConfirmCard } from './ReminderConfirmCard'
import type { ReminderDraft } from './types'

const FORBIDDEN = [
  'DEBUG', 'asr:', 'blob:', 'chunks:', 'transcript:', 'raw:',
  'voice-debug', 'transcript-box', 'מה שמעתי',
]

const BASE_DRAFT: ReminderDraft = {
  intent: 'reminder',
  title: 'לקחת כדור',
  category: 'medication',
  dueAt: '2026-05-30T10:00:00',
  displayDateLabel: 'מחר',
  displayTimeLabel: '10:00',
  alertPolicyDraft: { sound: true, voice: true, snoozeMinutes: 10 },
  missingFields: [],
  readbackText: 'מחר בשעה 10:00 להזכיר לך לקחת כדור',
}

const noop = () => {}

// ─── Basic render ─────────────────────────────────────────────────────────────
describe('ReminderConfirmCard — basic render', () => {
  it('renders with correct role=dialog', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('role="dialog"')
  })

  it('renders "הבנתי" heading', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('הבנתי')
  })

  it('renders "אני אזכור בשבילך"', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('אני אזכור בשבילך')
  })

  it('renders reminder title', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('לקחת כדור')
  })

  it('renders date and time', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('מחר')
    expect(html).toContain('10:00')
  })

  it('renders category icon', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('💊')
  })
})

// ─── Buttons ──────────────────────────────────────────────────────────────────
describe('ReminderConfirmCard — required buttons', () => {
  it('has save button', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('כן, לשמור')
  })

  it('has correct button', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('לא, לתקן')
  })

  it('has cancel button', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('ביטול')
  })

  it('data-testid reminder-confirm-save-btn present', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('reminder-confirm-save-btn')
  })

  it('data-testid reminder-confirm-cancel-btn present', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('reminder-confirm-cancel-btn')
  })
})

// ─── No debug leakage ─────────────────────────────────────────────────────────
describe('ReminderConfirmCard — no debug leakage', () => {
  it('has no forbidden debug strings', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    for (const bad of FORBIDDEN) {
      expect(html, `must not contain "${bad}"`).not.toContain(bad)
    }
  })

  it('does not render originalText field', () => {
    const draftWithOrig: ReminderDraft = {
      ...BASE_DRAFT,
    }
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: draftWithOrig, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).not.toContain('originalText')
  })
})

// ─── Ambiguous person ─────────────────────────────────────────────────────────
describe('ReminderConfirmCard — ambiguous person', () => {
  it('shows candidate chips when person is ambiguous', () => {
    const draft: ReminderDraft = {
      ...BASE_DRAFT,
      familyResolution: { status: 'ambiguous', originalPhrase: 'הבן של מור', candidates: ['איילון', 'אדר', 'עילי'] },
      ambiguity: { type: 'person', question: 'למי התכוונת?', options: [
        { label: 'איילון', value: 'איילון' },
        { label: 'אדר', value: 'אדר' },
        { label: 'עילי', value: 'עילי' },
      ]},
    }
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('למי התכוונת?')
    expect(html).toContain('איילון')
    expect(html).not.toContain('reminder-confirm-save-btn')
  })
})

// ─── Missing relation ─────────────────────────────────────────────────────────
describe('ReminderConfirmCard — missing relation', () => {
  it('shows calm missing-relation message', () => {
    const draft: ReminderDraft = {
      ...BASE_DRAFT,
      title: 'להתקשר לבת של מור',
      familyResolution: { status: 'missing', originalPhrase: 'הבת של מור' },
    }
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('relation-missing')
    expect(html).toContain('לא מצאתי בוודאות מי')
  })
})

// ─── Resolved family ─────────────────────────────────────────────────────────
describe('ReminderConfirmCard — resolved family', () => {
  it('shows resolved name and secondary phrase', () => {
    const draft: ReminderDraft = {
      ...BASE_DRAFT,
      title: 'להתקשר לגלעד',
      familyResolution: {
        status: 'resolved',
        originalPhrase: 'הבעל של אופיר',
        resolvedName: 'גלעד',
      },
    }
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('להתקשר לגלעד')
    expect(html).toContain('הבעל של אופיר')
  })
})

// ─── Recurring ───────────────────────────────────────────────────────────────
describe('ReminderConfirmCard — recurring reminder', () => {
  it('shows "חוזרת" label', () => {
    const draft: ReminderDraft = {
      ...BASE_DRAFT,
      recurrence: { frequency: 'daily', time: '09:00' },
      displayDateLabel: 'כל יום',
      displayTimeLabel: '09:00',
    }
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('כל יום')
    expect(html).toContain('חוזרת')
  })
})

// ─── Alert info ───────────────────────────────────────────────────────────────
describe('ReminderConfirmCard — alert info', () => {
  it('shows sound+screen notification info', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('צליל + הודעה על המסך')
  })

  it('shows PWA limitation disclosure', () => {
    const html = renderToString(
      React.createElement(ReminderConfirmCard, {
        draft: BASE_DRAFT, onConfirm: noop, onCancel: noop, onCorrect: noop,
      }),
    )
    expect(html).toContain('כשהאפליקציה פתוחה')
  })
})
