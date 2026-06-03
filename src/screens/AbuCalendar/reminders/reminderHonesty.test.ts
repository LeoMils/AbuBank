/*
 * Reminder honesty tests — verify the limitation copy is present
 * in every user-facing surface so no 80+ user believes reminders
 * work when the phone is locked.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const CONFIRM = fs.readFileSync(path.resolve(__dirname, 'ReminderConfirmCard.tsx'), 'utf8')
const BOARD = fs.readFileSync(path.resolve(__dirname, 'ReminderBoard.tsx'), 'utf8')
const INDEX = fs.readFileSync(path.resolve(__dirname, '..', 'index.tsx'), 'utf8')

describe('reminder honesty — limitation copy exists', () => {
  it('confirmation card subtitle says "כשהאפליקציה פתוחה"', () => {
    expect(CONFIRM.includes('אני אזכור בשבילך — כשהאפליקציה פתוחה')).toBe(true)
  })

  it('confirmation card delivery notice explains locked-phone limitation', () => {
    expect(CONFIRM.includes('התזכורת תופיע כשהאפליקציה פתוחה על המסך')).toBe(true)
    expect(CONFIRM.includes('כשהטלפון נעול או האפליקציה סגורה — עדיין לא תופיע התראה')).toBe(true)
  })

  it('delivery notice has data-testid for QA', () => {
    expect(CONFIRM.includes('reminder-delivery-notice')).toBe(true)
  })

  it('reminder board header includes "כשהאפליקציה פתוחה"', () => {
    expect(BOARD.includes('כשהאפליקציה פתוחה')).toBe(true)
  })

  it('success toast includes "(כשהאפליקציה פתוחה)"', () => {
    expect(INDEX.includes('(כשהאפליקציה פתוחה)')).toBe(true)
  })

  it('no user-facing surface claims locked-phone delivery', () => {
    // None of these strings should appear in user-facing code
    for (const forbidden of ['גם כשהטלפון נעול', 'תמיד תקבלי התראה', 'התראה אמינה']) {
      expect(CONFIRM.includes(forbidden), `ConfirmCard has "${forbidden}"`).toBe(false)
      expect(BOARD.includes(forbidden), `Board has "${forbidden}"`).toBe(false)
      expect(INDEX.includes(forbidden), `index has "${forbidden}"`).toBe(false)
    }
  })
})
