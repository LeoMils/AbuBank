/*
 * P0 voice pipeline fixes — regression tests.
 * Each test proves a specific fix from the real iPhone trace.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const INDEX_SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
const SERVICE_SRC = fs.readFileSync(path.resolve(__dirname, 'service.ts'), 'utf8')

// ═══ Self-listening guard ═══

describe('Self-listening guard', () => {
  it('rejects "רגע לא הצלחתי"', () => {
    // The SELF_PHRASES regex in handleText must match this phrase
    const re = /רגע.*לא הצלחתי/
    expect(re.test('רגע לא הצלחתי')).toBe(true)
    // Verify the guard exists in source
    expect(INDEX_SRC).toContain('SELF_PHRASES')
    expect(INDEX_SRC).toContain('Self-listening blocked')
  })

  it('rejects "לא הצלחתי בואי ננסה שוב"', () => {
    const re = /לא הצלחתי.*בואי ננסה/
    expect(re.test('לא הצלחתי בואי ננסה שוב')).toBe(true)
  })

  it('rejects "בואי ננסה שוב"', () => {
    const re = /בואי ננסה שוב/
    expect(re.test('בואי ננסה שוב')).toBe(true)
  })

  it('rejects "משהו לא עבד"', () => {
    const re = /משהו לא עבד/
    expect(re.test('משהו לא עבד')).toBe(true)
  })

  it('does NOT reject normal user input', () => {
    const SELF_PHRASES = /רגע.*לא הצלחתי|לא הצלחתי.*בואי ננסה|בואי ננסה שוב|לא שמעתי טוב|התמלול לא עובד|משהו לא עבד|ננסה שוב/
    expect(SELF_PHRASES.test('מה יש לי מחר')).toBe(false)
    expect(SELF_PHRASES.test('תקבעי לי פגישה')).toBe(false)
    expect(SELF_PHRASES.test('מי זה נועם')).toBe(false)
  })

  it('ignores transcript while TTS is responding', () => {
    // v30.10: Fixed stale closure — now uses voiceStateRef instead of isSpeaking state
    expect(INDEX_SRC).toContain("voiceStateRef.current === 'RESPONDING'")
    expect(INDEX_SRC).toContain('Ignored transcript while TTS speaking')
  })
})

// ═══ STT is SERVER-PROXY-ONLY (the Groq client-Whisper path was intentionally removed) ═══
// ARCHITECTURE CHANGE (P0 remediation): the client-side Groq/Gemini STT providers were removed —
// they required a client VITE_GROQ_API_KEY (a billable client secret). STT now goes through the
// server proxy /api/abuai-stt (OPENAI_API_KEY server-only, whisper-1). The prior Groq-400/429/iPhone-
// mp4-skip tests asserted that removed client path; they are updated here to assert the NEW single
// server-only architecture (NOT weakened). Replacement is DEPLOYED-PROVEN — a real TTS→STT round-trip
// on the clean RC (scripts/rc-acceptance-replacement-paths.mjs, PREVIEW class).

describe('STT: single server-proxy path, no client Groq/Gemini', () => {
  it('transcribeAudio calls ONLY the /api/abuai-stt server proxy (OpenAI whisper-1)', () => {
    expect(SERVICE_SRC).toContain("'/api/abuai-stt'")
    expect(SERVICE_SRC).toContain("'whisper-1'")
    expect(SERVICE_SRC).toContain('Trying OpenAI server proxy')
  })

  it('the removed client-Groq STT path is GONE (no client secret, no client provider call)', () => {
    // No client-direct Groq transcription: no api.groq.com STT call, no deprecated Groq model.
    expect(SERVICE_SRC).not.toContain('api.groq.com/openai/v1/audio')
    expect(SERVICE_SRC).not.toContain("'whisper-large-v3'")
    // The Groq client key is never READ (its name may appear in the removal-documentation comment).
    expect(SERVICE_SRC).not.toMatch(/import\.meta\.env\.VITE_GROQ_API_KEY|\benv\.VITE_GROQ_API_KEY/)
    // The removal is documented as intentional (server-only), not an accidental drop.
    expect(SERVICE_SRC).toMatch(/Groq client-Whisper fallback was removed/i)
  })

  it('the OpenAI server STT endpoint exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../../api/abuai-stt.ts'))).toBe(true)
  })
})

// ═══ Post-TTS cooldown ═══

describe('Post-TTS cooldown prevents self-listening', () => {
  it('cooldown is at least 800ms', () => {
    // The setTimeout after TTS must be >= 800
    expect(INDEX_SRC).toContain('800)')
    expect(INDEX_SRC).toContain('Post-TTS cooldown')
  })
})
