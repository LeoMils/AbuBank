import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT, FEW_SHOT, VOICE_SUFFIX } from './service'

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
