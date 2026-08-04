/*
 * WHOLE-PRODUCT PROPERTY / RACE / FAULT — generative invariants across DISTINCT
 * product seams (not just realtime): PRIVACY (numbers never become labels), TRUTH
 * (a 1st-person completion is never sayable), and STATE ORDERING (a wrong-gen/rev
 * tool result is always rejected). Seeded generation → deterministic + reproducible.
 * Independent verifiers: destructiveSweep.test.ts + productDestructionLab.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { isSafeLabel, reduce, initialState, type ControlState } from './realtime/controlPlane'
import { monitorUtterance } from './realtime/truthMonitor'

// Deterministic LCG so the property sweep is reproducible (no Math.random flake).
function rng(seed: number) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff }

describe('PROPERTY — privacy: a value with ≥7 digits can NEVER be a safe label', () => {
  it('holds over 300 generated name+number combinations', () => {
    const rand = rng(42)
    for (let i = 0; i < 300; i++) {
      const digits = 7 + Math.floor(rand() * 6)                        // 7..12 digits
      const num = Array.from({ length: digits }, () => Math.floor(rand() * 10)).join('')
      const name = ['מור', 'לאו', 'אדר', ''][Math.floor(rand() * 4)]
      const label = [name, num].filter(Boolean).join(rand() < 0.5 ? ' ' : '-')
      expect(isSafeLabel(label), label).toBe(false)                    // MUTATION-CATCH: weaken the digit gate
    }
  })
  it('a human name with <7 digits stays safe', () => {
    for (const l of ['מור', 'לאו 12', 'אדר', 'בית 3']) expect(isSafeLabel(l), l).toBe(true)
  })
})

describe('PROPERTY — truth: a 1st-person completion is unsayable in any filler context', () => {
  it('holds over generated prefix/suffix combinations', () => {
    const rand = rng(7)
    const verbs = ['שלחתי', 'התקשרתי', 'חייגתי']
    const prefixes = ['', 'טוב, ', 'אז ', 'הנה ', 'בסדר גמור, ']
    const suffixes = ['', ' עכשיו', ' לו', ' את זה', '!']
    for (let i = 0; i < 200; i++) {
      const v = verbs[Math.floor(rand() * verbs.length)]!
      const p = prefixes[Math.floor(rand() * prefixes.length)]!
      const s = suffixes[Math.floor(rand() * suffixes.length)]!
      const utter = `${p}${v}${s}`
      expect(monitorUtterance(utter, { status: 'READY_FOR_HANDOFF' }).ok, utter).toBe(false)
      // …but the negated form is always truthful.
      expect(monitorUtterance(`לא ${v}${s}`, { status: 'READY_FOR_HANDOFF' }).ok).toBe(true)
    }
  })
})

describe('PROPERTY — state ordering: a wrong generation/revision tool result is always rejected', () => {
  it('holds over generated (gen,rev) pairs that differ from the active action', () => {
    const rand = rng(99)
    // Build an active action at generation 0, revision 1.
    let s: ControlState = initialState('prop')
    s = reduce(s, { t: 'TURN_ACCEPTED', seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור' }).state
    const activeRev = s.active!.revision
    for (let i = 0; i < 200; i++) {
      const gen = Math.floor(rand() * 5)          // 0..4
      const rev = Math.floor(rand() * 5)          // 0..4
      if (gen === s.generation && rev === activeRev) continue // the ONE valid combo
      const { effects } = reduce(s, { t: 'TOOL_RESULT', forRevision: rev, generation: gen, status: 'READY_FOR_HANDOFF', kind: 'message', recipientLabel: 'מור' })
      expect(effects.some((e) => e.e === 'REJECT_STALE'), `gen ${gen} rev ${rev}`).toBe(true)
    }
    // The one valid combo commits.
    const ok = reduce(s, { t: 'TOOL_RESULT', forRevision: activeRev, generation: s.generation, status: 'READY_FOR_HANDOFF', kind: 'message', recipientLabel: 'מור' })
    expect(ok.effects.some((e) => e.e === 'RENDER_CARD')).toBe(true)
  })
})
