import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

// ─── Functional contracts (must survive any redesign) ────────────────────────
describe('AbuGames — game catalog & navigation', () => {
  it('does not link to worldofsolitaire anywhere', () => {
    expect(SOURCE).not.toMatch(/worldofsolitaire/i)
  })

  it('WOW points to Words of Wonders and shows "אבו וואו"', () => {
    expect(SOURCE).toContain('words-of-wonders')
    expect(SOURCE).toContain("labelHe: 'אבו וואו'")
  })

  it('WOW is the featured (favorite) game, not solitaire', () => {
    const wowLine = SOURCE.split('\n').find(l => l.includes("id: 'wow'"))
    expect(wowLine).toBeDefined()
    expect(wowLine).toContain("category: 'featured'")
    expect(wowLine).not.toContain("category: 'solitaire'")
  })

  it('keeps the solitaire catalog', () => {
    expect(SOURCE).toContain("category: 'solitaire'")
    expect(SOURCE).toContain('klondike')
    expect(SOURCE).toContain('spider')
    expect(SOURCE).toContain('freecell')
  })

  it('keeps the mahjong catalog with 6 variants', () => {
    expect(SOURCE).toContain("category: 'mahjong'")
    expect(SOURCE).toContain('mahjong-connect')
    expect(SOURCE).toContain('mahjong-3d')
    const mahjongLines = SOURCE.split('\n').filter(l => l.includes("category: 'mahjong'"))
    expect(mahjongLines.length).toBe(6)
  })

  it('opens games in the same tab (service navigation rule)', () => {
    expect(SOURCE).toContain('window.location.href = url')
  })
})

// ─── Accessibility & senior-first ────────────────────────────────────────────
describe('AbuGames — accessibility & senior-first', () => {
  it('bubbles have aria-label', () => {
    expect(SOURCE).toContain('aria-label={g.labelHe}')
  })
  it('bubbles are role="button"', () => {
    expect(SOURCE).toContain('role="button"')
  })
  it('supports keyboard activation (Enter and Space)', () => {
    expect(SOURCE).toContain("e.key === 'Enter'")
    expect(SOURCE).toContain("e.key === ' '")
  })
  it('page is right-to-left', () => {
    expect(SOURCE).toContain('dir="rtl"')
  })
  it('uses the Heebo font family', () => {
    expect(SOURCE).toContain("'Heebo'")
  })
  it('respects prefers-reduced-motion', () => {
    expect(SOURCE).toContain('prefers-reduced-motion')
  })
  it('does not import from AbuCalendar, AbuAI, or AbuWhatsApp', () => {
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuCalendar/)
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuAI/)
    expect(SOURCE).not.toMatch(/from\s+['"].*AbuWhatsApp/)
  })
})

// ─── New direction: round bubbles matching Abu Bank Home ──────────────────────
describe('AbuGames — Home-matching bubble design', () => {
  it('renders games as round bubbles (borderRadius 50%), not rectangular cards', () => {
    expect(SOURCE).toContain("borderRadius: '50%'")
  })

  it('reuses the Home glossy water-drop sphere recipe', () => {
    // Volumetric sphere built from the per-game accent + the signature speculars.
    expect(SOURCE).toContain('radial-gradient(circle at 38% 32%')
    expect(SOURCE).toContain('radial-gradient(ellipse at 28% 22%')
  })

  it('shows a large premium English "Abu Games" wordmark', () => {
    expect(SOURCE).toContain('Abu Games')
    expect(SOURCE).toMatch(/fontSize:\s*4[0-9]/)        // large logo
    expect(SOURCE).toContain('WebkitBackgroundClip')     // metallic gradient text
  })

  it('carries the Abu Bank visual identity', () => {
    expect(SOURCE).toContain('ABU BANK')
  })

  it('greets Martita time-aware with a heart (not childish titles)', () => {
    expect(SOURCE).toContain('getTimeGreeting')
    expect(SOURCE).toContain('Martita')
    expect(SOURCE).toContain('💛')
    expect(SOURCE).toContain('בוקר טוב')
    expect(SOURCE).toContain('צהריים טובים')
    expect(SOURCE).toContain('ערב טוב')
  })

  it('presents WOW as the favorite, larger than the rest', () => {
    expect(SOURCE).toContain('האהוב שלך')
    expect(SOURCE).toMatch(/size=\{13[0-9]\}/) // featured ~132px vs grid 92px
  })

  it('lays games in a vertical bubble grid (no horizontal-scroll dependency)', () => {
    expect(SOURCE).toContain("gridTemplateColumns: 'repeat(3, 1fr)'")
    expect(SOURCE).not.toContain('overflowX: \'auto\'')
  })

  // Regression guards: discarded looks must not return.
  it('does NOT contain the carnival aesthetic or the removed greetings', () => {
    expect(SOURCE).not.toContain('Carnival')
    expect(SOURCE).not.toContain('הקרנבל')
    expect(SOURCE).not.toContain('המשחקים שלך')
    expect(SOURCE).not.toContain('המשחקים של Martita')
    expect(SOURCE).not.toContain('👑')
    expect(SOURCE).not.toContain('cg-confetti')
    expect(SOURCE).not.toContain('cg-rainbow')
  })
})
