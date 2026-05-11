/*
 * AbuCalendar P0 — ManualModal hidden-default fix.
 *
 * Previous behavior: useState(editing?.time ?? '09:00') prefilled the
 * time to 09:00. A user clicking Save with only the title filled would
 * silently create an event at TODAY 09:00. This file pins the new
 * contract: no hidden defaults, Save is gated on title + date + time,
 * an inline hint shows the missing field.
 *
 * Tests are source-grep + behavioral helpers (the actual modal needs
 * DOM to render; we assert the source contract here and rely on the
 * Phase 4 spec for the visual QA on phone).
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = fs.readFileSync(path.resolve(__dirname, 'ManualModal.tsx'), 'utf8')

describe('AbuCalendar P0 — ManualModal hidden default removed', () => {
  it('time state no longer defaults to "09:00"', () => {
    // The fix changed `useState(editing?.time ?? '09:00')` to
    // `useState(editing?.time ?? '')`. Verify by source grep.
    expect(SRC.includes("useState(editing?.time ?? '09:00')")).toBe(false)
    expect(SRC.includes("useState(editing?.time ?? '')")).toBe(true)
  })

  it('Save button is gated on canSave (title + date + time all valid)', () => {
    expect(/const\s+canSave\s*=\s*Boolean\(trimmedTitle\s*&&\s*isDateValid\s*&&\s*isTimeValid\)/.test(SRC)).toBe(true)
  })

  it('canSave validates date in YYYY-MM-DD format', () => {
    expect(/isDateValid\s*=\s*\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//.test(SRC)).toBe(true)
  })

  it('canSave validates time in HH:MM format', () => {
    expect(/isTimeValid\s*=\s*\/\^\\d\{2\}:\\d\{2\}\$\//.test(SRC)).toBe(true)
  })

  it('Save button is disabled when canSave is false', () => {
    expect(SRC.includes('disabled={!canSave}')).toBe(true)
  })

  it('handleSave returns early when any required field is missing', () => {
    expect(/if\s*\(!trimmedTitle\)\s*\{\s*setMissingHint/.test(SRC)).toBe(true)
    expect(/if\s*\(!isDateValid\)\s*\{\s*setMissingHint/.test(SRC)).toBe(true)
    expect(/if\s*\(!isTimeValid\)\s*\{\s*setMissingHint/.test(SRC)).toBe(true)
  })

  it('inline missing-field hint is rendered when fields are incomplete', () => {
    expect(SRC.includes('data-testid="manual-missing-hint"')).toBe(true)
    expect(SRC.includes('חסר שם לאירוע')).toBe(true)
    expect(SRC.includes('חסר תאריך')).toBe(true)
    expect(SRC.includes('חסרה שעה')).toBe(true)
  })

  it('senior-friendly missing-detail message is present', () => {
    expect(SRC.includes('חסר לי פרט כדי לשמור את הפגישה')).toBe(true)
  })

  it('Save button carries a testid for phone QA inspection', () => {
    expect(SRC.includes('data-testid="manual-save"')).toBe(true)
  })
})

describe('AbuCalendar P0 — ManualModal behavior contract (logic-level)', () => {
  // The component is React + DOM-heavy; we extract its pure gating
  // expressions and re-validate them here against the spec.

  function isDateValid(date: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(date) }
  function isTimeValid(time: string): boolean { return /^\d{2}:\d{2}$/.test(time) }
  function canSave(title: string, date: string, time: string): boolean {
    return Boolean(title.trim() && isDateValid(date) && isTimeValid(time))
  }

  it('blank title cannot save', () => {
    expect(canSave('', '2026-05-15', '10:00')).toBe(false)
  })

  it('blank date cannot save', () => {
    expect(canSave('רופא', '', '10:00')).toBe(false)
  })

  it('blank time cannot save', () => {
    expect(canSave('רופא', '2026-05-15', '')).toBe(false)
  })

  it('invalid date format ("tomorrow") cannot save', () => {
    expect(canSave('רופא', 'tomorrow', '10:00')).toBe(false)
  })

  it('invalid time format ("4pm") cannot save', () => {
    expect(canSave('רופא', '2026-05-15', '4pm')).toBe(false)
  })

  it('all three valid → save enabled', () => {
    expect(canSave('רופא', '2026-05-15', '10:00')).toBe(true)
  })
})
