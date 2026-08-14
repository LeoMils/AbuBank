import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const VOICE_CARD = readFileSync(resolve(__dirname, './VoiceCard.tsx'), 'utf8')
const INDEX = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

describe('P02 — Voice confirmation persistence contract', () => {
  it('VoiceCard header shows "תיקון" label in editing/error mode (confirmation mode uses ConfirmCard "הבנתי")', () => {
    // In confirmation mode ConfirmCard owns the UI including the "הבנתי" heading.
    // VoiceCard's own header is visible only in editing or error mode.
    expect(VOICE_CARD).toContain('תיקון')
    // ConfirmCard (shared surface) provides the "הבנתי" heading.
    expect(VOICE_CARD).toContain("import { ConfirmCard } from './ConfirmCard'")
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

describe('P02 — VoiceCard is a retained confirm component (post D7)', () => {
  // D7 · one voice engine: the calendar no longer wires an in-screen record →
  // confirm loop; the mic routes to Abu AI, which owns confirm/retry/persist on
  // the SAME store. VoiceCard remains a self-contained, tested component (its
  // button/label/retry contract is asserted in the block above). This pins the
  // removal of the in-screen retry/record wiring so a second engine cannot return.
  it('the calendar screen no longer owns a record/retry loop', () => {
    expect(INDEX).not.toContain('handleVoiceRetry')
    expect(INDEX).not.toContain('handleVoiceRecord')
    expect(INDEX).toContain('setScreen(Screen.AbuAI)')
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
    // Post D7 the calendar screen surfaces no raw voice-capture errors at all —
    // the mic routes to Abu AI, which owns its own honest error UI. The retained
    // VoiceCard translates via its 'לא הצלחתי להבין' copy (asserted above).
    expect(INDEX).not.toMatch(/setVoiceError\([^)]*Error\(/)
    expect(VOICE_CARD).toContain('לא הצלחתי להבין')
  })
})
