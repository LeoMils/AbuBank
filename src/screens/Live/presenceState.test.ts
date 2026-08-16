/*
 * presenceState.test.ts — the live session → presence state mapping (STEP 2 wiring).
 * ════════════════════════════════════════════════════════════════════════════
 * Proves all four presence states are reachable from real LiveSession states, so the
 * character's aura + mouth-gating reflect what she is actually doing. CODE evidence
 * (a pure mapping); on-device timing of the thinking window is not claimed here.
 */
import { describe, it, expect } from 'vitest'
import { toPresenceState, liveStateWord } from './LiveScreen'

describe('toPresenceState — session state drives the presence', () => {
  it('connecting → thinking', () => {
    expect(toPresenceState('connecting', false)).toBe('thinking')
  })
  it('listening → listening', () => {
    expect(toPresenceState('listening', false)).toBe('listening')
  })
  it('speaking → speaking', () => {
    expect(toPresenceState('speaking', false)).toBe('speaking')
  })
  it('idle / error → waiting (calm)', () => {
    expect(toPresenceState('idle', false)).toBe('waiting')
    expect(toPresenceState('error', false)).toBe('waiting')
  })
  it('E5a device fix: a GENERIC thinking hint NEVER overrides real listening (no "חושבת while listening")', () => {
    // The session is actually listening → a stale "user just finished" hint may NOT show 'thinking'.
    expect(toPresenceState('listening', true)).toBe('listening')
    // … and her audio starting (speaking) always wins.
    expect(toPresenceState('speaking', true)).toBe('speaking')
  })
  it('M4: a REAL in-flight lookup may show the thinking aura (it has its own word מחפשת…), speaking still wins', () => {
    expect(toPresenceState('listening', false, true)).toBe('thinking')
    expect(toPresenceState('speaking', false, true)).toBe('speaking') // her audio wins over a lookup hint
  })
})

describe('liveStateWord — the M4 non-verbal lookup cue shows a distinct, honest word', () => {
  it('during an in-flight lookup the word is מחפשת… (not frozen, not מקשיבה)', () => {
    const presence = toPresenceState('listening', false, true)
    expect(liveStateWord('listening', presence, true)).toBe('מחפשת…')
    expect(liveStateWord('listening', presence, true)).not.toBe('מקשיבה')
  })
  it('her speaking always wins over a stale lookup hint (says מדברת, never מחפשת…)', () => {
    // If audio has started, the lookup is over — the word must not lie that she is still searching.
    expect(liveStateWord('speaking', 'speaking', true)).toBe('מדברת')
  })
  it('with no lookup, listening always reads מקשיבה — even with a stale thinking hint (E5a)', () => {
    expect(liveStateWord('listening', toPresenceState('listening', false), false)).toBe('מקשיבה')
    expect(liveStateWord('listening', toPresenceState('listening', true), false)).toBe('מקשיבה')
    expect(liveStateWord('idle', toPresenceState('idle', false), false)).toBe('מוכנה')
  })
})

describe('liveStateWord — the ONE spelled-out indicator matches the face, never the raw state', () => {
  // Helper: the word Martita actually reads for a given session state + thinking hint,
  // going through the SAME reconciliation the screen uses.
  const word = (state: Parameters<typeof toPresenceState>[0], thinking: boolean) =>
    liveStateWord(state, toPresenceState(state, thinking))

  it('REGRESSION (trace: "speaking while the screen says listening") — never shows מקשיבה while she speaks', () => {
    // Her audio is flowing (speaking). The raw session state is "speaking", but the earlier
    // bug read STATE_LABEL[state] directly; here we prove the reconciled word is מדברת.
    expect(word('speaking', false)).toBe('מדברת')
    expect(word('speaking', true)).toBe('מדברת') // even with a stale thinking hint
    expect(word('speaking', false)).not.toBe('מקשיבה')
  })

  it('E5a REGRESSION — the display can NEVER contradict the session: listening reads מקשיבה, never חושבת', () => {
    // Device defect (3rd time): the screen said "חושבת" while the session was actually listening.
    // A generic thinking hint must not override the real state — listening reads מקשיבה.
    expect(word('listening', true)).toBe('מקשיבה')
    expect(word('listening', true)).not.toBe('חושבת')
  })

  it('plain listening shows מקשיבה; idle shows מוכנה; connecting shows מתחברת…', () => {
    expect(word('listening', false)).toBe('מקשיבה')
    expect(word('idle', false)).toBe('מוכנה')
    expect(word('connecting', false)).toBe('מתחברת…')
  })

  it('INVARIANT — the displayed word can never contradict the actual session state (all combos)', () => {
    // The heart of E5a: for EVERY session state × hint combination, the spoken word must be
    // consistent with the session. speaking⇒מדברת; listening (no real lookup)⇒מקשיבה; a generic
    // thinking hint can NEVER flip either. Fails if displayed and actual can ever diverge.
    for (const thinking of [false, true]) {
      // speaking is authoritative regardless of any hint
      expect(word('speaking', thinking)).toBe('מדברת')
      // listening (no lookup) is authoritative regardless of a thinking hint
      expect(word('listening', thinking)).toBe('מקשיבה')
    }
    // a REAL lookup is the only thing that may relabel a listening wire — and only as מחפשת… (honest)
    expect(liveStateWord('listening', toPresenceState('listening', false, true), true)).toBe('מחפשת…')
  })
})
