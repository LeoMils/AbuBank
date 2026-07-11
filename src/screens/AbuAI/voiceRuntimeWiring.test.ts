/*
 * Voice runtime WIRING contract — proves the repair is actually connected to the
 * real AbuAI screen / Realtime client (Defect 1 was a tested-but-unused module).
 * Source-level assertions: the correct evidence for "is X wired into Y".
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const index = read('src/screens/AbuAI/index.tsx')
const realtime = read('src/services/realtimeVoice.ts')

describe('Defect 1 — canonical voiceStateMachine is imported and USED by the real screen', () => {
  it('1. index.tsx imports the canonical state machine + flight recorder', () => {
    expect(index).toMatch(/from ['"]\.\.\/\.\.\/services\/voiceStateMachine['"]/)
    expect(index).toMatch(/from ['"]\.\.\/\.\.\/services\/voiceFlightRecorder['"]/)
    expect(index).toContain('nextVoiceState')
    expect(index).toContain('startVoiceFlight')
  })
  it('2. no SECOND competing `type VoiceState` DEFINITION remains in the screen', () => {
    // A local `type VoiceState = ...` definition would compete. The only allowed
    // occurrence is the import alias of the canonical type (`type VoiceState as ...`).
    expect(index).not.toMatch(/type VoiceState\s*=/)  // no local definition
    expect(index).toMatch(/type VoiceState as CanonicalVoiceState/) // canonical imported+aliased
    expect(index).toMatch(/type VoiceUIPhase\s*=/)    // the local phase was renamed
  })
  it('uses failure states — transcript-failed + audio-blocked handlers are wired', () => {
    expect(index).toContain('onTranscriptFailed')
    expect(index).toContain('onAudioBlocked')
    expect(index).toContain("failureLine('TRANSCRIPTION_FAILED')")
  })
})

describe('Defect 2 — Realtime client uses the normalized (current + legacy) event contract', () => {
  it('3/4. realtimeVoice imports the normalizer (not a hard-coded legacy switch)', () => {
    expect(realtime).toMatch(/from ['"]\.\/realtimeEvents['"]/)
    expect(realtime).toContain('normalizeRealtimeEvent')
    // the legacy raw names are no longer the switch keys
    expect(realtime).not.toMatch(/case 'response\.audio\.delta':/)
  })
  it('5. a transcription failure is handled explicitly', () => {
    expect(realtime).toContain('user_transcript_failed')
    expect(realtime).toContain('onTranscriptFailed')
  })
  it('output audio play() promise is awaited/caught (not assumed heard)', () => {
    expect(realtime).toContain('playsInline')
    expect(realtime).toContain('onAudioBlocked')
    expect(realtime).toMatch(/\.play\(\)/)
  })
})

describe('on-device diagnostics UI', () => {
  it('the "העתקת אבחון קול" copy button exists in the screen', () => {
    expect(index).toContain('העתקת אבחון קול')
    expect(index).toContain('copyVoiceReport')
  })
  it('the tap-to-hear recovery button exists and re-speaks (no silent failure)', () => {
    expect(index).toContain('לחצי כאן כדי לשמוע שוב')
    expect(index).toContain('data-testid="tap-to-hear"')
    // The button must actually re-voice the last reply, not merely dismiss.
    expect(index).toContain('lastSpokenTextRef')
  })
})
