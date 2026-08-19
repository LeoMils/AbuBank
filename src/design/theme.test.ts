/*
 * theme.test.ts — the themeable palette (CODE). Proves condition 1: the product can
 * flip dark⇄light by ONE attribute, and no token is a hard-coded colour.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { t, PAGE_BG, setTheme, getTheme, toggleTheme } from './theme'

describe('tokens are CSS variables (themeable, not hard-coded)', () => {
  it('every token is a var(--abu-*) reference', () => {
    for (const v of Object.values(t)) expect(v).toMatch(/^var\(--abu-/)
    expect(PAGE_BG).toContain('var(--abu-bg')
  })
})

describe('theme switch = one attribute, no rebuild', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const g = globalThis as any
  afterEach(() => { delete g.document; delete g.localStorage })
  function fakeDom() {
    const attrs: Record<string, string> = {}
    const store: Record<string, string> = {}
    g.document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v }, getAttribute: (k: string) => attrs[k] ?? null } }
    g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } }
    return { attrs, store }
  }

  it('setTheme sets data-abu-theme + persists; getTheme reads it; toggle flips', () => {
    const { attrs, store } = fakeDom()
    setTheme('day')
    expect(attrs['data-abu-theme']).toBe('day')
    expect(store['abu-theme']).toBe('day')
    expect(getTheme()).toBe('day')
    expect(toggleTheme()).toBe('night')
    expect(getTheme()).toBe('night')
    /* eslint-enable @typescript-eslint/no-explicit-any */
  })

  it('defaults to Night Garden with no DOM (safe outside the browser)', () => {
    expect(getTheme()).toBe('night')
    expect(() => setTheme('day')).not.toThrow()
  })
})
