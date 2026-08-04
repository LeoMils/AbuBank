/*
 * Control-plane laws — the deterministic STATE authority, proving the device-
 * transcript failure families are killed at the architectural level. Each law has
 * a positive proof; several include a mutation demonstration (a naive reducer that
 * would fail). No phone tokens (labels are names).
 */
import { describe, it, expect } from 'vitest'
import { reduce, run, initialState, isSafeLabel, type ControlEvent, type Effect, type ActionStatus } from './controlPlane'

const emit = (effects: Effect[], e: Effect['e']) => effects.filter((x) => x.e === e)

describe('law 8 — exactly one greeting per session', () => {
  it('a second GREETING_REQUESTED emits nothing (repeated greeting was the device bug)', () => {
    const { effects } = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'GREETING_REQUESTED' }, { t: 'GREETING_REQUESTED' }, { t: 'GREETING_REQUESTED' }])
    expect(emit(effects, 'EMIT_GREETING').length).toBe(1)
  })
  it('fallback + reconnect never re-greet', () => {
    const { effects } = run([
      { t: 'SESSION_STARTED', sessionId: 's' }, { t: 'GREETING_REQUESTED' },
      { t: 'TRANSPORT_DISCONNECTED' }, { t: 'FALLBACK_ENTERED' }, { t: 'RECONNECTED' }, { t: 'GREETING_REQUESTED' },
    ])
    expect(emit(effects, 'EMIT_GREETING').length).toBe(1)
  })
})

describe('laws 1/2/3 — latest explicit intent wins; Call<->WhatsApp atomic replace', () => {
  it('WhatsApp pending, then explicit Call REPLACES it (the exact device failure)', () => {
    const r = run([
      { t: 'SESSION_STARTED', sessionId: 's' },
      { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'לאו' },
      { t: 'TURN_ACCEPTED', seq: 2, turnType: 'REPLACE_ACTION', kind: 'call', recipientLabel: 'לאו' },
    ])
    expect(r.state.active?.kind).toBe('call')                 // flipped — NOT stuck on whatsapp
    expect(r.state.active?.supersedes).toBeTruthy()           // atomically superseded the message
    const last = r.effects.filter((e) => e.e === 'RENDER_CARD').pop() as Extract<Effect, { e: 'RENDER_CARD' }>
    expect(last.action.kind).toBe('call')
    expect(emit(r.effects, 'STOP_PLAYBACK').length).toBeGreaterThanOrEqual(1) // obsolete playback stopped
  })
  it('Call pending, then explicit WhatsApp replaces it (mirror)', () => {
    const r = run([
      { t: 'SESSION_STARTED', sessionId: 's' },
      { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'call', recipientLabel: 'מור' },
      { t: 'TURN_ACCEPTED', seq: 2, turnType: 'REPLACE_ACTION', kind: 'message', recipientLabel: 'מור' },
    ])
    expect(r.state.active?.kind).toBe('message')
  })
  it('MUTATION: a reducer that treated REPLACE as CONTINUE would keep whatsapp — proven by revision+kind change', () => {
    const s0 = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'לאו' }]).state
    const before = s0.active!
    const after = reduce(s0, { t: 'TURN_ACCEPTED', seq: 2, turnType: 'REPLACE_ACTION', kind: 'call', recipientLabel: 'לאו' }).state.active!
    expect(after.revision).toBeGreaterThan(before.revision)   // a "continue" mutant would not flip kind
    expect(after.kind).not.toBe(before.kind)
  })
})

describe('laws 13/14 — general talk / complaints never mutate action state', () => {
  it('a COMPLAINT while a message is pending does not become a clarification or change the action', () => {
    const s0 = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'לאו' }]).state
    const r = reduce(s0, { t: 'TURN_ACCEPTED', seq: 2, turnType: 'COMPLAINT' })
    expect(r.state.active).toEqual(s0.active)                 // unchanged
    expect(emit(r.effects, 'REQUEST_TOOL').length).toBe(0)     // no tool, no clarification capture
  })
  it('GENERAL conversation does not create or mutate an action', () => {
    const r = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'GENERAL' }])
    expect(r.state.active).toBeNull()
    expect(emit(r.effects, 'REQUEST_TOOL').length).toBe(0)
  })
})

describe('law 4 — cancel invalidates the active branch', () => {
  it('CANCEL_ACTION clears the active action and dismisses the card', () => {
    const r = run([
      { t: 'SESSION_STARTED', sessionId: 's' },
      { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'call', recipientLabel: 'מור' },
      { t: 'TURN_ACCEPTED', seq: 2, turnType: 'CANCEL_ACTION' },
    ])
    expect(r.state.active).toBeNull()
    expect(emit(r.effects, 'DISMISS_CARD').length).toBe(1)
  })
})

