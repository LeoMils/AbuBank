/*
 * CALENDAR under ADR-0001 — INTEGRATION (reducer) + PRODUCTION_ADAPTER (injected
 * calendar function-call journey). Proves: field corrections preserve unrelated
 * fields; relationship/gender changes are structured updates; an unresolved
 * relationship stays unresolved (never guessed) and blocks confirm; same-revision
 * confirm/commit (stale confirm rejected); general/communication turns never mutate
 * the draft (isolation); receipts never emit a relative date. Mutation-proven.
 */
import { describe, it, expect } from 'vitest'
import {
  reduceDraft, applyCalendarFunctionCall, missingFields,
  type CalendarDraft, type RelationshipResolver,
} from './calendarDraft'

// Injected truth: explicit names resolve; a genuinely ambiguous phrase stays null.
const resolve: RelationshipResolver = (p) => {
  const map: Record<string, string> = { 'מור': 'מור', 'לאו': 'לאו', 'אמא של אדר': 'מור', 'אדר': 'אדר' }
  return map[p.trim()] ?? null // "אח של מור" (brother of Mor) → null → unresolved, never guessed
}
const start = (fields: Record<string, string | number>, participantPhrase?: string): CalendarDraft =>
  reduceDraft(null, { t: 'START_DRAFT', fields, ...(participantPhrase ? { participantPhrase } : {}) }, resolve).draft!

describe('calendar draft — field corrections preserve every unrelated field', () => {
  it('correcting the time keeps title/date/participant intact + bumps the revision', () => {
    const d0 = start({ title: 'רופא שיניים', date: '2026-08-10', time: '15:00' }, 'מור')
    expect(d0.revision).toBe(1); expect(d0.participant).toBe('מור')
    const d1 = reduceDraft(d0, { t: 'CORRECT_FIELD', field: 'time', value: '16:00' }, resolve).draft!
    expect(d1.time).toBe('16:00')
    expect(d1.title).toBe('רופא שיניים')     // preserved
    expect(d1.date).toBe('2026-08-10')        // preserved
    expect(d1.participant).toBe('מור')         // preserved
    expect(d1.revision).toBe(2)               // bumped
  })
  it('a relationship/gender change is a STRUCTURED field update, not a restart', () => {
    const d0 = start({ title: 'ארוחה', date: '2026-08-11' }, 'מור')
    const d1 = reduceDraft(d0, { t: 'CORRECT_FIELD', field: 'participant', value: '', participantPhrase: 'לאו' }, resolve).draft!
    expect(d1.participant).toBe('לאו')
    expect(d1.title).toBe('ארוחה'); expect(d1.date).toBe('2026-08-11') // unrelated fields intact
  })
})

describe('calendar draft — unresolved relationship is never guessed', () => {
  it('"אח של מור" (brother of Mor) stays UNRESOLVED — never becomes a person', () => {
    const d = start({ title: 'קפה', date: '2026-08-12' }, 'אח של מור')
    expect(d.participant).toBeNull()
    expect(d.unresolvedRelationship).toBe('אח של מור')
  })
  it('an unresolved relationship BLOCKS confirm until an explicit name resolves it', () => {
    const d = start({ title: 'קפה', date: '2026-08-12' }, 'אח של מור')
    const blocked = reduceDraft(d, { t: 'CONFIRM', forRevision: d.revision }, resolve)
    expect(blocked.rejected).toBe(true); expect(blocked.reason).toBe('unresolved-relationship')
    const resolved = reduceDraft(d, { t: 'CORRECT_FIELD', field: 'participant', value: '', participantPhrase: 'לאו' }, resolve).draft!
    expect(resolved.participant).toBe('לאו'); expect(resolved.unresolvedRelationship).toBeNull()
    expect(reduceDraft(resolved, { t: 'CONFIRM', forRevision: resolved.revision }, resolve).draft!.confirmation).toBe('CONFIRMED')
  })
})

