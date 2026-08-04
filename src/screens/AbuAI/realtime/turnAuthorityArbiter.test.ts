/*
 * Turn Authority Arbiter — the live ownership law. Encodes: one TALK owner, one
 * response, legacy brain silenced/inert under REALTIME_ACTIVE, fallback exclusivity
 * (drain + single transfer), stale-generation rejection.
 */
import { describe, it, expect } from 'vitest'
import { TurnAuthorityArbiter } from './turnAuthorityArbiter'

describe('arbiter — REALTIME_ACTIVE gives the model sole TALK; the legacy brain is silenced', () => {
  it('grants model TALK, denies legacy_brain TALK, and forbids legacy speak/act', () => {
    const a = new TurnAuthorityArbiter(); a.activateRealtime(); a.beginTurn()
    expect(a.requestTalk('model').granted).toBe(true)
    const brain = a.requestTalk('legacy_brain')
    expect(brain.granted).toBe(false)
    expect(brain.reason).toMatch(/legacy_brain during REALTIME_ACTIVE/)
    expect(a.canLegacySpeak()).toBe(false)     // the device duplicate-audio fix
    expect(a.canLegacyAct()).toBe(false)       // no competing legacy calendar/comm mutation
  })
  it('at most ONE response.create lease per turn (second denied)', () => {
    const a = new TurnAuthorityArbiter(); a.activateRealtime(); a.beginTurn()
    expect(a.requestResponseLease().granted).toBe(true)
    expect(a.requestResponseLease().granted).toBe(false)   // duplicate audio source
    a.beginTurn()
    expect(a.requestResponseLease().granted).toBe(true)    // fresh turn → fresh lease
  })
})

describe('arbiter — §1 the legacy brain does not RUN under REALTIME_ACTIVE', () => {
  it('legacyBrainAllowed is false in REALTIME_ACTIVE, true certified/fallback', () => {
    const a = new TurnAuthorityArbiter('s')
    expect(a.legacyBrainAllowed()).toBe(true)            // TERMINATED/certified default → brain runs
    a.activateRealtime()
    expect(a.legacyBrainAllowed()).toBe(false)           // slice → brain must NOT run
    a.activateFallback()
    expect(a.legacyBrainAllowed()).toBe(true)            // fallback → legacy brain owns TALK
  })
})

describe('arbiter — §2 per-turn ownership snapshot', () => {
  it('a turn under REALTIME_ACTIVE owns model/control-plane/function-tools with a turn+response id', () => {
    const a = new TurnAuthorityArbiter('sess-x'); a.activateRealtime()
    const turnId = a.beginTurn()
    const lease = a.requestResponseLease('resp-1')
    const v = a.view()
    expect(lease.granted).toBe(true)
    expect(v.sessionId).toBe('sess-x'); expect(v.turnId).toBe(turnId)
    expect(v.talkOwner).toBe('model'); expect(v.stateOwner).toBe('control_plane'); expect(v.actionOwner).toBe('function_tools')
    expect(v.activeResponseId).toBe('resp-1')
    expect(a.requestResponseLease('resp-2').granted).toBe(false)  // one response per turn
  })
  it('a new turn resets the response lease but keeps model TALK ownership', () => {
    const a = new TurnAuthorityArbiter(); a.activateRealtime(); a.beginTurn(); a.requestResponseLease()
    a.beginTurn()
    expect(a.view().talkOwner).toBe('model'); expect(a.view().activeResponseId).toBeNull()
    expect(a.requestResponseLease().granted).toBe(true)
  })
})

describe('arbiter — fallback exclusivity (never concurrent with realtime)', () => {
  it('transfers ONCE, drains realtime, then denies model TALK and allows legacy speak', () => {
    const a = new TurnAuthorityArbiter(); a.activateRealtime()
    const t = a.activateFallback()
    expect(t.transferred).toBe(true); expect(t.drainRealtime).toBe(true)
    expect(a.activateFallback().transferred).toBe(false)   // no double transfer
    a.beginTurn()
    expect(a.requestTalk('model').granted).toBe(false)     // realtime can't speak after fallback
    expect(a.canLegacySpeak()).toBe(true)                  // fallback owns TALK now
  })
})

describe('arbiter — stale generation + terminate', () => {
  it('post-transfer callbacks are stale; TERMINATED denies all TALK', () => {
    const a = new TurnAuthorityArbiter(); a.activateRealtime()
    const g = a.gen
    a.activateFallback()
    expect(a.isStale(g)).toBe(true)                        // the pre-transfer generation is stale
    a.terminate(); a.beginTurn()
    expect(a.requestTalk('model').granted).toBe(false)
  })
})
