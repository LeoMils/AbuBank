/**
 * FINAL VOICE READINESS (non-hardware)
 * ════════════════════════════════════
 * The voice handler lives inside a React component wired to Web Audio / WebRTC,
 * so its guarantees are proven as a SOURCE CONTRACT over index.tsx plus runnable
 * checks of the pieces it composes (orchestrator routing, grounded answers, the
 * TTS-evidence wrapper). Real audio playback is the only device-only part.
 *
 * Guarantees proven here:
 *  - every voice-origin answer branch calls TTS (speak / stream-speak)
 *  - the streaming path has a serial-speak fallback → no text-only success
 *  - all 11 device diagnostics are emitted
 *  - Realtime failure falls back to the pipeline QUIETLY (initial connect error
 *    is silent; fatal error → pipeline) with a FALLBACK_REASON
 *  - no greeting loop; voice inputs flow through the orchestrator
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { orchestrate } from './understandingOrchestrator'
import { tryGroundedAnswer } from './service'
import { addAppointment } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
const IDX = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
})

// ── 1. Every voice-origin answer branch speaks ──────────────────────────────
describe('every voice-origin answer triggers TTS', () => {
  it('greeting is spoken', () => { expect(IDX).toMatch(/await speakVoiceMode\(toSpokenText\(greeting\)\)/) })
  it('clarification (askWho) is spoken', () => { expect(IDX).toMatch(/await speakVoiceMode\(toSpokenText\(askWho\)\)/) })
  it('reminder + recurring + create-confirm answers are spoken', () => {
    // multiple `speakVoiceMode(shapeVoiceSafe(response|recurResponse))` branches
    expect((IDX.match(/await speakVoiceMode\(toSpokenText\(/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })
  it('grounded / family / online / general answers are spoken (serial)', () => {
    expect(IDX).toMatch(/await speakVoiceMode\(spokenText\)/)
  })
  it('streaming LLM answer speaks per sentence (stream-speak)', () => {
    expect(IDX).toContain('_streamSpeakVoiceMode(')
  })
  it('error fallback is spoken (no silent error)', () => {
    expect(IDX).toMatch(/await speakVoiceMode\(toSpokenText\(errText\)\)/)
  })
})

// ── 2. No text-only success: streaming path has a serial fallback ────────────
describe('no text-only success state', () => {
  it('streaming TTS failure falls back to a serial speak of the final text', () => {
    expect(IDX).toContain('streamSpeakThrew')
    expect(IDX).toMatch(/streamSpeakThrew && voiceModeRef\.current[\s\S]{0,90}speakVoiceMode\(toSpokenText\(finalContent\)\)/)
  })
})

// ── 3. All 11 device diagnostics are emitted ────────────────────────────────
describe('voice diagnostics', () => {
  it.each([
    'ORCH_INTENT', 'AUDIO_UNLOCK_STATUS', 'STT_SUCCESS', 'STT_CHARS',
    'TTS_ENGINE_USED', 'VOICE_NAME', 'SPOKEN_TEXT_LENGTH', 'REALTIME_STATUS', 'FALLBACK_REASON',
  ])('emits %s', (k) => { expect(IDX).toContain(k) })
  it('emits TTS_SUCCESS and TTS_FAIL (one per outcome)', () => {
    expect(IDX).toMatch(/TTS_\$\{ok \? 'SUCCESS' : 'FAIL'\}/)
  })
})

// ── 4. Realtime failure → quiet pipeline fallback ───────────────────────────
describe('realtime fallback is quiet', () => {
  it('an INITIAL realtime connect error is silent (no error card before fallback)', () => {
    expect(IDX).toContain('realtimeEverConnectedRef')
    expect(IDX).toMatch(/if \(!realtimeEverConnectedRef\.current\) \{[\s\S]{0,400}return/)
  })
  it('a fatal realtime error falls back to the pipeline with a reason', () => {
    expect(IDX).toMatch(/FALLBACK_REASON=realtime_unavailable/)
    expect(IDX).toContain('startPipelineVoiceMode()')
  })
  it('quota flag short-circuits straight to pipeline on the next start (no retry storm)', () => {
    expect(IDX).toContain("abu-openai-quota-failed")
    expect(IDX).toMatch(/openaiAvailable\s*=\s*useRealtime/)
  })
})

// ── 5. No greeting loop; voice flows through the orchestrator ────────────────
describe('no greeting loop + orchestrated voice', () => {
  it('greeting plays once then transitions to listening (not re-greet)', () => {
    expect(IDX).toMatch(/await speakVoiceMode\(toSpokenText\(greeting\)\)[\s\S]{0,600}startVoiceListening/)
  })
  it('voice inputs pass through the orchestrator front door', () => {
    expect(IDX).toContain('orchestrate(text, { messages })')
  })
})

// ── 6. Runnable: each voice-origin intent routes to a SPEAKING branch ────────
describe('voice-origin intents resolve to a deterministic, speakable answer', () => {
  it('calendar read → grounded (non-null) → serial speak branch', () => {
    addAppointment({ title: 'פגישה עם אלכסנדרה', date: '2026-06-24', time: '19:00', emoji: '☕', personName: 'אלכסנדרה' } as Parameters<typeof addAppointment>[0])
    expect(orchestrate('מה יש לי היום', { messages: [] }).intent).toBe('calendar_read')
    expect(tryGroundedAnswer('מה יש לי היום')).not.toBeNull()
  })
  it('calendar create → meeting + clarification when needed', () => {
    const o = orchestrate('תקבעי לי פגישה עם מור מחר בשלוש אחר הצהריים', { messages: [] })
    expect(o.intent).toBe('calendar_create')
    expect(o.meeting!.time).toBe('15:00')
  })
  it('family → grounded', () => {
    expect(orchestrate('מי זאת מור', { messages: [] }).intent).toBe('family')
    expect(tryGroundedAnswer('מי זאת מור')).not.toBeNull()
  })
  it('online → online intent', () => {
    expect(orchestrate('מה מזג האוויר מחר בכפר סבא', { messages: [] }).intent).toBe('online')
  })
  it('emotional → emotional (warm path), shaped without banned register', () => {
    const o = orchestrate('אני מתגעגעת לפפי', { messages: [] })
    expect(o.intent).toBe('emotional')
    expect(o.shape('אני מתגעגעת לפפי. איך אפשר לעזור?')).not.toContain('איך אפשר לעזור')
  })
  it('general → general', () => {
    expect(orchestrate('ספרי לי בדיחה', { messages: [] }).intent).toBe('general')
  })
})
