/*
 * AbuCalendar P0.5 — visible-transcription-failure source contract.
 *
 * If transcribeAudio throws because the Groq key is missing or the
 * upstream is rejecting the request, the AbuCalendar voice path MUST
 * surface a friendly Hebrew message — never the raw technical
 * "מפתח API לתמלול לא הוגדר" string and never a silent vanish.
 *
 * Pure source-grep; the runtime branch is covered by the existing
 * voiceAutoCreate test suite for the happy paths.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { userFacingError } from '../../services/platformHealth'

const SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('P0.5 — AbuCalendar imports platformHealth.userFacingError', () => {
  it('imports userFacingError from src/services/platformHealth', () => {
    expect(SRC.includes("import { userFacingError } from '../../services/platformHealth'")).toBe(true)
  })
  it('imports shared mediateVoiceCaptureError from errorMediation', () => {
    expect(SRC.includes("import { mediateVoiceCaptureError } from '../../services/errorMediation'")).toBe(true)
  })
})

describe('P0.5 — voice-error catch handler translates known failures', () => {
  it('catches the missing-Groq-key error and shows voice_transcribe_key_missing copy', () => {
    expect(SRC.includes("if (raw.includes('מפתח API לתמלול לא הוגדר'))")).toBe(true)
    expect(SRC.includes("userFacingError('voice_transcribe_key_missing', 'he')")).toBe(true)
  })

  it('catches network / 401 / 429 transcription failures and shows voice_transcribe_failed copy', () => {
    expect(SRC.includes("mediateVoiceCaptureError(e, 'transcription')")).toBe(true)
    expect(SRC.includes("מפתח API לא תקין")).toBe(true)
    expect(SRC.includes("יותר מדי בקשות")).toBe(true)
  })

  it('never silently drops a transcription error (always setVoiceFailure → trace + state + error)', () => {
    // P0.6 — the catch block now routes every failure through
    // setVoiceFailure(message, step), which writes BOTH the voice
    // trace and the legacy voiceError/voiceState pair. Verify the
    // catch handler calls setVoiceFailure.
    expect(SRC.includes('setVoiceFailure(friendly, step)')).toBe(true)
  })

  it('transcription failures use shared senior-friendly mediation and do not expose raw errors', () => {
    expect(SRC.includes("mediateVoiceCaptureError(e, 'transcription')")).toBe(true)
    expect(SRC.includes('friendly = raw')).toBe(false)
  })
})

describe('P0.5 — userFacingError copy matches the spec', () => {
  it('voice_transcribe_key_missing is the friendly "תמלול קולי לא מוגדר" copy', () => {
    expect(userFacingError('voice_transcribe_key_missing', 'he')).toBe('תמלול קולי לא מוגדר באפליקציה.')
  })

  it('voice_transcribe_failed is the friendly "לא הצלחתי לתמלל" copy', () => {
    expect(userFacingError('voice_transcribe_failed', 'he')).toBe('לא הצלחתי לתמלל את ההקלטה כרגע.')
  })
})

describe('P0.5 — transcription service errors differentiated from speech-not-understood', () => {
  it('mediateVoiceCaptureError uses classifyError for transcription phase', () => {
    // The function now classifies the error before choosing copy
    const mediationSrc = fs.readFileSync(path.resolve(__dirname, '../../services/errorMediation.ts'), 'utf8')
    expect(mediationSrc).toContain("const cat = classifyError(err)")
    expect(mediationSrc).toContain("cat === 'auth'")
    expect(mediationSrc).toContain("cat === 'network'")
    expect(mediationSrc).toContain("cat === 'rate-limit'")
  })
})

describe('P0.5 — visual safety preserved', () => {
  it('AbuCalendar voice patch does NOT modify Home', () => {
    // Source-grep guard: the rebased PR must not touch Home/index.tsx.
    // We assert that no Home-affecting markers exist in this file.
    expect(SRC.includes('home-diagnostic-pill')).toBe(false)
    expect(SRC.includes('__abubankOpenDiag')).toBe(false)
  })
})
