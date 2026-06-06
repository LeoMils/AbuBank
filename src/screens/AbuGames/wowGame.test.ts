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
    // Find the WOW entry in GAMES array
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

  it('has animated floating pieces overlay', () => {
    expect(SOURCE).toContain('FloatingPiecesOverlay')
    expect(SOURCE).toContain('gamesFloat')
  })

  it('navigation uses handleTap with same-tab redirect', () => {
    expect(SOURCE).toContain('window.location.href = url')
  })
})