describe('calendar draft — same-revision confirm/commit', () => {
  it('confirm consumes the SAME revision; a stale confirm (after a correction) is rejected', () => {
    const d0 = start({ title: 'רופא', date: '2026-08-10', time: '15:00' })       // rev 1, AWAITING_CONFIRM
    expect(d0.confirmation).toBe('AWAITING_CONFIRM')
    const d1 = reduceDraft(d0, { t: 'CORRECT_FIELD', field: 'time', value: '16:00' }, resolve).draft! // rev 2
    const stale = reduceDraft(d1, { t: 'CONFIRM', forRevision: 1 }, resolve)     // user confirmed the rev-1 read
    expect(stale.rejected).toBe(true); expect(stale.reason).toMatch(/stale-confirm/)
    const ok = reduceDraft(d1, { t: 'CONFIRM', forRevision: 2 }, resolve)        // re-confirm the current draft
    expect(ok.rejected).toBe(false); expect(ok.draft!.confirmation).toBe('CONFIRMED')
  })
  it('confirm is blocked while required fields are missing', () => {
    const d = start({ title: 'רק כותרת' })                                       // no date
    expect(missingFields(d)).toContain('date')
    expect(reduceDraft(d, { t: 'CONFIRM', forRevision: d.revision }, resolve).rejected).toBe(true)
  })
})

describe('calendar draft — isolation: general/communication turns never mutate the draft', () => {
  it('a GENERAL turn (e.g. a message mentioning a date word) leaves the draft byte-identical', () => {
    const d0 = start({ title: 'רופא', date: '2026-08-10', time: '15:00' })
    const out = reduceDraft(d0, { t: 'GENERAL' }, resolve)
    expect(out.draft).toBe(d0)             // same reference — nothing mutated
    expect(out.reason).toBe('isolation-no-op')
  })
})

describe('calendar PRODUCTION_ADAPTER — injected function-call journey + safe receipts', () => {
  it('prepare → correct → confirm through the real adapter; receipt never leaks a relative date', () => {
    // prepare
    const r1 = applyCalendarFunctionCall(null, { name: 'prepare_calendar_event', args: { title: 'רופא שיניים', date: '2026-08-10', time: '15:00', participant: 'מור' } }, resolve)
    expect(r1.receipt.confirmation).toBe('AWAITING_CONFIRM')
    expect(r1.receipt.participant).toBe('מור')
    expect(r1.receipt.date).toBe('2026-08-10')
    expect(r1.receipt.date).not.toMatch(/מחר|מחרתיים|היום|FRIDAY|TOMORROW/i)  // grounded — never relative
    // correct the time
    const r2 = applyCalendarFunctionCall(r1.outcome.draft, { name: 'correct_calendar_field', args: { field: 'time', value: '16:00' } }, resolve)
    expect(r2.receipt.time).toBe('16:00'); expect(r2.receipt.revision).toBe(2)
    expect(r2.outcome.draft!.title).toBe('רופא שיניים')                          // preserved through the adapter
    // stale confirm (rev 1) rejected, then correct-revision confirm commits
    expect(applyCalendarFunctionCall(r2.outcome.draft, { name: 'confirm_calendar_event', args: { forRevision: 1 } }, resolve).receipt.rejected).toBe(true)
    const r3 = applyCalendarFunctionCall(r2.outcome.draft, { name: 'confirm_calendar_event', args: { forRevision: 2 } }, resolve)
    expect(r3.receipt.confirmation).toBe('CONFIRMED')
    expect(r3.receipt.allowedClaims).toContain('event saved to the calendar')
  })
  it('an injected phone-number/relationship it cannot resolve never fabricates a person', () => {
    const r = applyCalendarFunctionCall(null, { name: 'prepare_calendar_event', args: { title: 'קפה', date: '2026-08-12', participant: 'אח של מור' } }, resolve)
    expect(r.receipt.participant).toBeNull()
    expect(r.receipt.unresolvedRelationship).toBe('אח של מור')
    expect(r.receipt.allowedClaims).toContain('never guesses the person')
  })
})
