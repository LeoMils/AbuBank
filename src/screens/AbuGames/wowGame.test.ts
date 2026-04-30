import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

describe('AbuGames WOW — solitaire regression fix', () => {
  it('does not link to worldofsolitaire anywhere', () => {
    expect(SOURCE).not.toMatch(/worldofsolitaire/i)
  })

  it('WOW is not categorised as solitaire', () => {
    expect(SOURCE).not.toMatch(/id:\s*'wow-solitaire'/)
    expect(SOURCE).not.toMatch(/labelHe:\s*'WOW סוליטר'/)
  })

  it('WOW points to Words of Wonders (the word-building game)', () => {
    expect(SOURCE).toContain('words-of-wonders')
    expect(SOURCE).toContain("label: 'Words of Wonders'")
    expect(SOURCE).toContain("labelHe: 'מילים של פלא'")
  })

  it('WOW is in the word category, not solitaire/mahjong', () => {
    const wowBlockMatch = SOURCE.match(/const WOW_GAME[\s\S]*?\}\s*$/m)
    expect(wowBlockMatch).not.toBeNull()
    const block = wowBlockMatch![0]
    expect(block).toContain("category: 'word'")
    expect(block).not.toContain("category: 'solitaire'")
  })

  it('the type union allows "word" alongside solitaire/mahjong', () => {
    expect(SOURCE).toMatch(/category:\s*'solitaire'\s*\|\s*'mahjong'\s*\|\s*'word'/)
  })

  it('the only routing for WOW_GAME is via game.url (no hard-coded solitaire URL)', () => {
    expect(SOURCE).toMatch(/onClick=\{\(\)\s*=>\s*handleTap\(game\.url\)\}/)
    expect(SOURCE).not.toMatch(/handleTap\(['"]https:\/\/worldofsolitaire/)
  })
})