describe('laws 5/6/12 — stale/replaced/cross-generation results are rejected', () => {
  it('a TOOL_RESULT for an old revision is rejected (cannot speak/render late)', () => {
    const s = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'לאו' }, { t: 'TURN_ACCEPTED', seq: 2, turnType: 'REPLACE_ACTION', kind: 'call', recipientLabel: 'לאו' }]).state
    const r = reduce(s, { t: 'TOOL_RESULT', forRevision: s.active!.revision - 1, generation: s.generation, status: 'READY_FOR_HANDOFF', kind: 'message', recipientLabel: 'לאו' })
    expect(emit(r.effects, 'REJECT_STALE').length).toBe(1)
    expect(r.state.active?.kind).toBe('call')                 // the superseded message result never lands
  })
  it('a TOOL_RESULT from a previous generation (pre-fallback) is rejected', () => {
    const s = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'call', recipientLabel: 'מור' }, { t: 'FALLBACK_ENTERED' }]).state
    const r = reduce(s, { t: 'TOOL_RESULT', forRevision: s.active!.revision, generation: s.generation - 1, status: 'READY_FOR_HANDOFF', kind: 'call', recipientLabel: 'מור' })
    expect(emit(r.effects, 'REJECT_STALE').length).toBe(1)
  })
  it('a matching TOOL_RESULT commits and renders one card at the active revision (laws 9/10)', () => {
    const s = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'call', recipientLabel: 'מור' }]).state
    const r = reduce(s, { t: 'TOOL_RESULT', forRevision: s.active!.revision, generation: s.generation, status: 'READY_FOR_HANDOFF', kind: 'call', recipientLabel: 'מור' })
    expect(r.state.active?.status).toBe('READY_FOR_HANDOFF')
    const card = emit(r.effects, 'RENDER_CARD')[0] as Extract<Effect, { e: 'RENDER_CARD' }>
    expect(card.action.revision).toBe(r.state.active!.revision) // UI + speech read one revision
  })
})

describe('no fabricated completion — structural', () => {
  it('the status type admits no SENT/CALLED/DIALED/DELIVERED', () => {
    const allowed: ActionStatus[] = ['NEEDS_CLARIFICATION', 'READY_FOR_HANDOFF', 'NOT_CONFIGURED', 'CANCELLED', 'FAILED']
    // @ts-expect-error — a completion status is not assignable to ActionStatus
    const bad: ActionStatus = 'SENT'
    expect(allowed).not.toContain(bad)
  })
})

describe('law 7 — interruption stops playback, keeps state', () => {
  it('INTERRUPTION emits STOP_PLAYBACK and preserves the active action', () => {
    const s = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'לאו' }]).state
    const r = reduce(s, { t: 'INTERRUPTION' })
    expect(emit(r.effects, 'STOP_PLAYBACK').length).toBe(1)
    expect(r.state.active).toEqual(s.active)
  })
})

describe('fallback preserves state; privacy by construction', () => {
  it('fallback keeps active + greeting and only bumps generation', () => {
    const s = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'GREETING_REQUESTED' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'call', recipientLabel: 'מור' }]).state
    const r = reduce(s, { t: 'FALLBACK_ENTERED' })
    expect(r.state.active?.kind).toBe('call')
    expect(r.state.greetingEmitted).toBe(true)
    expect(r.state.generation).toBe(s.generation + 1)
    expect(r.state.transport).toBe('fallback')
  })
  it('a phone-like recipient label is refused (numbers never enter the control plane)', () => {
    expect(isSafeLabel('לאו')).toBe(true)
    expect(isSafeLabel('0500000001')).toBe(false)
    const r = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'call', recipientLabel: '0500000001' }])
    expect(r.state.active?.recipientLabel).toBeNull()         // scrubbed to null, never stored
  })
})

describe('out-of-order / duplicate turns are ignored (idempotent ordering)', () => {
  it('a lower/equal seq TURN_ACCEPTED is dropped', () => {
    const s = run([{ t: 'SESSION_STARTED', sessionId: 's' }, { t: 'TURN_ACCEPTED', seq: 5, turnType: 'START_ACTION', kind: 'call', recipientLabel: 'מור' }]).state
    const r = reduce(s, { t: 'TURN_ACCEPTED', seq: 3, turnType: 'REPLACE_ACTION', kind: 'message', recipientLabel: 'מור' })
    expect(r.state.active?.kind).toBe('call') // stale earlier-seq turn ignored
  })
})
