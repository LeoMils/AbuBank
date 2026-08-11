/*
 * liveContacts.test.ts — Milestone 2/3 evidence (CODE class).
 *
 * Proves the ONE deterministic identity decision for the live path:
 *   • a real name / alias                 → resolved to a stable id
 *   • a relationship phrase ("אח של מור") → AMBIGUOUS, never a specific person
 *   • an unknown name ("Gabi")            → NOT_FOUND
 * and the calendar participant adapter that keeps "אח של מור" -> Leo structurally
 * impossible while still allowing a plain unknown name onto an event.
 * No phone numbers are read or returned anywhere here.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveContact, resolveCalendarParticipant, isRelationshipPhrase,
  knownContactIds, contactLabel,
} from './liveContacts'

describe('resolveContact', () => {
  it('resolves a canonical Hebrew name to a stable id + label', () => {
    const r = resolveContact('מור')
    expect(r.status).toBe('resolved')
    if (r.status === 'resolved') { expect(r.id).toBe('mor'); expect(r.label).toBe('מור') }
  })

  it('resolves via an alias (Hebrew and Latin)', () => {
    expect(resolveContact('מורי')).toMatchObject({ status: 'resolved', id: 'mor' })
    expect(resolveContact('Leo')).toMatchObject({ status: 'resolved', id: 'leo' })
    expect(resolveContact('לאון')).toMatchObject({ status: 'resolved', id: 'leo' })
  })

  it('strips a single leading Hebrew prepositional prefix (למור → מור)', () => {
    expect(resolveContact('למור')).toMatchObject({ status: 'resolved', id: 'mor' })
  })

  it('returns AMBIGUOUS for a relationship phrase — NEVER a specific person', () => {
    const r = resolveContact('אח של מור')
    expect(r.status).toBe('ambiguous')
    // and it names no one — the model must ask, not substitute Leo
    if (r.status === 'ambiguous') expect(r.candidates).toEqual([])
  })

  it('returns AMBIGUOUS for other kinship-of-name phrases', () => {
    expect(resolveContact('הבת של אופיר').status).toBe('ambiguous')
    expect(resolveContact('בן הזוג של מור').status).toBe('ambiguous')
  })

  it('returns NOT_FOUND for an unknown name', () => {
    expect(resolveContact('Gabi').status).toBe('not_found')
    expect(resolveContact('').status).toBe('not_found')
  })

  it('every resolved id is a known contact id', () => {
    const ids = knownContactIds()
    expect(ids.has('mor')).toBe(true)
    expect(ids.has('leo')).toBe(true)
    expect(contactLabel('mor')).toBe('מור')
  })
})

describe('isRelationshipPhrase', () => {
  it('is TRUE for possessive and bare kinship references', () => {
    expect(isRelationshipPhrase('אח של מור')).toBe(true)
    expect(isRelationshipPhrase('האח')).toBe(true)
    expect(isRelationshipPhrase('הבת של אופיר')).toBe(true)
  })
  it('is FALSE for plain names', () => {
    expect(isRelationshipPhrase('מור')).toBe(false)
    expect(isRelationshipPhrase('Gabi')).toBe(false)
  })
})

describe('resolveCalendarParticipant (adapter for the draft kernel)', () => {
  it('a resolved contact becomes its Hebrew label', () => {
    expect(resolveCalendarParticipant('מור')).toBe('מור')
  })
  it('a relationship phrase resolves to null (blocks the draft → Abu asks who)', () => {
    expect(resolveCalendarParticipant('אח של מור')).toBeNull()
  })
  it('a plain unknown single name is allowed as a free-text label (Gabi)', () => {
    expect(resolveCalendarParticipant('Gabi')).toBe('Gabi')
  })
  // device defect 5: ANY spoken name is accepted as a participant, even a two-word name
  // that is not a contact — a participant does not have to be in the contact book.
  it('a multi-word proper name IS allowed as a free-text label (not a contact)', () => {
    expect(resolveCalendarParticipant('gabi lopez')).toBe('gabi lopez')
    expect(resolveCalendarParticipant('דודה רבקה')).toBe('דודה רבקה')
  })
  it('a relationship phrase is STILL refused even when multi-word (never guessed)', () => {
    expect(resolveCalendarParticipant('אח של מור')).toBeNull()
    expect(resolveCalendarParticipant('הדוד')).toBeNull()
  })
})
