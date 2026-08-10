/*
 * hub.test.ts — the Abu-ela hub routing contract (CODE).
 * Locks the app list + order AND the hard constraint: Abu AI opens the LIVE path,
 * never the deprecated legacy AbuAI screen. If someone re-points Abu AI at a screen,
 * these fail.
 */
import { describe, it, expect, vi } from 'vitest'
import { HUB_APPS, openLiveAbu } from './hub'
import { Screen } from '../../state/types'

describe('Abu-ela hub — the family of apps', () => {
  it('lists exactly the seven Abu apps in the specified order', () => {
    expect(HUB_APPS.map((a) => a.id)).toEqual(['ai', 'bank', 'calendar', 'whatsapp', 'games', 'weather', 'news'])
  })
  it('every app carries the Abu brand label and an accent colour', () => {
    for (const a of HUB_APPS) {
      expect(a.hebrewLabel).toContain('Abu')
      expect(a.accent).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

describe('Abu AI routes to the LIVE path (cutover guard — must not regress)', () => {
  it('the Abu AI entry is a live action, structurally NOT any screen', () => {
    const ai = HUB_APPS.find((a) => a.id === 'ai')!
    expect(ai.action.kind).toBe('live')
    expect(JSON.stringify(ai.action)).not.toContain('screen')
    expect(JSON.stringify(ai.action)).not.toContain('AbuAI')
  })

  it('openLiveAbu() calls the live overlay opener the App exposes', () => {
    const spy = vi.fn()
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const g = globalThis as any
    const prev = g.window
    g.window = { __abubankOpenLive: spy }
    openLiveAbu()
    expect(spy).toHaveBeenCalledTimes(1)
    g.window = prev
  })

  it('openLiveAbu() is a safe no-op if the opener is not present', () => {
    const g = globalThis as any
    const prev = g.window
    g.window = {}
    expect(() => openLiveAbu()).not.toThrow()
    g.window = prev
    /* eslint-enable @typescript-eslint/no-explicit-any */
  })
})

describe('the other hub apps route to their in-app screens', () => {
  const expected: Record<string, Screen> = {
    bank: Screen.AbuBank, calendar: Screen.AbuCalendar, whatsapp: Screen.AbuWhatsApp,
    games: Screen.AbuGames, weather: Screen.AbuWeather, news: Screen.AbuNews,
  }
  for (const [id, screen] of Object.entries(expected)) {
    it(`${id} → ${screen}`, () => {
      const a = HUB_APPS.find((x) => x.id === id)!
      expect(a.action).toEqual({ kind: 'screen', screen })
    })
  }
})
