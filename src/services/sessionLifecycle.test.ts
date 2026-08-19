/*
 * Session lifecycle policy (O-LIFECYCLE) — deterministic reducer tests.
 * Locks the brief's contract: 12s stop-upstream · 25s ask-once · 45s warm-goodbye+close ·
 * never close mid-task · 20-min single outward nudge · resume keeps the thread.
 */
import { describe, it, expect } from 'vitest'
import { lifecycleDecision, onUserActivity, LIFECYCLE, type LifecycleInput } from './sessionLifecycle'

const base: LifecycleInput = {
  silenceMs: 0, sessionAgeMs: 0, midTask: false, askedPresence: false, nudgedOutward: false,
}
const at = (o: Partial<LifecycleInput>) => lifecycleDecision({ ...base, ...o })

describe('session lifecycle — silence ladder', () => {
  it('active (little silence) → no action', () => {
    expect(at({ silenceMs: 5_000 }).action).toBe('none')
  })
  it('~12s silence → stop streaming upstream (no spoken line)', () => {
    const d = at({ silenceMs: LIFECYCLE.STOP_UPSTREAM_MS })
    expect(d.action).toBe('stop-upstream')
    expect(d.speak).toBeUndefined()
    expect(d.closes).toBe(false)
  })
  it('~25s silence → asks ONCE, warmly, and does not close', () => {
    const d = at({ silenceMs: LIFECYCLE.ASK_PRESENCE_MS })
    expect(d.action).toBe('ask-presence')
    expect(d.speak).toContain('את שם')
    expect(d.closes).toBe(false)
  })
  it('already asked → does not ask again (falls back to stop-upstream)', () => {
    expect(at({ silenceMs: LIFECYCLE.ASK_PRESENCE_MS, askedPresence: true }).action).toBe('stop-upstream')
  })
  it('~45s silence → warm goodbye AND closes', () => {
    const d = at({ silenceMs: LIFECYCLE.GOODBYE_MS })
    expect(d.action).toBe('warm-goodbye')
    expect(d.speak).toBeTruthy()
    expect(d.closes).toBe(true)
  })
})

describe('session lifecycle — never close mid-task (the most important rule)', () => {
  it('mid-task at 60s silence → NO action, never closes', () => {
    const d = at({ silenceMs: 60_000, midTask: true })
    expect(d.action).toBe('none')
    expect(d.closes).toBe(false)
  })
  it('mid-task at 20 min → still no nudge (never interrupt a task)', () => {
    expect(at({ sessionAgeMs: LIFECYCLE.OUTWARD_NUDGE_MS, midTask: true }).action).toBe('none')
  })
})

describe('session lifecycle — 20-minute outward suggestion (once, never nagging)', () => {
  it('~20 min while actively there → one warm outward suggestion', () => {
    const d = at({ sessionAgeMs: LIFECYCLE.OUTWARD_NUDGE_MS, silenceMs: 2_000 })
    expect(d.action).toBe('outward-nudge')
    expect(d.speak).toBeTruthy()
    expect(d.closes).toBe(false)
  })
  it('already nudged → never nags again', () => {
    expect(at({ sessionAgeMs: LIFECYCLE.OUTWARD_NUDGE_MS, nudgedOutward: true }).action).toBe('none')
  })
  it('20 min but deep in silence → idle rules win (does not nudge into the void)', () => {
    expect(at({ sessionAgeMs: LIFECYCLE.OUTWARD_NUDGE_MS, silenceMs: 30_000 }).action).toBe('ask-presence')
  })
})

describe('session lifecycle — resume keeps the thread', () => {
  it('user activity resets the silence clock and the asked-once flag', () => {
    expect(onUserActivity()).toEqual({ silenceMs: 0, askedPresence: false })
  })
})
