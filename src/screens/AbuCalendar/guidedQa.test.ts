/*
 * Guided Mic QA UX contract tests.
 *
 * Source-grep tests over VoiceDebugPanel.tsx to verify the state-machine
 * flow: internal record button, disabled gates, expected vs actual,
 * QaRecorderPanel hidden during guided QA, and mobile viewport safety.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = fs.readFileSync(path.resolve(__dirname, 'VoiceDebugPanel.tsx'), 'utf8')
const IDX = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('guided QA — internal record button', () => {
  it('has an internal record button with mic emoji', () => {
    expect(SRC.includes('guided-qa-record-btn')).toBe(true)
    expect(SRC.includes('לחץ כאן והקלט את המשפט')).toBe(true)
  })

  it('record button calls onRecord prop (not external mic)', () => {
    expect(SRC.includes('onRecord()')).toBe(true)
    expect(SRC.includes('onRecord: () => void')).toBe(true)
  })

  it('does NOT instruct user to press an external hidden mic', () => {
    // Old text was "1. לחץ על המיקרופון" — should be gone
    expect(SRC.includes('1. לחץ על המיקרופון')).toBe(false)
    expect(SRC.includes('לחץ על המיקרופון ואז תגיד')).toBe(false)
  })

  it('record button has minHeight >= 56px', () => {
    // The record button uses minHeight: 60
    expect(/guided-qa-record-btn.*minHeight:\s*6\d/s.test(SRC) || SRC.includes("minHeight: 60")).toBe(true)
  })

  it('has a stop-record button during recording state', () => {
    expect(SRC.includes('guided-qa-stop-record')).toBe(true)
    expect(SRC.includes('סיימתי — עצור הקלטה')).toBe(true)
  })
})

describe('guided QA — recording/processing states', () => {
  it('shows recording indicator in recording state', () => {
    expect(SRC.includes('guided-qa-recording')).toBe(true)
    expect(SRC.includes('אני מקשיבה... תגיד את כל המשפט')).toBe(true)
  })

  it('shows processing indicator', () => {
    expect(SRC.includes('guided-qa-processing')).toBe(true)
    expect(SRC.includes('בודקת מה הבנתי')).toBe(true)
  })

  it('tracks voiceState and isRecording from props', () => {
    expect(SRC.includes('voiceState: string')).toBe(true)
    expect(SRC.includes('isRecording: boolean')).toBe(true)
  })
})

describe('guided QA — QaRecorderPanel hidden during guided QA', () => {
  it('QaRecorderPanel checks _guidedQaActive before rendering', () => {
    expect(SRC.includes('_guidedQaActive')).toBe(true)
    expect(SRC.includes('if (!enabled || _guidedQaActive) return null')).toBe(true)
  })

  it('isGuidedQaActive export exists', () => {
    expect(SRC.includes('export function isGuidedQaActive')).toBe(true)
  })
})

describe('guided QA — state gates', () => {
  it('PASS/FAIL disabled before result exists', () => {
    expect(SRC.includes("const passFailEnabled = state === 'result_ready'")).toBe(true)
    expect(SRC.includes('disabled={!passFailEnabled}')).toBe(true)
  })

  it('Next button only rendered in marked state', () => {
    expect(SRC.includes("state === 'marked'")).toBe(true)
    expect(SRC.includes('guided-qa-next')).toBe(true)
  })

  it('PASS/FAIL buttons only rendered in result_ready state', () => {
    expect(SRC.includes("(state === 'result_ready')")).toBe(true)
  })
})

describe('guided QA — expected vs actual', () => {
  it('shows expected summary', () => {
    expect(SRC.includes('guided-qa-expected')).toBe(true)
    expect(SRC.includes('מה ציפינו')).toBe(true)
  })

  it('shows actual summary', () => {
    expect(SRC.includes('guided-qa-actual')).toBe(true)
    expect(SRC.includes('מה יצא בפועל')).toBe(true)
  })

  it('auto-comparison hint (green/red)', () => {
    expect(SRC.includes('guided-qa-auto-hint')).toBe(true)
    expect(SRC.includes('נראה תקין')).toBe(true)
    expect(SRC.includes('יש פער')).toBe(true)
  })
})

describe('guided QA — end state and misc', () => {
  it('end state shows Copy All JSON', () => {
    expect(SRC.includes('guided-qa-copy-all')).toBe(true)
    expect(SRC.includes('סיימנו את 30 הבדיקות')).toBe(true)
  })

  it('hidden when QA OFF', () => {
    expect(SRC.includes('if (!enabled) return null')).toBe(true)
  })

  it('help line always visible', () => {
    expect(SRC.includes('guided-qa-help')).toBe(true)
    expect(SRC.includes('הסדר: מיקרופון → לדבר → לבדוק תוצאה → PASS/FAIL → Next')).toBe(true)
  })

  it('marked FAIL shows encouragement', () => {
    expect(SRC.includes('אפשר להמשיך. בסוף נעתיק JSON וננתח הכול.')).toBe(true)
  })

  it('phrase counter visible', () => {
    expect(SRC.includes('guided-qa-counter')).toBe(true)
    expect(SRC.includes('בדיקה')).toBe(true)
    expect(SRC.includes('מתוך')).toBe(true)
  })

  it('all primary action buttons >= 56px', () => {
    const matches = SRC.match(/minHeight:\s*5[6-9]|minHeight:\s*60/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(5)
  })
})

describe('guided QA — mic recording fix (P0 blocker)', () => {
  it('guided QA has internal record button with 🎤', () => {
    expect(SRC.includes('guided-qa-record-btn')).toBe(true)
    expect(SRC.includes('לחץ כאן והקלט את המשפט')).toBe(true)
  })

  it('does NOT tell user to press external hidden mic', () => {
    expect(SRC.includes('1. לחץ על המיקרופון')).toBe(false)
    expect(SRC.includes('לחץ על המיקרופון ואז תגיד')).toBe(false)
  })

  it('QaRecorderPanel hidden while guided QA active', () => {
    expect(SRC.includes('_guidedQaActive')).toBe(true)
    expect(SRC.includes('if (!enabled || _guidedQaActive) return null')).toBe(true)
  })

  it('record button minHeight >= 56px', () => {
    expect(SRC.includes('guided-qa-record-btn')).toBe(true)
    // record button uses minHeight: 60
    expect(SRC.includes('minHeight: 60')).toBe(true)
  })
})

describe('recording start — moved to Abu AI (post D7)', () => {
  // D7 · one voice engine: the iOS-Safari capture fallback chain (getUserMedia →
  // bare audio → MediaRecorder → timeslice) lived in the calendar's own capture,
  // which was removed. That robustness now belongs to Abu AI's shared voice
  // service. The calendar screen must contain NO capture fallback code.
  it('index.tsx contains no getUserMedia / MediaRecorder capture chain', () => {
    expect(IDX.includes('getUserMedia')).toBe(false)
    expect(IDX.includes('MediaRecorder')).toBe(false)
    expect(IDX.includes('mr.start(')).toBe(false)
  })
  it('the calendar mic routes to Abu AI', () => {
    expect(IDX.includes('setScreen(Screen.AbuAI)')).toBe(true)
  })
})

describe('mic self-test diagnostic', () => {
  it('MicSelfTest component exists', () => {
    expect(SRC.includes('export function MicSelfTest')).toBe(true)
    expect(SRC.includes('mic-self-test')).toBe(true)
  })

  it('tests secure context + getUserMedia + MediaRecorder + start/stop', () => {
    expect(SRC.includes('secureContext')).toBe(true)
    expect(SRC.includes('getUserMedia(constraints)')).toBe(true)
    expect(SRC.includes('getUserMedia(bare)')).toBe(true)
    expect(SRC.includes('MediaRecorder created')).toBe(true)
    expect(SRC.includes('start(250)')).toBe(true)
    expect(SRC.includes('RESULT: MIC OK')).toBe(true)
    expect(SRC.includes('RESULT: MIC PROBLEM')).toBe(true)
  })

  it('MicSelfTest is a retained component, no longer rendered in the calendar screen (D7)', () => {
    // The self-test panel exercised the calendar's own capture, which is gone.
    expect(IDX.includes('<MicSelfTest')).toBe(false)
  })

  it('hidden when QA OFF', () => {
    expect(SRC.includes("if (!import.meta.env.DEV) return null")).toBe(true)
  })
})

// ─── P0: State transition regression tests ──────────────────────────────
describe('guided QA — state transition guards (P0 fix)', () => {
  it('voiceState effect only advances from recording state, never from ready', () => {
    // The effect must check `state === "recording"` before advancing.
    // It must NOT advance when state is 'ready' — that would skip the
    // record button and jump directly to processing/result_ready.
    expect(SRC.includes("if (state === 'recording')")).toBe(true)
    // Must NOT have the old pattern that advances from any non-result state
    expect(SRC.includes("if (!active || state === 'result_ready' || state === 'marked') return")).toBe(false)
  })

  it('poll effect requires recordStartedAt > 0 (user pressed record)', () => {
    expect(SRC.includes('recordStartedAt === 0')).toBe(true)
    expect(SRC.includes('recordStartedAt')).toBe(true)
  })

  it('poll effect checks run timestamp > recordStartedAt (rejects stale runs)', () => {
    expect(SRC.includes('runTime >= recordStartedAt')).toBe(true)
    expect(SRC.includes("new Date(run.timestamp).getTime()")).toBe(true)
  })

  it('record button sets recordStartedAt before calling onRecord', () => {
    expect(SRC.includes('setRecordStartedAt(Date.now()')).toBe(true)
  })

  it('handleNext resets recordStartedAt to 0', () => {
    expect(SRC.includes('setRecordStartedAt(0)')).toBe(true)
  })

  it('ready → result_ready without recording is impossible', () => {
    // The poll effect only runs when state is recording/processing AND
    // recordStartedAt > 0. Both conditions require the user to have
    // pressed the record button.
    // Verify: poll returns early when state is not recording/processing
    expect(SRC.includes("state !== 'processing' && state !== 'recording'")).toBe(true)
    // Verify: poll returns early when recordStartedAt is 0
    expect(SRC.includes('if (recordStartedAt === 0) return')).toBe(true)
  })
})
