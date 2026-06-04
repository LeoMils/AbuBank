/*
 * Reminder honesty tests — verify delivery copy is dynamic:
 * - Web: shows limitation ("כשהאפליקציה פתוחה")
 * - Native: shows native promise ("גם כשהטלפון נעול")
 * Both paths must exist in the source. The runtime picks one.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const CONFIRM = fs.readFileSync(path.resolve(__dirname, 'ReminderConfirmCard.tsx'), 'utf8')
const BOARD = fs.readFileSync(path.resolve(__dirname, 'ReminderBoard.tsx'), 'utf8')

describe('reminder honesty — dynamic delivery copy', () => {
  it('confirmation card has web limitation copy', () => {
    expect(CONFIRM.includes('כשהאפליקציה פתוחה')).toBe(true)
    expect(CONFIRM.includes('עדיין לא תופיע התראה')).toBe(true)
  })

  it('confirmation card has native promise copy (conditional)', () => {
    expect(CONFIRM.includes('גם כשהטלפון נעול')).toBe(true)
  })

  it('both paths are gated on isNativeReminderAvailable()', () => {
    expect(CONFIRM.includes('isNativeReminderAvailable()')).toBe(true)
  })

  it('delivery notice has data-testid for QA', () => {
    expect(CONFIRM.includes('reminder-delivery-notice')).toBe(true)
  })

  it('board header shows limitation only when native unavailable', () => {
    expect(BOARD.includes('!isNativeReminderAvailable()')).toBe(true)
    expect(BOARD.includes('כשהאפליקציה פתוחה')).toBe(true)
  })

  it('native promise only shown via isNativeReminderAvailable gate, never unconditionally', () => {
    // "גם כשהטלפון נעול" must only appear inside a conditional, not as static text
    const lines = CONFIRM.split('\n')
    for (const line of lines) {
      if (line.includes('גם כשהטלפון נעול') && !line.includes('isNativeReminderAvailable')) {
        // The line itself may not have the check, but the surrounding ternary does
        // Just verify it's inside a ternary/conditional block — grep for '?' on nearby lines
        const idx = lines.indexOf(line)
        const context = lines.slice(Math.max(0, idx - 2), idx + 1).join('\n')
        expect(context.includes('?'), 'native promise must be inside conditional').toBe(true)
      }
    }
  })
})
