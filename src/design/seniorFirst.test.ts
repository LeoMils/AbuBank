/*
 * seniorFirst.test.ts — the senior-first gate (M4). Verifies BOTH themes meet the
 * minimums every screen inherits through the tokens + shared components:
 *   • body/primary text ≥ WCAG AA 4.5:1 on the worst-case background
 *   • secondary text ≥ 3:1
 *   • touch target ≥ 56px, body text ≥ 16px (the shared constants)
 * Because every screen uses these tokens/components, this is a per-screen guarantee.
 */
import { describe, it, expect } from 'vitest'
import { THEME_PALETTE } from './theme'
import { hexToRgb, blendOver, contrastRatio } from './contrast'
import { MIN_TOUCH, MIN_BODY_PX } from './space'

const ratioOn = (bgHex: string, text: { hex: string; alpha: number }) =>
  contrastRatio(blendOver(hexToRgb(text.hex), text.alpha, hexToRgb(bgHex)), hexToRgb(bgHex))

describe('senior-first contrast — BOTH themes', () => {
  for (const theme of ['night', 'day'] as const) {
    const p = THEME_PALETTE[theme]
    it(`${theme}: strong + body text ≥ AA 4.5:1 on the worst-case background`, () => {
      expect(ratioOn(p.bg, p.textStrong)).toBeGreaterThanOrEqual(4.5)
      expect(ratioOn(p.bg, p.textMedium)).toBeGreaterThanOrEqual(4.5)
    })
    it(`${theme}: muted/secondary text ≥ 3:1`, () => {
      expect(ratioOn(p.bg, p.textMuted)).toBeGreaterThanOrEqual(3)
    })
  }
})

describe('senior-first sizing — the shared minimums every screen uses', () => {
  it('touch targets ≥ 56px, body text ≥ 16px', () => {
    expect(MIN_TOUCH).toBeGreaterThanOrEqual(56)
    expect(MIN_BODY_PX).toBeGreaterThanOrEqual(16)
  })
})
