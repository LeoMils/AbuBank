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
  it('has Hebrew carnival title', () => {
    expect(SOURCE).toContain('הקרנבל של Martita')
  })

  it('game elements have aria-label', () => {
    expect(SOURCE).toContain('aria-label={g.labelHe}')
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

  it('featured card has large emoji (>= 50px)', () => {
    expect(SOURCE).toMatch(/fontSize:\s*5[0-9]/)
  })

  it('uses Heebo font family', () => {
    expect(SOURCE).toContain("'Heebo'")
  })

  it('has Martita greeting with time emoji', () => {
    expect(SOURCE).toContain('Martita')
    expect(SOURCE).toContain('getTimeGreeting')
    expect(SOURCE).toContain('getTimeEmoji')
  })

  it('has daily joy section', () => {
    expect(SOURCE).toContain('שמחה יומית')
  })

  it('has confetti system and floating emojis', () => {
    expect(SOURCE).toContain('CONFETTI')
    expect(SOURCE).toContain('cg-confetti')
    expect(SOURCE).toContain('cg-float')
  })

  it('navigation uses handleTap with same-tab redirect', () => {
    expect(SOURCE).toContain('window.location.href = url')
  })

  it('respects prefers-reduced-motion', () => {
    expect(SOURCE).toContain('prefers-reduced-motion')
  })
})

describe('AbuGames 2026 premium design', () => {
  it('has solitaire palace with gradient icon', () => {
    expect(SOURCE).toContain("category: 'solitaire'")
    expect(SOURCE).toContain('ארמון הסוליטר')
    expect(SOURCE).toContain('klondike')
    expect(SOURCE).toContain('spider')
    expect(SOURCE).toContain('freecell')
  })

  it('has mahjong garden with gradient icon', () => {
    expect(SOURCE).toContain("category: 'mahjong'")
    expect(SOURCE).toContain("גן המהג'ונג")
    expect(SOURCE).toContain('mahjong-connect')
    expect(SOURCE).toContain('mahjong-3d')
  })

  it('mahjong has 6 game variants', () => {
    const mahjongLines = SOURCE.split('\n').filter(l => l.includes("category: 'mahjong'"))
    expect(mahjongLines.length).toBe(6)
  })

  it('has gradient mesh orbs in hero', () => {
    expect(SOURCE).toContain('cg-orb')
    expect(SOURCE).toContain('filter: \'blur(')
  })

  it('each game has gradient backdrop for emoji', () => {
    expect(SOURCE).toContain('g.gradient')
    expect(SOURCE).toContain('g.accent')
    expect(SOURCE).toContain('g.emoji')
    expect(SOURCE).toContain('g.mood')
  })

  it('has 3D spring hover on cards', () => {
    expect(SOURCE).toContain('cubic-bezier(.34,1.56,.64,1)')
    expect(SOURCE).toContain('cg-card')
  })

  it('has cinematic hero with shimmer and glow', () => {
    expect(SOURCE).toContain('cg-shimmer')
    expect(SOURCE).toContain('cg-glow')
    expect(SOURCE).toContain('cg-heroEmoji')
  })

  it('has Martita photo with animated color-cycling ring', () => {
    expect(SOURCE).toContain('👑')
    expect(SOURCE).toContain('cg-photoRing')
    expect(SOURCE).toContain('conic-gradient')
  })

  it('has vibrant gradient CTA with shine', () => {
    expect(SOURCE).toContain('יאללה Martita')
    expect(SOURCE).toContain('#FF6B35')
    expect(SOURCE).toContain('cg-ctaPulse')
  })

  it('has rainbow gradient animated title', () => {
    expect(SOURCE).toContain('cg-rainbow')
    expect(SOURCE).toContain('WebkitBackgroundClip')
  })

  it('has warm personal footer', () => {
    expect(SOURCE).toContain("Martita's Games Carnival")
    expect(SOURCE).toContain('נבנה באהבה')
  })

  it('cards have top accent gradient stripe', () => {
    expect(SOURCE).toContain('Top gradient accent stripe')
    expect(SOURCE).toContain('g.gradient')
  })

  it('has backdrop blur glass effects', () => {
    expect(SOURCE).toContain('backdropFilter')
    expect(SOURCE).toContain('WebkitBackdropFilter')
  })
})
