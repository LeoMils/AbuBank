import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT, FEW_SHOT, VOICE_SUFFIX, getSupportedMimeType } from './service'
import { GOLD, BG, SURFACE, TEXT, TEXT_MUTED } from './constants'

describe('SYSTEM_PROMPT', () => {
  it('is exported and non-empty', () => {
    expect(SYSTEM_PROMPT).toBeTruthy()
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100)
  })

  it('contains Martita identity', () => {
    expect(SYSTEM_PROMPT).toContain('Martita')
  })

  it('contains family members', () => {
    expect(SYSTEM_PROMPT).toContain('Mor')
    expect(SYSTEM_PROMPT).toContain('Leo')
    expect(SYSTEM_PROMPT).toContain('Pepe')
  })

  it('contains safety rules', () => {
    expect(SYSTEM_PROMPT).toContain('בטיחות')
  })

  it('uses feminine Hebrew address', () => {
    expect(SYSTEM_PROMPT).toContain('את ')
  })
})

describe('FEW_SHOT', () => {
  it('is exported and has examples', () => {
    expect(FEW_SHOT).toBeTruthy()
    expect(FEW_SHOT.length).toBeGreaterThanOrEqual(6)
  })

  it('alternates user/assistant roles', () => {
    for (let i = 0; i < FEW_SHOT.length; i++) {
      const expected = i % 2 === 0 ? 'user' : 'assistant'
      expect(FEW_SHOT[i]?.role).toBe(expected)
    }
  })

  it('includes Spanish example', () => {
    const hasSpanish = FEW_SHOT.some(m => /[áéíóú]/.test(m.content))
    expect(hasSpanish).toBe(true)
  })
})

describe('VOICE_SUFFIX', () => {
  it('is exported and non-empty', () => {
    expect(VOICE_SUFFIX).toBeTruthy()
    expect(VOICE_SUFFIX.length).toBeGreaterThan(20)
  })

  it('contains voice mode instructions', () => {
    expect(VOICE_SUFFIX).toContain('קול')
  })
})

describe('getSupportedMimeType', () => {
  it('returns a string (may be empty if no MediaRecorder)', () => {
    const result = getSupportedMimeType()
    expect(typeof result).toBe('string')
  })
})

describe('AbuAI constants', () => {
  it('GOLD is a valid hex color', () => {
    expect(GOLD).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('BG is the navy background', () => {
    expect(BG).toBe('#050A18')
  })

  it('SURFACE is an rgba value', () => {
    expect(SURFACE).toMatch(/^rgba\(/)
  })

  it('TEXT is a valid hex color', () => {
    expect(TEXT).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('TEXT_MUTED is an rgba value', () => {
    expect(TEXT_MUTED).toMatch(/^rgba\(/)
  })
})

describe('FEW_SHOT content quality', () => {
  it('loneliness response is empathetic, not dismissive', () => {
    const lonelyQ = FEW_SHOT.findIndex(m => m.content.includes('בודדה'))
    expect(lonelyQ).toBeGreaterThan(-1)
    const response = FEW_SHOT[lonelyQ + 1]
    expect(response?.content).not.toContain('טיפ')
    expect(response?.content).toContain('כאן')
  })

  it('no patronizing phrases in any response', () => {
    const bad = ['יופי של שאלה', 'כל הכבוד', 'מצוין!']
    for (const msg of FEW_SHOT) {
      if (msg.role === 'assistant') {
        for (const phrase of bad) {
          expect(msg.content).not.toContain(phrase)
        }
      }
    }
  })
})
