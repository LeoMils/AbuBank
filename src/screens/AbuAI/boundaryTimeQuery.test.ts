/*
 * Calendar before/after-time READ queries must resolve a concrete threshold,
 * including bare Hebrew hour-words after לפני/אחרי ("אחרי ארבע", "לפני שבע בערב").
 * This is the user-facing read path (parseQueryBoundaryTime) — distinct from the
 * stricter create parser. Locks the behavior verified during production closure.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parseQueryBoundaryTime, tryGroundedAnswer } from './service'

describe('parseQueryBoundaryTime — bare-word after/before', () => {
  it('resolves bare hour-words after אחרי/לפני to an afternoon clock time', () => {
    expect(parseQueryBoundaryTime('אחרי ארבע')).toBe('16:00')
    expect(parseQueryBoundaryTime('לפני ארבע')).toBe('16:00')
    expect(parseQueryBoundaryTime('מה יש לי מחר אחרי ארבע')).toBe('16:00')
  })
  it('respects an explicit period word', () => {
    expect(parseQueryBoundaryTime('לפני שבע בערב')).toBe('19:00')
    expect(parseQueryBoundaryTime('אחרי עשר בבוקר')).toBe('10:00')
  })
  it('returns null when there is no boundary time', () => {
    expect(parseQueryBoundaryTime('מה שלומך')).toBeNull()
  })
})

describe('before/after filtering reaches the grounded answer', () => {
  let storage: Record<string, string> = {}
  beforeEach(() => {
    storage = {}
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 22)) // June 22, 2026
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v },
      removeItem: (k: string) => { delete storage[k] },
    })
    const tmr = new Date(2026, 5, 23)
    const t = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`
    storage['abubank-calendar-appointments'] = JSON.stringify([
      { id: 'a', title: 'יוגה', date: t, time: '09:00', emoji: '🧘', color: '#1' },
      { id: 'b', title: 'רופא', date: t, time: '16:00', emoji: '🏥', color: '#2' },
    ])
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  it('"לפני ארבע" shows the morning event, excludes the 16:00 one', () => {
    const ans = tryGroundedAnswer('מה יש לי מחר לפני ארבע')!
    expect(ans).toBeTruthy()
    expect(ans).toContain('יוגה')
    expect(ans).not.toContain('רופא')
  })
  it('"אחרי ארבע" excludes events at/before 16:00 (honest "quiet")', () => {
    const ans = tryGroundedAnswer('מה יש לי מחר אחרי ארבע')!
    expect(ans).toBeTruthy()
    expect(ans).not.toContain('יוגה')
  })
})
