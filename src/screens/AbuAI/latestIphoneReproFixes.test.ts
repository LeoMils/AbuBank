/**
 * Regression locks for failures reproduced on the DEPLOYED runtime (multi-turn
 * iPhone repro, docs/eval/LATEST_REAL_IPHONE_FAILURE_ANALYSIS.md).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shapeCreateConfirm, locPhrase } from './responseShaper'
import { tryGroundedAnswer } from './service'

beforeEach(() => { const s: Record<string, string> = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} }) })

describe('family: ex-spouse is never mislabelled a grandchild', () => {
  it('"מי זה רפי" → ex of Mor, not "הנכד שלך"', () => {
    const a = tryGroundedAnswer('מי זה רפי') ?? ''
    expect(a).toMatch(/גרוש|מור/)
    expect(a).not.toContain('הנכד שלך')
  })
})

describe('calendar readback grammar', () => {
  it('location with a preposition is not double-prefixed', () => {
    expect(locPhrase('אצלי בבית')).toBe('אצלי בבית')
    expect(locPhrase('בבית')).toBe('בבית')
    expect(locPhrase('הוד השרון')).toBe('בהוד השרון')
    expect(locPhrase('קפה נורדאו')).toBe('בקפה נורדאו')
  })
  it('no "באצלי בבית", no redundant "בנושא פגישה"', () => {
    const s = shapeCreateConfirm({ title: 'פגישה עם אורית', date: '2026-06-24', time: '20:00', location: 'אצלי בבית', subject: 'פגישה', emoji: '', ambiguousTime: false } as never)
    expect(s).toContain('אצלי בבית')
    expect(s).not.toContain('באצלי')
    expect(s).not.toContain('בנושא פגישה')
  })
})
