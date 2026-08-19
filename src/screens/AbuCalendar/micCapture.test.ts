/*
 * AbuCalendar capture contract — POST D7 (one voice engine).
 *
 * The calendar screen no longer runs its own STT capture. The mic routes to
 * Abu AI, the single speech engine. This file now pins (a) the shared audio
 * constraints module (still used by Abu AI), (b) the retained VoiceTrace type,
 * (c) the ConfirmCard privacy contract, and (d) the NEW truth that index.tsx
 * carries no capture. The authoritative single-entry guard is
 * `singleVoiceEntry.test.ts`.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createInitialTrace } from './voiceTrace'
import { MIC_AUDIO_CONSTRAINTS } from '../../services/audioConstraints'

const INDEX = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

// ─── 1) Shared audio constraints (retained module, used by the one engine) ──
describe('shared mic constraints — AbuAI-grade', () => {
  it('carry echoCancellation + noiseSuppression + autoGainControl', () => {
    expect(MIC_AUDIO_CONSTRAINTS.echoCancellation).toBe(true)
    expect(MIC_AUDIO_CONSTRAINTS.noiseSuppression).toBe(true)
    expect(MIC_AUDIO_CONSTRAINTS.autoGainControl).toBe(true)
  })
})

// ─── 2) The calendar path has NO second capture engine (D7) ────────────────
describe('D7 — calendar index.tsx owns no capture', () => {
  it('no getUserMedia / MediaRecorder / silence detector / transcribe in the calendar path', () => {
    expect(INDEX.includes('getUserMedia')).toBe(false)
    expect(INDEX.includes('MediaRecorder')).toBe(false)
    expect(INDEX.includes('createSilenceDetector')).toBe(false)
    expect(INDEX.includes('transcribeCalendarAudio')).toBe(false)
    expect(INDEX.includes('MIC_GETUSERMEDIA')).toBe(false)
  })

  it('the mic routes to Abu AI instead of recording locally', () => {
    expect(INDEX.includes('setScreen(Screen.AbuAI)')).toBe(true)
    expect(INDEX.includes('handleVoiceRecord')).toBe(false)
  })
})

// ─── 3) VoiceTrace type fields (retained module) ───────────────────────────
describe('VoiceTrace fields (retained)', () => {
  it('has stopReason / audioDurationMs / sttStatus / blobSize', () => {
    const t = createInitialTrace('test')
    expect('stopReason' in t).toBe(true)
    expect(t.stopReason).toBeNull()
    expect('audioDurationMs' in t).toBe(true)
    expect(t.audioDurationMs).toBeNull()
    expect('sttStatus' in t).toBe(true)
    expect(t.sttStatus).toBeNull()
    expect('blobSize' in t).toBe(true)
  })
})

// ─── 4) ConfirmCard privacy (retained component) ───────────────────────────
describe('ConfirmCard — no raw transcript in normal UI', () => {
  it('ConfirmCard never renders rawTranscript', () => {
    const card = fs.readFileSync(path.resolve(__dirname, 'ConfirmCard.tsx'), 'utf8')
    expect(card.includes('rawTranscript')).toBe(false)
  })
})
