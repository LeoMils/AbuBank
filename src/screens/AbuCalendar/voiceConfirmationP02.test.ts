import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const VOICE_CARD = readFileSync(resolve(__dirname, './VoiceCard.tsx'), 'utf8')
const INDEX = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

describe('P02 — Voice confirmation persistence contract', () => {
  it('VoiceCard header shows "הבנתי ממך ש..." for parsed state', () => {
    expect(VOICE_CARD).toContain('הבנתי ממך ש...')
  })

  it('VoiceCard header shows error text for error state', () => {
    expect(VOICE_CARD).toContain('לא הצלחתי להבין')
  })

  it('VoiceCard has a save button labeled "שמירה"', () => {
    expect(VOICE_CARD).toContain('voice-save-btn')
    expect(VOICE_CARD).toContain('שמירה')
  })

  it('VoiceCard has a cancel button labeled "ביטול"', () => {
    expect(VOICE_CARD).toContain('voice-cancel-btn')
    expect(VOICE_CARD).toContain('ביטול')
  })

  it('VoiceCard has a retry button labeled "נסי שוב"', () => {
    expect(VOICE_CARD).toContain('voice-retry-btn')
    expect(VOICE_CARD).toContain('נסי שוב')
  })

  it('VoiceCard accepts onRetry prop', () => {
    expect(VOICE_CARD).toContain('onRetry')
  })

  it('VoiceCard has a correction mic button labeled "תקני בדיבור"', () => {
    expect(VOICE_CARD).toContain('תקני בדיבור')
  })

  it('VoiceCard has data-testid for header element', () => {
    expect(VOICE_CARD).toContain('voice-card-header')
  })
})

describe('P02 — Voice result persistence in parent wiring', () => {
  it('parent passes onRetry={handleVoiceRetry} to VoiceCard', () => {
    expect(INDEX).toContain('onRetry={handleVoiceRetry}')
  })

  it('handleVoiceRetry resets voice state and re-records', () => {
    expect(INDEX).toContain('function handleVoiceRetry()')
    expect(INDEX).toMatch(/handleVoiceRetry[\s\S]*?setVoiceParsed\(null\)/)
    expect(INDEX).toMatch(/handleVoiceRetry[\s\S]*?handleVoiceRecord\(\)/)
  })

  it('failed_to_understand shows VoiceCard (sets voiceParsed)', () => {
    expect(INDEX).toMatch(/failed_to_understand[\s\S]*?setVoiceParsed\(/)
  })

  it('failed_to_save shows VoiceCard (sets voiceParsed)', () => {
    expect(INDEX).toMatch(/failed_to_save[\s\S]*?setVoiceParsed\(/)
  })
})

describe('P02 — No unrelated module contamination', () => {
  it('VoiceCard does not import AbuWhatsApp', () => {
    expect(VOICE_CARD).not.toContain('AbuWhatsApp')
  })

  it('VoiceCard does not import AbuGames', () => {
    expect(VOICE_CARD).not.toContain('AbuGames')
  })

  it('index does not modify semanticIntent module', () => {
    // semanticIntent is not imported or mutated by calendar index
    const semanticImports = INDEX.match(/from\s+['"].*semanticIntent['"]/g)
    expect(semanticImports).toBeNull()
  })

  it('no new external API or dependency added beyond react', () => {
    // VoiceCard only imports from local modules and react — no new npm packages
    const imports = VOICE_CARD.match(/from\s+['"]([^'"]+)['"]/g) ?? []
    const external = imports.filter(i => !i.includes("'.'") && !i.includes("'..")
      && !i.includes("'react'") && !i.includes('"react"')
      && !i.includes("'./") && !i.includes('"./') && !i.includes("'../") && !i.includes('"../')
    )
    expect(external).toHaveLength(0)
  })

  it('raw technical error text is not shown to user (errors are translated)', () => {
    // All error paths go through setVoiceFailure which sets Hebrew messages
    expect(INDEX).not.toMatch(/setVoiceError\([^)]*Error\(/)
    // Verify setVoiceFailure always sets voiceError
    expect(INDEX).toMatch(/function setVoiceFailure[\s\S]*?setVoiceError\(message\)/)
  })
})
