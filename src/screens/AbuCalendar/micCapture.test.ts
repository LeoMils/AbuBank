/*
 * AbuCalendar mic capture reliability tests.
 *
 * Source-grep tests verify that the recording pipeline in index.tsx uses
 * AbuAI-grade audio constraints, silence detection, min/max duration
 * guards, stopReason tracing, and senior-friendly status copy.
 *
 * These tests do NOT exercise browser APIs (no MediaRecorder mock) —
 * they verify contract compliance by reading the source code.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createInitialTrace, type VoiceTrace } from './voiceTrace'
import { MIC_AUDIO_CONSTRAINTS } from '../../services/audioConstraints'

const INDEX = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

// ─── 1) Audio constraints ──────────────────────────────────────────────
// The constraints now live in ONE source (services/audioConstraints) and every
// primary capture site requests them via MIC_GETUSERMEDIA (0.128.0 centralization).
describe('mic capture — AbuAI-grade audio constraints', () => {
  it('the shared constraints carry echoCancellation + noiseSuppression + autoGainControl', () => {
    expect(MIC_AUDIO_CONSTRAINTS.echoCancellation).toBe(true)
    expect(MIC_AUDIO_CONSTRAINTS.noiseSuppression).toBe(true)
    expect(MIC_AUDIO_CONSTRAINTS.autoGainControl).toBe(true)
  })

  it('the primary capture path uses the shared MIC_GETUSERMEDIA constraints, with bare {audio:true} only as the iOS fallback', () => {
    expect(INDEX.includes('MIC_GETUSERMEDIA')).toBe(true)          // primary = shared constraints
    expect(INDEX.includes('constraintsFallback = true')).toBe(true) // bare audio stays the fallback
  })
})

// ─── 2) Min recording duration ──────────────────────────────────────────
describe('mic capture — minimum recording duration guard', () => {
  it('MIN_RECORDING_MS is defined (800–1500ms range)', () => {
    const m = INDEX.match(/MIN_RECORDING_MS\s*=\s*(\d+)/)
    expect(m).not.toBeNull()
    const val = parseInt(m![1]!, 10)
    expect(val).toBeGreaterThanOrEqual(800)
    expect(val).toBeLessThanOrEqual(1500)
  })

  it('too-quick stop delays with calm Hebrew message', () => {
    expect(INDEX.includes('עוד רגע, אני מקשיבה...')).toBe(true)
    expect(INDEX.includes('min_duration_wait')).toBe(true)
  })

  it('delayed stop sets stopReason to min_duration_delay', () => {
    expect(INDEX.includes("'min_duration_delay'")).toBe(true)
  })
})

// ─── 3) Max recording duration ──────────────────────────────────────────
describe('mic capture — max recording duration auto-stop', () => {
  it('MAX_RECORDING_MS is defined (18000–30000ms range)', () => {
    const m = INDEX.match(/MAX_RECORDING_MS\s*=\s*(\d[\d_]*)/)
    expect(m).not.toBeNull()
    const val = parseInt(m![1]!.replace(/_/g, ''), 10)
    expect(val).toBeGreaterThanOrEqual(18000)
    expect(val).toBeLessThanOrEqual(30000)
  })

  it('max duration auto-stop sets stopReason to max_duration', () => {
    expect(INDEX.includes("'max_duration'")).toBe(true)
    expect(INDEX.includes('max_duration_stop')).toBe(true)
  })

  it('max duration shows calm Hebrew message', () => {
    expect(INDEX.includes('הבנתי, בודקת...')).toBe(true)
  })
})

// ─── 4) Silence detection ───────────────────────────────────────────────
describe('mic capture — silence-after-speech auto-stop', () => {
  it('imports createSilenceDetector from services/voice', () => {
    expect(INDEX.includes("createSilenceDetector")).toBe(true)
  })

  it('silence stop sets stopReason to silence_after_speech', () => {
    expect(INDEX.includes("'silence_after_speech'")).toBe(true)
    expect(INDEX.includes('silence_stop')).toBe(true)
  })

  it('SILENCE_AFTER_SPEECH_MS is defined (1500–3500ms)', () => {
    const m = INDEX.match(/SILENCE_AFTER_SPEECH_MS\s*=\s*(\d[\d_]*)/)
    expect(m).not.toBeNull()
    const val = parseInt(m![1]!.replace(/_/g, ''), 10)
    expect(val).toBeGreaterThanOrEqual(1500)
    expect(val).toBeLessThanOrEqual(3500)
  })

  it('SILENCE_MIN_ACTIVE_MS prevents premature stop (>= 1000ms)', () => {
    const m = INDEX.match(/SILENCE_MIN_ACTIVE_MS\s*=\s*(\d[\d_]*)/)
    expect(m).not.toBeNull()
    const val = parseInt(m![1]!.replace(/_/g, ''), 10)
    expect(val).toBeGreaterThanOrEqual(1000)
  })
})

// ─── 5) QA trace fields ─────────────────────────────────────────────────
describe('mic capture — QA trace contains all diagnostic fields', () => {
  it('VoiceTrace has stopReason field', () => {
    const t = createInitialTrace('test')
    expect('stopReason' in t).toBe(true)
    expect(t.stopReason).toBeNull()
  })

  it('VoiceTrace has audioDurationMs field', () => {
    const t = createInitialTrace('test')
    expect('audioDurationMs' in t).toBe(true)
    expect(t.audioDurationMs).toBeNull()
  })

  it('VoiceTrace has sttStatus field', () => {
    const t = createInitialTrace('test')
    expect('sttStatus' in t).toBe(true)
    expect(t.sttStatus).toBeNull()
  })

  it('VoiceTrace has blobSize field', () => {
    const t = createInitialTrace('test')
    expect('blobSize' in t).toBe(true)
  })

  it('trace records stopReason on no_audio path', () => {
    expect(INDEX.includes("stopReason: 'no_audio'")).toBe(true)
  })
})

// ─── 6) UI state — senior-friendly recording feedback ───────────────────
describe('mic capture — senior-friendly recording status', () => {
  it('recording stage shows "אני מקשיבה..."', () => {
    expect(INDEX.includes('אני מקשיבה...')).toBe(true)
  })

  it('auto-stop shows "הבנתי, בודקת..."', () => {
    // Both silence and max-duration auto-stops show this message
    const count = (INDEX.match(/הבנתי, בודקת\.\.\./g) || []).length
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('no raw transcript shown in normal UI (only in QA panel)', () => {
    // The ConfirmCard never renders raw transcript
    const card = fs.readFileSync(path.resolve(__dirname, 'ConfirmCard.tsx'), 'utf8')
    expect(card.includes('rawTranscript')).toBe(false)
  })
})

// ─── 7) MediaRecorder timeslice ─────────────────────────────────────────
describe('mic capture — MediaRecorder uses timeslice', () => {
  it('mr.start() is called with a timeslice argument', () => {
    // mr.start(250) — timeslice for chunk-count diagnostics
    expect(/mr\.start\(\d+\)/.test(INDEX)).toBe(true)
  })
})
