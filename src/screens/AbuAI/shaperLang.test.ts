/*
 * AbuAI B1 — Checkpoint 6: language-aware response shaper.
 *
 * shapeNotFound / shapeToolError accept an optional `lang` hint and
 * return Spanish / English copy without breaking the existing Hebrew
 * default (every legacy call site is untouched).
 */

import { describe, it, expect } from 'vitest'
import { shapeNotFound, shapeToolError } from './responseShaper'

describe('shapeNotFound — language hint', () => {
  it('default (no hint) returns Hebrew (regression)', () => {
    expect(shapeNotFound()).toBe('לא יודעת, אין לי מידע על זה.')
    expect(shapeNotFound('Pepito')).toBe('לא יודעת, אין לי מידע על Pepito.')
  })

  it('lang="he" returns Hebrew', () => {
    expect(shapeNotFound(undefined, 'he')).toBe('לא יודעת, אין לי מידע על זה.')
    expect(shapeNotFound('Pepito', 'he')).toBe('לא יודעת, אין לי מידע על Pepito.')
  })

  it('lang="es" returns Spanish', () => {
    expect(shapeNotFound(undefined, 'es')).toBe('No tengo eso, Martita.')
    expect(shapeNotFound('Pepito', 'es')).toBe('No tengo eso, Martita.')
  })

  it('lang="en" returns English', () => {
    expect(shapeNotFound(undefined, 'en')).toBe('I could not find anything about that.')
    expect(shapeNotFound('Pepito', 'en')).toBe('I could not find anything about Pepito.')
  })

  it('lang="mixed" prefers Hebrew when uncertain', () => {
    expect(shapeNotFound(undefined, 'mixed')).toBe('לא יודעת, אין לי מידע על זה.')
  })
})

describe('shapeToolError — language hint', () => {
  it('default (no hint) returns Hebrew (regression)', () => {
    expect(shapeToolError()).toBe('רגע, משהו תקוע. תנסי שוב עוד רגע.')
  })

  it('lang="es" returns Spanish', () => {
    expect(shapeToolError('es')).toBe('Algo se trabó. Probá de nuevo en un ratito.')
  })

  it('lang="en" returns English', () => {
    expect(shapeToolError('en')).toBe('Something got stuck. Try again in a moment.')
  })

  it('lang="he" returns Hebrew', () => {
    expect(shapeToolError('he')).toBe('רגע, משהו תקוע. תנסי שוב עוד רגע.')
  })

  it('lang="mixed" prefers Hebrew', () => {
    expect(shapeToolError('mixed')).toBe('רגע, משהו תקוע. תנסי שוב עוד רגע.')
  })
})

describe('Hebrew behavior preserved across the existing call surface', () => {
  it('shapeNotFound() always returns the original Hebrew string when called without args', () => {
    // This is the exact contract every legacy call site relies on.
    expect(shapeNotFound()).toBe('לא יודעת, אין לי מידע על זה.')
  })
  it('shapeToolError() always returns the original Hebrew string when called without args', () => {
    expect(shapeToolError()).toBe('רגע, משהו תקוע. תנסי שוב עוד רגע.')
  })
})
