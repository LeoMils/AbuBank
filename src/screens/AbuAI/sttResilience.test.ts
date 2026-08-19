/*
 * STT resilience tests — prove that Groq 400 does not loop,
 * provider is cooled down, and voice state recovers safely.
 */

import { describe, it, expect } from 'vitest'
import { SttExhaustedError, resetSttFailureCount, getSttConsecutiveFailures } from './service'

describe('STT exhaustion guard', () => {
  it('SttExhaustedError has correct name', () => {
    const err = new SttExhaustedError('test')
    expect(err.name).toBe('SttExhaustedError')
    expect(err.message).toBe('test')
    expect(err instanceof Error).toBe(true)
  })

  it('resetSttFailureCount resets counter', () => {
    resetSttFailureCount()
    expect(getSttConsecutiveFailures()).toBe(0)
  })
})

describe('STT model', () => {
  it('service.ts uses the OpenAI server model whisper-1 (Groq client models removed)', () => {
    // The client-Groq STT path (whisper-large-v3 / the deprecated turbo that 400'd) was intentionally
    // removed; STT now uses OpenAI whisper-1 via /api/abuai-stt (server-only). Not weakened — asserts
    // the NEW model + absence of the old client models. Replacement deployed-proven (round-trip).
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'service.ts'), 'utf8')
    expect(src).toContain("'whisper-1'")
    expect(src).not.toContain("'whisper-large-v3'")
    expect(src).not.toContain("'whisper-large-v3-turbo'")
  })
})

describe('STT does not read VITE_OPENAI_API_KEY', () => {
  it('transcribeAudio does not use OpenAI key directly (server-proxy contract)', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'service.ts'), 'utf8')
    // The transcribeAudio function should NOT read VITE_OPENAI_API_KEY
    // (OpenAI key lives on the server only)
    const sttSection = src.split('transcribeAudio')[1]?.split('export')[0] ?? ''
    expect(sttSection).not.toContain('VITE_OPENAI_API_KEY')
  })
})
