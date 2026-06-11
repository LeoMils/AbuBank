import { describe, it, expect } from 'vitest'
import { classifyError, mediateError, mediateVoiceCaptureError, LEO_CONTACT_URL } from './errorMediation'

describe('classifyError', () => {
  it('classifies 402 as quota', () => {
    expect(classifyError('payment required', 402)).toBe('quota')
  })

  it('classifies 429 with quota text as quota', () => {
    expect(classifyError('You exceeded your current quota', 429)).toBe('quota')
  })

  it('classifies 429 without quota text as rate-limit', () => {
    expect(classifyError('too many requests', 429)).toBe('rate-limit')
  })

  it('classifies 401 as auth', () => {
    expect(classifyError('unauthorized', 401)).toBe('auth')
  })

  it('classifies timeout text as timeout', () => {
    expect(classifyError('request timed out')).toBe('timeout')
  })

  it('classifies network errors', () => {
    expect(classifyError('failed to fetch')).toBe('network')
  })

  it('classifies billing text as quota', () => {
    expect(classifyError('check your billing details')).toBe('quota')
  })

  it('falls through to unknown', () => {
    expect(classifyError('something weird happened')).toBe('unknown')
  })
})

describe('mediateError', () => {
  it('returns Hebrew for quota error', () => {
    const result = mediateError('quota exceeded', 429)
    expect(result.category).toBe('quota')
    // Hebrew only — no English letters in message
    expect(result.message).not.toMatch(/[a-zA-Z]/)
    expect(result.primaryAction).toBe('whatsapp-leo')
  })

  it('returns Hebrew for all categories', () => {
    const categories = [
      { input: 'quota exceeded', status: 429 },
      { input: 'unauthorized', status: 401 },
      { input: 'failed to fetch', status: undefined },
      { input: 'timed out', status: undefined },
      { input: 'something unknown', status: undefined },
    ]
    for (const { input, status } of categories) {
      const result = mediateError(input, status)
      // Each Hebrew message must be non-empty and not contain English words
      expect(result.message.length).toBeGreaterThan(0)
      expect(result.primaryLabel).toMatch(/[\u0590-\u05FF]/)
    }
  })

  it('includes warm WhatsApp contact for billing issues', () => {
    const result = mediateError('insufficient_quota', 429)
    expect(result.primaryAction).toBe('whatsapp-leo')
    expect(result.secondaryAction).toBe('home')
  })

  it('uses clear senior-friendly copy (v27.1)', () => {
    // Quota: tells her plainly she should talk to Leo — no abstract metaphors
    const quotaResult = mediateError('quota exceeded', 429)
    expect(quotaResult.message).toContain('דברי עם לאו')
    expect(quotaResult.message).not.toContain('נגמרו לי הכוחות') // old poetic phrasing removed
    // Unknown: simple, direct
    const unknownResult = mediateError('random error')
    expect(unknownResult.message).toContain('לא עבד')
  })

  it('Leo button label matches WhatsApp action (not phone call)', () => {
    const quotaResult = mediateError('quota exceeded', 429)
    // Label must NOT say "call" — action is WhatsApp, not a phone call
    expect(quotaResult.primaryLabel).not.toContain('להתקשר')
    expect(quotaResult.primaryLabel).toContain('הודעה')
    const authResult = mediateError('unauthorized', 401)
    expect(authResult.primaryLabel).not.toContain('להתקשר')
    expect(authResult.primaryLabel).toContain('הודעה')
  })

  it('error messages do not use technical jargon', () => {
    // "עומס" was confusing tech-speak for rate-limit — now uses "תנועה" (traffic, familiar metaphor)
    const rateLimitResult = mediateError('too many requests', 429)
    expect(rateLimitResult.message).not.toContain('עומס')
    // "ברקע" was metaphorical for auth — now direct
    const authResult = mediateError('unauthorized', 401)
    expect(authResult.message).not.toContain('ברקע')
  })

  it('provides dismiss for mic-denied (not retry)', () => {
    const err = new DOMException('', 'NotAllowedError')
    const result = mediateError(err)
    expect(result.category).toBe('mic-denied')
    expect(result.primaryAction).toBe('dismiss')
  })

  it('every primary label is Hebrew', () => {
    const errors = [
      { input: 'quota', status: 402 },
      { input: 'unauthorized', status: 401 },
      { input: 'failed to fetch', status: undefined },
      { input: 'unknown', status: undefined },
    ]
    for (const e of errors) {
      const r = mediateError(e.input, e.status)
      // Check first character is Hebrew (U+0590 to U+05FF)
      const firstChar = r.primaryLabel.charCodeAt(0)
      expect(firstChar >= 0x0590 && firstChar <= 0x05FF).toBe(true)
    }
  })
})

