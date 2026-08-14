/*
 * AbuCalendar transcription-failure copy — POST D7 (one voice engine).
 *
 * The calendar screen no longer transcribes in-screen (the mic routes to Abu AI,
 * which owns STT and its own honest error UI). What remains valid here is the
 * shared error-copy contract: `userFacingError` copy + `errorMediation`
 * classification, both retained modules used by the one engine. This file also
 * pins the removal of the calendar's own capture-error handling.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { userFacingError } from '../../services/platformHealth'

const SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('D7 — the calendar screen carries no in-screen transcription error path', () => {
  it('index.tsx no longer imports voice-capture error mediation', () => {
    expect(SRC.includes("mediateVoiceCaptureError")).toBe(false)
    expect(SRC.includes('transcribeCalendarAudio')).toBe(false)
  })
  it('index.tsx routes the mic to Abu AI (the single engine owns STT + errors)', () => {
    expect(SRC.includes('setScreen(Screen.AbuAI)')).toBe(true)
  })
})

describe('P0.5 — userFacingError copy matches the spec (retained module)', () => {
  it('voice_transcribe_key_missing is the friendly "תמלול קולי לא מוגדר" copy', () => {
    expect(userFacingError('voice_transcribe_key_missing', 'he')).toBe('תמלול קולי לא מוגדר באפליקציה.')
  })

  it('voice_transcribe_failed is the friendly "לא הצלחתי לתמלל" copy', () => {
    expect(userFacingError('voice_transcribe_failed', 'he')).toBe('לא הצלחתי לתמלל את ההקלטה כרגע.')
  })
})

describe('P0.5 — transcription service errors differentiated from speech-not-understood', () => {
  it('mediateVoiceCaptureError uses classifyError for transcription phase (retained module)', () => {
    const mediationSrc = fs.readFileSync(path.resolve(__dirname, '../../services/errorMediation.ts'), 'utf8')
    expect(mediationSrc).toContain("const cat = classifyError(err)")
    expect(mediationSrc).toContain("cat === 'auth'")
    expect(mediationSrc).toContain("cat === 'network'")
    expect(mediationSrc).toContain("cat === 'rate-limit'")
  })
})

describe('P0.5 — visual safety preserved', () => {
  it('AbuCalendar voice change does NOT modify Home', () => {
    expect(SRC.includes('home-diagnostic-pill')).toBe(false)
    expect(SRC.includes('__abubankOpenDiag')).toBe(false)
  })
})
