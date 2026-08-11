/*
 * presence.test.tsx — AbuPresence + AbuCharacterA (CODE evidence).
 * ════════════════════════════════════════════════════════════════════════════
 * Proves the character reacts to REAL amplitude at the render layer: a loud
 * amplitude while speaking shows the open-mouth viseme; silence/other states keep
 * the mouth closed. Also proves all four states render and each carries its aura,
 * and that the eyelids start open (blink is a runtime timer, not initial state).
 *
 * This is CODE evidence (a deterministic render assertion). It does NOT prove the
 * on-device frame rate or that the mouth reads as natural to a human eye — those
 * are PHYSICAL_DEVICE / HUMAN-EYE and are not claimed here.
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { AbuPresence, shouldDegradeMouth, type PresenceState } from './AbuPresence'
import { AbuCharacterA } from './AbuCharacterA'

const render = (props: React.ComponentProps<typeof AbuPresence>) =>
  renderToString(React.createElement(AbuPresence, props))

/** Extract the inline opacity a given mouth viseme group rendered with. */
function mouthOpacity(html: string, id: 'mouth-closed' | 'mouth-mid' | 'mouth-open'): number {
  const m = html.match(new RegExp(`id="${id}" style="opacity:([0-9.]+)"`))
  expect(m, `${id} group with an opacity style`).not.toBeNull()
  return Number(m![1])
}

describe('AbuPresence — mouth follows real output amplitude', () => {
  it('loud amplitude while speaking OPENS the mouth (open viseme dominant, closed hidden)', () => {
    const html = render({ state: 'speaking', amplitude: 0.9 })
    expect(mouthOpacity(html, 'mouth-open')).toBe(1)
    expect(mouthOpacity(html, 'mouth-closed')).toBe(0)
  })

  it('mid amplitude shows the MID viseme (a real cross-fade, not just open/closed)', () => {
    const html = render({ state: 'speaking', amplitude: 0.3 })
    expect(mouthOpacity(html, 'mouth-mid')).toBeGreaterThan(0.5)
    expect(mouthOpacity(html, 'mouth-open')).toBeLessThan(0.5)
  })

  it('when she is NOT speaking the mouth is closed (resting smile), whatever the state', () => {
    for (const state of ['listening', 'thinking', 'waiting'] as PresenceState[]) {
      const html = render({ state })
      expect(mouthOpacity(html, 'mouth-closed')).toBe(1)
      expect(mouthOpacity(html, 'mouth-open')).toBe(0)
    }
  })

  it('degrades: speaking with NO analyser still renders (a gentle loop stands in)', () => {
    const html = render({ state: 'speaking' }) // amplitude undefined
    expect(html).toContain('data-testid="abu-presence"')
    expect(html).toContain('id="mouth"')
  })

  // ── device defect 4: a DEAD analyser (iOS reads the remote stream as a defined 0)
  //    must still move the mouth — not sit shut while only the eyes blink ──
  it('shouldDegradeMouth: a defined-0 amplitude with a DEAD analyser degrades (iOS case)', () => {
    expect(shouldDegradeMouth('speaking', 0, true)).toBe(true)      // iOS: defined 0, analyser dead
    expect(shouldDegradeMouth('speaking', undefined, false)).toBe(true) // no analyser at all
  })
  it('shouldDegradeMouth: a LIVE analyser (real signal) drives the real mouth, no loop', () => {
    expect(shouldDegradeMouth('speaking', 0.4, false)).toBe(false)  // desktop: real amplitude wins
    expect(shouldDegradeMouth('speaking', 0, false)).toBe(false)    // pre-grace silence: not yet dead
  })
  it('shouldDegradeMouth: never degrades when she is not speaking', () => {
    for (const s of ['listening', 'thinking', 'waiting'] as PresenceState[]) {
      expect(shouldDegradeMouth(s, undefined, true)).toBe(false)
    }
  })
})

describe('AbuPresence — the four states', () => {
  const states: PresenceState[] = ['listening', 'thinking', 'speaking', 'waiting']
  it('renders each state and tags the container with it', () => {
    for (const state of states) {
      const html = render({ state })
      expect(html).toContain(`data-state="${state}"`)
    }
  })
  it('each state carries a DISTINCT aura colour (no colour-only reliance — a Hebrew label ships too)', () => {
    const auras = states.map((state) => render({ state }))
    // teal / amber / gold / blue must all appear across the set.
    expect(auras.join('\n')).toMatch(/5EEAD4/i) // listening teal
    expect(auras.join('\n')).toMatch(/E8B563/i) // thinking amber
    expect(auras.join('\n')).toMatch(/F0C070/i) // speaking gold
    expect(auras.join('\n')).toMatch(/7DD3FC/i) // waiting blue
  })
})

describe('AbuCharacterA — the swappable asset honours the prop contract', () => {
  it('exposes every required named layer group (asset-swap contract)', () => {
    const html = renderToString(React.createElement(AbuCharacterA, { mouth: 0, eyesClosed: 0 }))
    for (const id of ['hair-back', 'base', 'cheeks', 'brows', 'eyes-open', 'eyelids', 'mouth', 'mouth-closed', 'mouth-mid', 'mouth-open', 'hair-front', 'rim-light']) {
      expect(html, `layer #${id}`).toContain(`id="${id}"`)
    }
  })
  it('eyesClosed drives the lids: 0 = open (scaleY(0)), 1 = shut (scaleY(1))', () => {
    const open = renderToString(React.createElement(AbuCharacterA, { mouth: 0, eyesClosed: 0 }))
    const shut = renderToString(React.createElement(AbuCharacterA, { mouth: 0, eyesClosed: 1 }))
    expect(open).toContain('scaleY(0)')
    expect(shut).toContain('scaleY(1)')
  })
})