describe('LEO_CONTACT_URL', () => {
  it('is a valid HTTPS WhatsApp URL', () => {
    expect(LEO_CONTACT_URL).toMatch(/^https:\/\/chat\.whatsapp\.com\//)
  })
})

describe('mediateVoiceCaptureError', () => {
  it('maps NotAllowedError to senior-friendly permission copy', () => {
    const err = new DOMException('', 'NotAllowedError')
    const msg = mediateVoiceCaptureError(err)
    expect(msg).toContain('המיקרופון חסום')
    expect(msg).not.toMatch(/NotAllowedError|DOMException|stack/i)
  })

  it('maps NotFoundError to no-microphone copy', () => {
    const err = new DOMException('', 'NotFoundError')
    const msg = mediateVoiceCaptureError(err)
    expect(msg).toContain('מיקרופון')
    expect(msg).not.toMatch(/NotFoundError|DOMException|stack/i)
  })

  it('maps unknown recording start failures to retry copy', () => {
    const msg = mediateVoiceCaptureError(new Error('boom'), 'recording_start')
    expect(msg).toBe('לא הצלחתי להתחיל הקלטה. ננסה שוב.')
    expect(msg).not.toMatch(/boom|Error|stack/i)
  })

  it('maps true speech-not-understood transcription failures to speech copy', () => {
    const msg = mediateVoiceCaptureError(new Error('transcribe failed'), 'transcription')
    expect(msg).toBe('לא הצלחתי להבין את ההקלטה. ננסה שוב.')
    expect(msg).not.toMatch(/transcribe|Error|stack/i)
  })

  it('maps auth transcription errors to service/setup copy, not speech copy', () => {
    const msg = mediateVoiceCaptureError(new Error('invalid_api_key'), 'transcription')
    expect(msg).toContain('בעיה בהגדרות')
    expect(msg).not.toContain('להבין את ההקלטה')
  })

  it('maps rate-limit transcription errors to service busy copy, not speech copy', () => {
    const err = new Error('too many requests')
    const msg = mediateVoiceCaptureError(err, 'transcription')
    expect(msg).toContain('עמוס')
    expect(msg).not.toContain('להבין את ההקלטה')
  })

  it('maps network transcription errors to connection copy, not speech copy', () => {
    const msg = mediateVoiceCaptureError(new Error('failed to fetch'), 'transcription')
    expect(msg).toContain('חיבור')
    expect(msg).not.toContain('להבין את ההקלטה')
  })

  it('maps quota transcription errors to service unavailable copy, not speech copy', () => {
    const msg = mediateVoiceCaptureError(new Error('quota exceeded'), 'transcription')
    expect(msg).toContain('לא זמין')
    expect(msg).not.toContain('להבין את ההקלטה')
  })

  it('maps timeout transcription errors to timeout copy, not speech copy', () => {
    const msg = mediateVoiceCaptureError(new Error('request timed out'), 'transcription')
    expect(msg).toContain('יותר מדי זמן')
    expect(msg).not.toContain('להבין את ההקלטה')
  })
})
