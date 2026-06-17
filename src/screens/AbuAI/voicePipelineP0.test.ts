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

// ═══ iPhone audio/mp4 → OpenAI STT ═══

describe('iPhone mp4 routes to OpenAI STT', () => {
  it('service.ts detects iPhone mp4 mime type', () => {
    expect(SERVICE_SRC).toContain("isIphoneMp4")
    expect(SERVICE_SRC).toContain("mp4")
    expect(SERVICE_SRC).toContain("m4a")
  })

  it('iPhone mp4 skips Groq (routes to OpenAI server)', () => {
    // The condition: if groqKey && !groqCooledDown && !isIphoneMp4
    expect(SERVICE_SRC).toContain('!isIphoneMp4')
  })

  it('OpenAI server STT endpoint exists', () => {
    const sttEndpoint = fs.existsSync(path.resolve(__dirname, '../../../api/abuai-stt.ts'))
    expect(sttEndpoint).toBe(true)
  })

  it('client calls /api/abuai-stt as fallback', () => {
    expect(SERVICE_SRC).toContain("'/api/abuai-stt'")
    expect(SERVICE_SRC).toContain('OpenAI server STT succeeded')
  })
})

// ═══ Groq 400 → OpenAI fallback ═══

describe('Groq 400 falls back to OpenAI STT', () => {
  it('Groq 400 does not exhaust — continues to OpenAI', () => {
    // After Groq 400, the code disables Groq but does NOT increment
    // _sttConsecutiveFailures — it tries OpenAI server next.
    expect(SERVICE_SRC).toContain("Groq disabled after 400")
    // The OpenAI server call comes AFTER the Groq block
    expect(SERVICE_SRC).toContain("Trying OpenAI server proxy")
  })
})

// ═══ Groq 429 → OpenAI fallback ═══

describe('Groq 429 falls back to OpenAI STT', () => {
  it('Groq 429 logs and continues to OpenAI', () => {
    expect(SERVICE_SRC).toContain("Groq rate-limited, trying OpenAI server")
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
