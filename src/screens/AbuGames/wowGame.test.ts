import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

describe('AbuGames WOW — core contracts', () => {
  it('does not link to worldofsolitaire anywhere', () => {
    expect(SOURCE).not.toMatch(/worldofsolitaire/i)
  })

  it('WOW points to Words of Wonders and shows "אבו וואו"', () => {
    expect(SOURCE).toContain('words-of-wonders')
    expect(SOURCE).toContain("labelHe: 'אבו וואו'")
  })

  it('WOW is in featured category, not solitaire', () => {
    const wowLine = SOURCE.split('\n').find(l => l.includes("id: 'wow'"))
    expect(wowLine).toBeDefined()
    expect(wowLine).toContain("category: 'featured'")
    expect(wowLine).not.toContain("category: 'solitaire'")
  })
})

describe('AbuGames senior-first UX contracts', () => {
  it('has Hebrew title "בואי נשחק"', () => {
    expect(SOURCE).toContain('בואי נשחק')
  })

  it('game elements have aria-label using Hebrew labels', () => {
    expect(SOURCE).toContain('aria-label={game.labelHe}')
  })

  it('game elements have role="button"', () => {
    expect(SOURCE).toContain('role="button"')
  })

  it('keyboard support (Enter and Space)', () => {
    expect(SOURCE).toContain("e.key === 'Enter'")
    expect(SOURCE).toContain("e.key === ' '")
  })

  it('uses RTL direction', () => {
    expect(SOURCE).toContain("direction: 'rtl'")
  })

  it('does not import from AbuCalendar, AbuAI, or AbuWhatsApp', () => {
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuCalendar/)
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuAI/)
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuWhatsApp/)
  })

  it('featured card has large emoji (>= 40px)', () => {
    expect(SOURCE).toMatch(/fontSize:\s*4[0-9]/)
  })

  it('uses Heebo font family', () => {
    expect(SOURCE).toContain("'Heebo'")
  })

  it('has Martita greeting', () => {
    expect(SOURCE).toContain('Martita')
    expect(SOURCE).toContain('getTimeGreeting')
  })

  it('has MartitAI tip card', () => {
    expect(SOURCE).toContain('MartitAI אומרת')
  })

  it('has atmospheric stars and floating elements', () => {
    expect(SOURCE).toContain('STARS')
    expect(SOURCE).toContain('FLOATING_EMOJIS')
    expect(SOURCE).toContain('gStar')
    expect(SOURCE).toContain('gFloat')
  })

  it('navigation uses handleTap with same-tab redirect', () => {
    expect(SOURCE).toContain('window.location.href = url')
  })

  it('respects prefers-reduced-motion', () => {
    expect(SOURCE).toContain('prefers-reduced-motion')
  })
})

describe('AbuGames carnival — game categories', () => {
  it('has solitaire category with multiple games', () => {
    expect(SOURCE).toContain("category: 'solitaire'")
    expect(SOURCE).toContain('סוליטר')
    expect(SOURCE).toContain('klondike')
    expect(SOURCE).toContain('spider')
    expect(SOURCE).toContain('freecell')
  })

  it('has mahjong category', () => {
    expect(SOURCE).toContain("category: 'mahjong'")
    expect(SOURCE).toContain("מהג'ונג")
    expect(SOURCE).toContain('mahjong-connect')
    expect(SOURCE).toContain('mahjong-3d')
  })

  it('has featured hero card with shimmer and glow', () => {
    expect(SOURCE).toContain('FeaturedHero')
    expect(SOURCE).toContain('gShimmer')
    expect(SOURCE).toContain('gPulse')
  })

  it('has game bubble cards with accent colors', () => {
    expect(SOURCE).toContain('GameBubble')
    expect(SOURCE).toContain('game.accent')
  })
})
