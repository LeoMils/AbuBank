/*
 * SINGLE VOICE ENTRY — the teeth of D7 (one voice engine).
 * ════════════════════════════════════════════════════════════════════════════
 * There must be exactly ONE speech engine in this product: Abu AI. The calendar
 * screen must NOT reintroduce a second STT capture. This guard fails the moment
 * any capture primitive (getUserMedia / MediaRecorder / a silence detector / the
 * calendar's own transcribe) reappears in the AbuCalendar product path, and it
 * asserts the mic still routes to Abu AI.
 *
 * Mutation target: `scripts/mutation-harness.mjs` reintroduces a getUserMedia call
 * into index.tsx and proves THIS test turns red (the guard has teeth). A green
 * suite under that mutation would mean the guard is decorative — a defect.
 *
 * Product-path only: test files legitimately mention these APIs (mocks, retained
 * module unit-tests), so we scan the SHIPPED screen sources, not *.test.*.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const DIR = __dirname
const INDEX = fs.readFileSync(path.resolve(DIR, 'index.tsx'), 'utf8')

// Capture primitives that constitute a "speech engine". If any of these is called
// from the calendar screen, a second engine exists.
const CAPTURE_PRIMITIVES = [
  'getUserMedia',
  'new MediaRecorder',
  'MediaRecorder(',
  'createSilenceDetector',
  'transcribeCalendarAudio',
  'MIC_GETUSERMEDIA',
]

describe('single voice entry — the calendar screen owns no capture', () => {
  for (const prim of CAPTURE_PRIMITIVES) {
    it(`index.tsx does not use "${prim}"`, () => {
      expect(INDEX.includes(prim)).toBe(false)
    })
  }

  it('the mic CTA routes to Abu AI (Screen.AbuAI), the single engine', () => {
    expect(INDEX.includes('setScreen(Screen.AbuAI)')).toBe(true)
    // The data-testid the app/e2e tests use for the primary mic must still exist,
    // so the affordance is present — it just opens the one engine now.
    expect(INDEX.includes('data-testid="main-mic-btn"')).toBe(true)
  })

  it('no local recording state/handlers linger in the calendar screen', () => {
    expect(INDEX.includes('handleVoiceRecord')).toBe(false)
    expect(INDEX.includes('mediaRecorderRef')).toBe(false)
    expect(INDEX.includes('isRecording')).toBe(false)
  })
})

// Broader sweep: no OTHER calendar screen source (ManualModal, reminders, etc.)
// silently opens a capture engine either. Retained voice modules
// (VoiceCard/VoiceAddFlow/calendarTranscribe/VoiceDebugPanel) are library code
// that is no longer wired into the screen; they are excluded from the product
// entry-path scan but MUST NOT be re-imported by index.tsx (asserted above).
describe('single voice entry — no capture reachable from the calendar screen wiring', () => {
  it('index.tsx does not import the retired capture/overlay modules', () => {
    const RETIRED_IMPORTS = [
      "from './calendarTranscribe'",
      "from './VoiceAddFlow'",
      "from './voiceAutoCreate'",
      "from '../../services/voice'",
      "from './VoiceDebugPanel'",
    ]
    for (const imp of RETIRED_IMPORTS) {
      expect(INDEX.includes(imp), `index.tsx still imports ${imp}`).toBe(false)
    }
  })
})
