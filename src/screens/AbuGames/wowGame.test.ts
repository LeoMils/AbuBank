import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

// ─── Functional contracts (must survive any redesign) ────────────────────────
describe('AbuGames — game catalog contracts', () => {
  it('does not link to worldofsolitaire anywhere', () => {
    expect(SOURCE).not.toMatch(/worldofsolitaire/i)
  })

  it('WOW points to Words of Wonders and shows "אבו וואו"', () => {
    expect(SOURCE).toContain('words-of-wonders')
    expect(SOURCE).toContain("labelHe: 'אבו וואו'")
  })

  it('WOW is the featured game, not solitaire', () => {
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
})

// ─── Senior-first + accessibility contracts ──────────────────────────────────
describe('AbuGames — accessibility & senior-first', () => {
  it('game tiles have aria-label', () => {
    expect(SOURCE).toContain('aria-label={g.labelHe}')
  })

  it('game tiles are role="button"', () => {
    expect(SOURCE).toContain('role="button"')
  })

  it('supports keyboard activation (Enter and Space)', () => {
    expect(SOURCE).toContain("e.key === 'Enter'")
    expect(SOURCE).toContain("e.key === ' '")
  })

  it('is right-to-left', () => {
    expect(SOURCE).toContain('dir="rtl"')
  })

  it('uses the Heebo font family', () => {
    expect(SOURCE).toContain("'Heebo'")
  })

  it('greets Martita by time of day', () => {
    expect(SOURCE).toContain('Martita')
    expect(SOURCE).toContain('getTimeGreeting')
  })

  it('featured game uses a large emoji (>= 50px)', () => {
    expect(SOURCE).toMatch(/fontSize:\s*(5[0-9]|6[0-9]|7[0-9])/)
  })

  it('opens games in the same tab (service navigation rule)', () => {
    expect(SOURCE).toContain('window.location.href = url')
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

// ─── New design language: calm spatial library ───────────────────────────────
describe('AbuGames — redesigned calm-premium library', () => {
  it('uses the new tile + hero surfaces', () => {
    expect(SOURCE).toContain('ag-tile')
    expect(SOURCE).toContain('ag-hero')
  })

  it('has ambient spatial depth (aurora glow), not a particle storm', () => {
    expect(SOURCE).toContain('ag-aurora')
  })

  it('presents games as a calm library with section headers', () => {
    expect(SOURCE).toContain('המשחקים שלך')
    expect(SOURCE).toContain('סוליטר')
    expect(SOURCE).toContain("מהג'ונג")
  })

  it('has a featured "recommended" hero', () => {
    expect(SOURCE).toContain('מומלץ')
    expect(SOURCE).toContain('להתחיל')
  })

  // Regression guards: the discarded carnival aesthetic must not return.
  it('does NOT reintroduce the old carnival design', () => {
    expect(SOURCE).not.toContain('הקרנבל')
    expect(SOURCE).not.toContain('Carnival')
    expect(SOURCE).not.toContain('👑')        // crown
    expect(SOURCE).not.toContain('cg-confetti')
    expect(SOURCE).not.toContain('cg-rainbow')
    expect(SOURCE).not.toMatch(/\bCONFETTI\b/)
  })
})
