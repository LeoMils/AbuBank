/*
 * Diagnostics are OPERATOR-ONLY. The Product Truth panel + Copy Diagnostics /
 * Copy Product Truth Report show English engineering text and must never appear
 * to Martita — only for Leo (dev, or the preview via ?operator=1). The user-facing
 * "ניקוי שיחה" (clear chat) button must stay reachable for her.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('AbuAI diagnostics — operator-gated, hidden from Martita', () => {
  it('an operator gate exists (dev OR ?operator=1)', () => {
    expect(SRC).toMatch(/function isOperatorView\(\)/)
    expect(SRC).toMatch(/operator'\)\s*===\s*'1'/)
    expect(SRC).toMatch(/import\.meta\.env\.DEV/)
  })

  it('the Product Truth panel is behind isOperatorView()', () => {
    expect(SRC).toMatch(/isOperatorView\(\)\s*&&\s*\(\(\)\s*=>\s*\{[\s\S]{0,120}getProductTruth/)
  })

  it('the Copy buttons (Diagnostics / Product Truth Report) are behind isOperatorView()', () => {
    // The gated fragment opens before Copy Diagnostics and both copy labels follow it.
    const gateIdx = SRC.indexOf('isOperatorView() && (<>')
    const copyDiag = SRC.indexOf('📋 Copy Diagnostics')
    const copyTruth = SRC.indexOf('📋 Copy Product Truth Report')
    expect(gateIdx).toBeGreaterThan(0)
    expect(copyDiag).toBeGreaterThan(gateIdx)
    expect(copyTruth).toBeGreaterThan(gateIdx)
  })

  it('the user-facing "ניקוי שיחה" (clear chat) button is NOT gated', () => {
    // It appears before the operator fragment opens → always reachable by Martita.
    const clear = SRC.indexOf('ניקוי שיחה')
    const gateIdx = SRC.indexOf('isOperatorView() && (<>')
    expect(clear).toBeGreaterThan(0)
    expect(clear).toBeLessThan(gateIdx)
  })
})
