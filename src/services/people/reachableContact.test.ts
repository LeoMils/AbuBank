/*
 * reachableContact.test.ts — owner brief item 4: Abu must only offer to MESSAGE/CALL an ACTUAL
 * contact. resolveContactTarget resolved ANY living person to an id, so Abu would offer to message
 * a friend's care-facility son (Yaron Minuchin) or a Vancouver relative. Now: immediate family are
 * reachable; a known-but-not-a-contact person is answered (whoIs) but returns not_a_contact for reach.
 */
import { describe, it, expect } from 'vitest'
import { resolveContactTarget, whoIs } from './peopleLookup'

describe('contact reachability gate', () => {
  it('immediate family are reachable contacts (resolved)', () => {
    for (const name of ['מור', 'לאו', 'אופיר', 'עדי', 'יעל']) {
      expect(resolveContactTarget(name).status, `${name} should be reachable`).toBe('resolved')
    }
  })

  it('a friend\'s care-facility son (Yaron Minuchin) is KNOWN but NOT a contact', () => {
    expect(whoIs('יארון מינושין').status).toBe('ok')          // she still knows who he is
    const r = resolveContactTarget('יארון מינושין')
    expect(r.status).toBe('not_a_contact')                     // …but never offered to message/call
  })

  it('a distant Vancouver relative is known but not a contact', () => {
    const r = resolveContactTarget('מריו')
    expect(['not_a_contact', 'ambiguous']).toContain(r.status) // recognised, not reachable (or asks)
    expect(r.status).not.toBe('resolved')
  })

  it('the deceased stay deceased (never a contact), not merely not_a_contact', () => {
    expect(resolveContactTarget('פפי').status).toBe('deceased')
  })

  it('an unknown name is still not_found (unchanged)', () => {
    expect(resolveContactTarget('גברת כהן מהמכולת').status).toBe('not_found')
  })
})
