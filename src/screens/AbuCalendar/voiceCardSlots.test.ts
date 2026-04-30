import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { formatHebrewDateSlot } from './VoiceCard'

const SOURCE = readFileSync(resolve(__dirname, './VoiceCard.tsx'), 'utf8')

describe('VoiceCard — JUL 17 calendar icon removal', () => {
  it('does not render the emoji as a top-of-card decoration', () => {
    expect(SOURCE).not.toMatch(/<span[^>]*>\{emoji\}<\/span>/)
    expect(SOURCE).not.toMatch(/>\s*📅\s*</)
  })

  it('the only mention of 📅 is the sentinel that rejects the calendar fallback', () => {
    const occurrences = SOURCE.match(/📅/g) ?? []
    expect(occurrences).toHaveLength(1)
    expect(SOURCE).toContain("parsed.emoji !== '📅'")
  })
})

describe('VoiceCard — slot UI', () => {
  it('renders four slots: מה / מתי / איפה / הערה', () => {
    expect(SOURCE).toContain('data-testid="slot-what"')
    expect(SOURCE).toContain('data-testid="slot-when"')
    expect(SOURCE).toContain('data-testid="slot-where"')
    expect(SOURCE).toContain('data-testid="slot-note"')
    expect(SOURCE).toMatch(/>\s*מה\s*</)
    expect(SOURCE).toMatch(/>\s*מתי\s*</)
    expect(SOURCE).toMatch(/>\s*איפה\s*</)
    expect(SOURCE).toMatch(/>\s*הערה\s*</)
  })

  it('shows "חסר" for missing values', () => {
    expect(SOURCE).toContain("'חסר'")
  })

  it('does not use a native <input type="date"> (which renders "May 2026 1")', () => {
    expect(SOURCE).not.toMatch(/type="date"/)
    expect(SOURCE).not.toMatch(/type='date'/)
  })

  it('does not use a native <input type="time">', () => {
    expect(SOURCE).not.toMatch(/type="time"/)
  })
})

describe('VoiceCard — debug block', () => {
  it('only renders in dev mode', () => {
    expect(SOURCE).toContain('import.meta')
    expect(SOURCE).toContain('DEV')
    expect(SOURCE).toContain('data-testid="voice-debug"')
  })

  it('displays raw transcript and parsed slots', () => {
    expect(SOURCE).toMatch(/raw:.*rawTranscript/)
    expect(SOURCE).toMatch(/title:.*parsed\.title/)
    expect(SOURCE).toMatch(/date:.*parsed\.date/)
    expect(SOURCE).toMatch(/time:.*parsed\.time/)
    expect(SOURCE).toMatch(/location:.*parsed\.location/)
    expect(SOURCE).toMatch(/notes:.*parsed\.notes/)
    expect(SOURCE).toContain('confidence:')
  })
})

describe('formatHebrewDateSlot', () => {
  const TODAY = '2026-04-30'

  it('today → היום', () => {
    expect(formatHebrewDateSlot('2026-04-30', TODAY)).toBe('היום')
  })

  it('tomorrow → מחר', () => {
    expect(formatHebrewDateSlot('2026-05-01', TODAY)).toBe('מחר')
  })

  it('day after tomorrow → מחרתיים', () => {
    expect(formatHebrewDateSlot('2026-05-02', TODAY)).toBe('מחרתיים')
  })

  it('further out → "1 במאי 2026" Hebrew form, not "May 2026 1"', () => {
    const out = formatHebrewDateSlot('2026-05-15', TODAY)
    expect(out).toBe('15 במאי 2026')
    expect(out).not.toContain('May')
  })

  it('null/missing → חסר', () => {
    expect(formatHebrewDateSlot(null, TODAY)).toBe('חסר')
    expect(formatHebrewDateSlot('', TODAY)).toBe('חסר')
  })
})
