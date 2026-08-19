/*
 * Session ownership registry — one live voice session; detach-before-replace; a
 * stale release is rejected. Wired into RealtimeVoiceSession.connect()/cleanup()
 * (§D assertions 1, 6, 11). The real peer-connection/track/audio-element are drained
 * by the previous owner's cleanup callback on replacement.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  acquireSession, releaseSession, isActiveOwner, activeSessionCount, nextSessionToken,
  _resetSessionOwnershipForTests,
} from './sessionOwnershipRegistry'

beforeEach(() => _resetSessionOwnershipForTests())

describe('one live session — acquiring DRAINS the previous owner (detach-before-replace)', () => {
  it('a second acquisition drains the first and leaves exactly one owner', () => {
    let drainedA = 0, drainedB = 0
    const a = nextSessionToken(), b = nextSessionToken()
    expect(acquireSession(a, () => { drainedA++ }).replacedPrevious).toBe(false)
    const r = acquireSession(b, () => { drainedB++ })
    expect(r.replacedPrevious).toBe(true)
    expect(drainedA).toBe(1)                 // the old session was drained (pc/track/audio closed)
    expect(drainedB).toBe(0)
    expect(activeSessionCount()).toBe(1)
    expect(isActiveOwner(a)).toBe(false)
    expect(isActiveOwner(b)).toBe(true)
  })
  it('re-acquiring with the SAME token does not self-drain', () => {
    let drained = 0
    const a = nextSessionToken()
    acquireSession(a, () => { drained++ })
    expect(acquireSession(a, () => { drained++ }).replacedPrevious).toBe(false)
    expect(drained).toBe(0)
  })
})

describe('stale release rejection (superseded session after reconnect/rerender)', () => {
  it('only the current owner may release; a stale token release is ignored', () => {
    const a = nextSessionToken(), b = nextSessionToken()
    acquireSession(a, () => {})
    acquireSession(b, () => {})            // b is now the owner (a was drained)
    expect(releaseSession(a)).toBe(false)  // stale — a no longer owns
    expect(activeSessionCount()).toBe(1)   // still exactly one (b)
    expect(releaseSession(b)).toBe(true)
    expect(activeSessionCount()).toBe(0)   // §D-11 cleanup releases the slot
  })
})
