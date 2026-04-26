import { describe, it, expect } from 'vitest'
import {
  GOLD, CREAM, BG_DEEP, TEAL, TEXT_STRONG, TEXT_MUTED, TEXT_FAINT,
  GOLD_BORDER, SURFACE, SUCCESS, DANGER, WARNING,
} from '../design/colors'
import { GRADIENT_GOLD, GRADIENT_GOLD_BUTTON, GRADIENT_TEAL } from '../design/gradients'
import { GLASS_SURFACE, GLASS_ELEVATED } from '../design/glass'
import { FONT_DISPLAY, FONT_BODY, FONT_LABEL, SIZE_BODY, SIZE_HEADING } from '../design/typography'
import { ENTRY_DURATION, PRESS_SCALE, KEYFRAMES_SHARED } from '../design/animation'

describe('Design tokens', () => {
  it('colors are valid hex or rgba', () => {
    expect(GOLD).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(CREAM).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(BG_DEEP).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(TEAL).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(TEXT_STRONG).toMatch(/^rgba\(/)
    expect(TEXT_MUTED).toMatch(/^rgba\(/)
    expect(GOLD_BORDER).toMatch(/^rgba\(/)
    expect(SURFACE).toMatch(/^rgba\(/)
    expect(SUCCESS).toMatch(/^#/)
    expect(DANGER).toMatch(/^#/)
    expect(WARNING).toMatch(/^#/)
  })

  it('gradients are valid CSS', () => {
    expect(GRADIENT_GOLD).toContain('linear-gradient')
    expect(GRADIENT_GOLD_BUTTON).toContain('linear-gradient')
    expect(GRADIENT_TEAL).toContain('linear-gradient')
  })

  it('glass surfaces have required properties', () => {
    expect(GLASS_SURFACE.background).toBeTruthy()
    expect(GLASS_SURFACE.backdropFilter).toContain('blur')
    expect(GLASS_SURFACE.border).toBeTruthy()
    expect(GLASS_ELEVATED.boxShadow).toBeTruthy()
  })

  it('typography has required fonts', () => {
    expect(FONT_DISPLAY).toContain('Cormorant')
    expect(FONT_BODY).toContain('Heebo')
    expect(FONT_LABEL).toContain('DM Sans')
    expect(SIZE_BODY).toBe(16)
    expect(SIZE_HEADING).toBe(22)
  })

  it('animation tokens exist', () => {
    expect(ENTRY_DURATION).toBe('0.3s')
    expect(PRESS_SCALE).toBe('scale(0.95)')
  })
})

describe('Senior-safe constraints', () => {
  it('body text meets 16px minimum', () => {
    expect(SIZE_BODY).toBeGreaterThanOrEqual(16)
  })

  it('no bounce animations in shared keyframes', () => {
    expect(KEYFRAMES_SHARED).not.toContain('bounce')
  })

  it('text contrast tokens are distinguishable', () => {
    const extractOpacity = (rgba: string) => parseFloat(rgba.split(',').pop()!.replace(')', ''))
    expect(extractOpacity(TEXT_STRONG)).toBeGreaterThan(extractOpacity(TEXT_MUTED))
    expect(extractOpacity(TEXT_MUTED)).toBeGreaterThan(extractOpacity(TEXT_FAINT))
  })
})

describe('PageShell component contract', () => {
  it('source exports PageShell function', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync('/home/user/AbuBank/src/components/PageShell/index.tsx', 'utf-8')
    )
    expect(src).toContain('export function PageShell')
  })

  it('default mode uses overflow hidden', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync('/home/user/AbuBank/src/components/PageShell/index.tsx', 'utf-8')
    )
    expect(src).toContain("scrollable = false")
    expect(src).toContain("overflow: scrollable ? undefined : 'hidden'")
  })

  it('scrollable mode enables overflowY auto', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync('/home/user/AbuBank/src/components/PageShell/index.tsx', 'utf-8')
    )
    expect(src).toContain("overflowY: scrollable ? 'auto'")
    expect(src).toContain("overflowX: scrollable ? 'hidden'")
  })

  it('scrollable mode enables iOS touch scrolling', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync('/home/user/AbuBank/src/components/PageShell/index.tsx', 'utf-8')
    )
    expect(src).toContain("WebkitOverflowScrolling: scrollable ? 'touch'")
  })

  it('preserves RTL dir and safe-area padding in both modes', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync('/home/user/AbuBank/src/components/PageShell/index.tsx', 'utf-8')
    )
    expect(src).toContain("dir={dir}")
    expect(src).toContain("paddingTop: 'env(safe-area-inset-top")
    expect(src).toContain("paddingBottom: 'env(safe-area-inset-bottom")
  })

  it('accepts className prop and passes it to div', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync('/home/user/AbuBank/src/components/PageShell/index.tsx', 'utf-8')
    )
    expect(src).toContain('className?: string')
    expect(src).toContain('className={className}')
  })
})
