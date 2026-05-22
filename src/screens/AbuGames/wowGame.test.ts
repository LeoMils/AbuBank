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

  it('WOW points to Words of Wonders (the word-building game) and is shown as "אבו וואו"', () => {
    expect(SOURCE).toContain('words-of-wonders')
    expect(SOURCE).toContain("labelHe: 'אבו וואו'")
    expect(SOURCE).not.toContain("labelHe: 'מילים של פלא'")
    expect(SOURCE).not.toContain("labelHe: 'WOW סוליטר'")
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

describe('AbuGames senior-first UX contracts', () => {
  it('has Hebrew title text "בואי נשחק"', () => {
    expect(SOURCE).toContain('בואי נשחק')
  })

  it('game cards have aria-label using Hebrew labels', () => {
    expect(SOURCE).toContain('aria-label={game.labelHe}')
  })

  it('game cards have role="button" for accessibility', () => {
    expect(SOURCE).toContain('role="button"')
  })

  it('game cards have keyboard support (Enter and Space)', () => {
    expect(SOURCE).toContain("e.key === 'Enter'")
    expect(SOURCE).toContain("e.key === ' '")
  })

  it('uses RTL direction for Hebrew content', () => {
    expect(SOURCE).toContain("direction: 'rtl'")
  })

  it('respects prefers-reduced-motion via injected CSS', () => {
    expect(SOURCE).toContain('prefers-reduced-motion: reduce')
    expect(SOURCE).toContain('animation-duration: 0s !important')
  })

  it('game card min-height is at least 44px (touch target)', () => {
    const minHeightMatch = SOURCE.match(/minHeight:\s*(\d+)/)
    expect(minHeightMatch).not.toBeNull()
    expect(Number(minHeightMatch![1])).toBeGreaterThanOrEqual(44)
  })

  it('uses design system color tokens (not raw hex for primary text)', () => {
    expect(SOURCE).toContain('TEXT_STRONG')
    expect(SOURCE).toContain('TEXT_MUTED')
    expect(SOURCE).toContain('GOLD_BORDER')
  })

  it('does not import from AbuCalendar, AbuAI, or AbuWhatsApp', () => {
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuCalendar/)
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuAI/)
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuWhatsApp/)
  })

  it('does not reference semanticIntent or voiceAutoCreate', () => {
    expect(SOURCE).not.toMatch(/semanticIntent/i)
    expect(SOURCE).not.toMatch(/voiceAutoCreate/i)
  })

  it('uses FONT_BODY (Heebo) for Hebrew text', () => {
    expect(SOURCE).toContain('FONT_BODY')
  })

  it('featured card emoji is large enough (>= 36px)', () => {
    // Featured card emoji should be significantly larger
    const featuredEmoji = SOURCE.match(/fontSize:\s*(\d+),\s*lineHeight:\s*1\s*\}\}>\{game\.emoji\}/g)
    expect(featuredEmoji).not.toBeNull()
  })
})
