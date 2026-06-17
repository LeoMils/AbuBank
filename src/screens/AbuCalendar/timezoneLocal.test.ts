/*
 * Timezone locality tests — prove that date/time functions use local
 * time, not UTC. Critical for Israel (UTC+3) where midnight–02:59 local
 * is still the previous UTC day.
 *
 * Strategy: source-grep for banned patterns (toISOString in date/dueAt
 * paths) + runtime assertions on the actual helper functions.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getTodayStr } from './constants'

const CONSTANTS_SRC = fs.readFileSync(path.resolve(__dirname, 'constants.ts'), 'utf8')
const BOARD_SRC = fs.readFileSync(path.resolve(__dirname, 'reminders', 'ReminderBoard.tsx'), 'utf8')
const INDEX_SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

afterEach(() => { vi.useRealTimers() })

// ─── 1. getTodayStr ─────────────────────────────────────────────────
describe('getTodayStr — local date, not UTC', () => {
  it('source does NOT use toISOString', () => {
    const start = CONSTANTS_SRC.indexOf('export function getTodayStr')
    // Find the closing brace by counting — the function is short (4 lines)
    const fn = CONSTANTS_SRC.slice(start, start + 200)
    expect(fn.includes('toISOString')).toBe(false)
    expect(fn.includes('getFullYear')).toBe(true)
    expect(fn.includes('getMonth')).toBe(true)
    expect(fn.includes('getDate')).toBe(true)
  })

  it('returns local date at 01:00 Israel time (UTC+3 → UTC is previous day)', () => {
    // Simulate 2026-06-06 01:00 Israel (= 2026-06-05 22:00 UTC)
    // getFullYear/getMonth/getDate return LOCAL values based on system TZ.
    // We can't change TZ in vitest, but we CAN verify the function uses
    // getFullYear (local) not toISOString (UTC) via the source grep above.
    // Runtime: just verify format is YYYY-MM-DD and matches Date's local date.
    vi.useFakeTimers()
    const fakeNow = new Date(2026, 5, 6, 1, 0, 0) // June 6, 01:00 local
    vi.setSystemTime(fakeNow)
    const result = getTodayStr()
    expect(result).toBe('2026-06-06')
    // If it used toISOString, the result would depend on TZ offset.
    // Since we set the fake time as LOCAL June 6, local methods return June 6.
  })

  it('returns correct format YYYY-MM-DD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0)) // Jan 1 midnight local
    expect(getTodayStr()).toBe('2026-01-01')

    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59)) // Dec 31 23:59 local
    expect(getTodayStr()).toBe('2026-12-31')
  })
})

// ─── 2. ReminderBoard today section ─────────────────────────────────
describe('ReminderBoard — today section uses local date', () => {
  it('buildSections does NOT use toISOString for today variable', () => {
    const fnStart = BOARD_SRC.indexOf('function buildSections')
    const fnEnd = BOARD_SRC.indexOf('\n}', fnStart) + 2
    const fn = BOARD_SRC.slice(fnStart, fnEnd)
    expect(fn.includes('toISOString')).toBe(false)
    expect(fn.includes('getFullYear()')).toBe(true)
    expect(fn.includes('getMonth()')).toBe(true)
    expect(fn.includes('getDate()')).toBe(true)
  })
})

// ─── 3. Reschedule +1h creates local ISO without Z ──────────────────
describe('ReminderBoard — reschedule +1h uses local ISO', () => {
  it('onReschedule does NOT use toISOString for dueAt', () => {
    const reschedSection = BOARD_SRC.slice(BOARD_SRC.indexOf('onReschedule'))
    const block = reschedSection.slice(0, reschedSection.indexOf('refresh()'))
    expect(block.includes('toISOString')).toBe(false)
    expect(block.includes('getFullYear()')).toBe(true)
    expect(block.includes('getHours()')).toBe(true)
  })

  it('reschedule dueAt format has no Z suffix (local, not UTC)', () => {
    // The pattern: `${d.getFullYear()}-...T...:00` — no Z at end
    const reschedSection = BOARD_SRC.slice(BOARD_SRC.indexOf('onReschedule'))
    const block = reschedSection.slice(0, reschedSection.indexOf('refresh()'))
    // Must end with :00` (local) not .000Z` (UTC)
    expect(block.includes(":00`")).toBe(true)
    expect(block.includes(".000Z")).toBe(false)
  })
})

// ─── 4. Reminder fallback dueAt creates local ISO without Z ─────────
describe('handleReminderConfirm — fallback dueAt uses local ISO', () => {
  it('fallback dueAt does NOT use toISOString', () => {
    // Find the handleReminderConfirm function in index.tsx
    const fnStart = INDEX_SRC.indexOf('function handleReminderConfirm')
    const fnEnd = INDEX_SRC.indexOf('\n  }', fnStart) + 4
    const fn = INDEX_SRC.slice(fnStart, fnEnd)
    // The fallback `draft.dueAt ?? ...` must use local format
    expect(fn.includes('toISOString')).toBe(false)
    expect(fn.includes('getFullYear()')).toBe(true)
  })
})

// ─── 5. Quick-pick time resolver uses local ISO ─────────────────────
describe('onResolveTime — quick-pick buttons use local ISO', () => {
  it('toLocalISO helper defined and used instead of toISOString', () => {
    const resolveSection = INDEX_SRC.slice(INDEX_SRC.indexOf('const toLocalISO'))
    const block = resolveSection.slice(0, resolveSection.indexOf('setReminderDraft(updated)'))
    // toLocalISO must be the function used for all dueAt assignments
    expect(block.includes('toLocalISO(d)')).toBe(true)
    // No toISOString in this block
    const dueAtAssignments = block.split('dueAt = ')
    for (let i = 1; i < dueAtAssignments.length; i++) {
      const assignment = dueAtAssignments[i]!.slice(0, 50)
      expect(assignment.includes('toISOString'), `dueAt assignment #${i} uses toISOString`).toBe(false)
    }
  })
})

// ─── 6. ReminderConfirmCard correction uses local ISO ────────────────
describe('ReminderConfirmCard — correction mode uses local ISO', () => {
  it('corrected.dueAt does NOT use toISOString', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'reminders', 'ReminderConfirmCard.tsx'), 'utf8')
    const fnStart = src.indexOf('corrected.dueAt')
    const line = src.slice(fnStart, src.indexOf('\n', fnStart))
    expect(line.includes('toISOString')).toBe(false)
    expect(line.includes('getFullYear()')).toBe(true)
  })
})
