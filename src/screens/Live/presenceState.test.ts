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
  it('the thinking hint (user just finished) shows thinking until she speaks', () => {
    // listening + thinking hint → thinking …
    expect(toPresenceState('listening', true)).toBe('thinking')
    // … but her audio starting (speaking) wins over a stale hint.
    expect(toPresenceState('speaking', true)).toBe('speaking')
  })
  it('M4: a lookup reuses the thinking aura (no new visual), speaking still wins', () => {
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
  it('with no lookup, the word is unchanged (מקשיבה / חושבת / מוכנה)', () => {
    expect(liveStateWord('listening', toPresenceState('listening', false), false)).toBe('מקשיבה')
    expect(liveStateWord('listening', toPresenceState('listening', true), false)).toBe('חושבת')
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

  it('REGRESSION — during the thinking window it says חושבת, never מקשיבה', () => {
    // Session state is still "listening" (VAD has not fired her next turn) but she just
    // finished and Abu is composing. The old label read the raw state → "מקשיבה" (a lie).
    expect(word('listening', true)).toBe('חושבת')
    expect(word('listening', true)).not.toBe('מקשיבה')
  })

  it('plain listening shows מקשיבה; idle shows מוכנה; connecting shows מתחברת…', () => {
    expect(word('listening', false)).toBe('מקשיבה')
    expect(word('idle', false)).toBe('מוכנה')
    expect(word('connecting', false)).toBe('מתחברת…')
  })

  it('during an active turn the word is ALWAYS exactly one of the three real states', () => {
    const active = new Set(['מקשיבה', 'חושבת', 'מדברת'])
    for (const thinking of [false, true]) {
      for (const state of ['listening', 'speaking'] as const) {
        expect(active.has(word(state, thinking))).toBe(true)
      }
    }
  })
})
