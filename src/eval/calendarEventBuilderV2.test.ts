/*
 * Calendar Intelligence v2 — the ONE semantic Event Builder. Locks the three real
 * iPhone examples + slot coverage (activity title, location, notes, who).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { buildEventV2 } from '../screens/AbuAI/calendarEventBuilderV2'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

describe('Calendar Event Builder v2 — the three real examples', () => {
  it('פגישה עם אלון שוורץ … בקפה אליהו', () => {
    const e = buildEventV2('קבע לי פגישה עם אלון שוורץ ביום שישי בעשר בבוקר בקפה אליהו.')
    expect(e.title).toBe('פגישה עם אלון שוורץ')      // venue "קפה" is NOT the activity
    expect(e.who).toBe('אלון שוורץ')
    expect(e.time).toBe('10:00')
    expect(e.location).toContain('קפה אליהו')
    expect(e.notes).toBeNull()
  })

  it('מחר בשלוש עם מור אצלה בבית', () => {
    const e = buildEventV2('קבע לי מחר בשלוש עם מור אצלה בבית.')
    expect(e.title).toBe('פגישה עם מור')
    expect(e.who).toBe('מור')
    expect(e.time).toBe('15:00')
    expect(e.location).toMatch(/אצל מור/)
    expect(e.notes).toBeNull()
  })

  it('ארוחת ערב עם גלעד … במסעדת טוטו ותכתוב שנדבר על הפרויקט', () => {
    const e = buildEventV2('קבע לי ארוחת ערב עם גלעד ביום חמישי במסעדת טוטו ותכתוב שנדבר על הפרויקט.')
    expect(e.title).toBe('ארוחת ערב עם גלעד')          // activity-aware title
    expect(e.who).toBe('גלעד')
    expect(e.location).toBe('מסעדת טוטו')               // note clause did NOT bleed into venue
    expect(e.notes).toBe('נדבר על הפרויקט')            // "תכתוב ש…" → notes
  })
})

describe('Calendar Event Builder v2 — slot coverage', () => {
  it('a real coffee date keeps the activity title', () => {
    expect(buildEventV2('קבע לי קפה עם רותי מחר בעשר').title).toBe('קפה עם רותי')
  })
  it('activity-only titles (doctor)', () => {
    expect(buildEventV2('קבע לי תור לרופא מחר בעשר').title).toMatch(/רופא/)
  })
  it('locations are detected (אצל / venue / בבית)', () => {
    expect(buildEventV2('פגישה עם דני מחר בעשר אצל דני').location).toMatch(/אצל דני/)
    expect(buildEventV2('פגישה עם דני מחר בעשר בקניון').location).toMatch(/קניון/)
  })
  it('missing fields + confidence are surfaced', () => {
    const e = buildEventV2('קבע פגישה עם דני')          // no date/time
    expect(e.missingFields).toContain('date')
    expect(e.missingFields).toContain('time')
    expect(e.confidence).toBeLessThan(1)
  })
})
