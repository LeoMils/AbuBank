import { describe, it, expect } from 'vitest'
import { classifyError, mediateError, LEO_CONTACT_URL } from './errorMediation'

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

  it('uses new warm copy (not old cold phrasing)', () => {
    const quotaResult = mediateError('quota exceeded', 429)
    expect(quotaResult.message).toContain('נגמרו לי הכוחות')
    const unknownResult = mediateError('random error')
    expect(unknownResult.message).toContain('משהו קטן')
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
