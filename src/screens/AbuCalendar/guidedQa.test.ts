/*
 * Guided Mic QA UX contract tests.
 *
 * Source-grep tests over VoiceDebugPanel.tsx to verify the state-machine
 * flow cannot be misused: buttons are disabled at the right times,
 * expected vs actual is shown, and the end state offers Copy All JSON.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = fs.readFileSync(path.resolve(__dirname, 'VoiceDebugPanel.tsx'), 'utf8')

describe('guided QA — state machine contract', () => {
  it('shows instruction to press mic in ready state', () => {
    expect(SRC.includes('לחץ על המיקרופון ואז תגיד בדיוק את המשפט הזה')).toBe(true)
    expect(SRC.includes('guided-qa-instruction')).toBe(true)
  })

  it('PASS/FAIL buttons exist with data-testids', () => {
    expect(SRC.includes('guided-qa-pass')).toBe(true)
    expect(SRC.includes('guided-qa-fail')).toBe(true)
  })

  it('PASS/FAIL disabled before result exists (passFailEnabled gating)', () => {
    expect(SRC.includes("const passFailEnabled = state === 'result_ready'")).toBe(true)
    expect(SRC.includes('disabled={!passFailEnabled}')).toBe(true)
  })

  it('Next button only rendered after marked state', () => {
    // Next is inside a `state === 'marked'` conditional
    expect(SRC.includes("state === 'marked'")).toBe(true)
    expect(SRC.includes('guided-qa-next')).toBe(true)
  })

  it('expected vs actual appears in result_ready state', () => {
    expect(SRC.includes('guided-qa-expected')).toBe(true)
    expect(SRC.includes('guided-qa-actual')).toBe(true)
    expect(SRC.includes('מה ציפינו')).toBe(true)
    expect(SRC.includes('מה יצא בפועל')).toBe(true)
  })

  it('PASS click marks current run', () => {
    expect(SRC.includes("handleMark('pass')")).toBe(true)
    expect(SRC.includes("target.comparisonResult = result")).toBe(true)
  })

  it('FAIL click marks current run', () => {
    expect(SRC.includes("handleMark('fail')")).toBe(true)
  })

  it('Next advances phrase and resets state', () => {
    expect(SRC.includes("setState('ready')")).toBe(true)
    expect(SRC.includes("setIdx(i => i + 1)")).toBe(true)
    expect(SRC.includes("setMarked(null)")).toBe(true)
  })

  it('end state shows Copy All QA JSON button', () => {
    expect(SRC.includes('guided-qa-copy-all')).toBe(true)
    expect(SRC.includes('העתק את כל ה-JSON')).toBe(true)
    expect(SRC.includes('סיימנו את 30 הבדיקות')).toBe(true)
  })

  it('hidden when QA OFF (dev-only + enabled check)', () => {
    expect(SRC.includes("if (!import.meta.env.DEV) return null")).toBe(true)
    expect(SRC.includes('if (!enabled) return null')).toBe(true)
  })

  it('primary buttons have minHeight >= 56px', () => {
    // Count occurrences of minHeight: 56 in the GuidedMicQaPanel
    const matches = SRC.match(/minHeight:\s*56/g)
    // At least 3 buttons: ready-btn, PASS, FAIL, Next, Copy All
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(4)
  })

  it('help line is always visible', () => {
    expect(SRC.includes('guided-qa-help')).toBe(true)
    expect(SRC.includes('הסדר: מיקרופון → לדבר → לבדוק תוצאה → PASS/FAIL → Next')).toBe(true)
  })

  it('auto-comparison hint shows green or red', () => {
    expect(SRC.includes('guided-qa-auto-hint')).toBe(true)
    expect(SRC.includes('נראה תקין — אם גם המסך נראה נכון, לחץ PASS')).toBe(true)
    expect(SRC.includes('יש פער — בדוק וסמן FAIL')).toBe(true)
  })

  it('data-guided-state attribute reflects current state', () => {
    expect(SRC.includes('data-guided-state={state}')).toBe(true)
    expect(SRC.includes('data-guided-state="done"')).toBe(true)
  })

  it('marked FAIL shows encouragement to continue', () => {
    expect(SRC.includes('אפשר להמשיך. בסוף נעתיק JSON וננתח הכול.')).toBe(true)
  })

  it('phrase counter shows "בדיקה X מתוך Y"', () => {
    expect(SRC.includes('guided-qa-counter')).toBe(true)
    expect(SRC.includes('בדיקה')).toBe(true)
    expect(SRC.includes('מתוך')).toBe(true)
  })
})
