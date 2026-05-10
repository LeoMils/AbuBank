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
    expect(shapeNotFound()).toBe('לא מצאתי מידע על זה.')
    expect(shapeNotFound('Pepito')).toBe('לא מצאתי מידע על Pepito.')
  })

  it('lang="he" returns Hebrew', () => {
    expect(shapeNotFound(undefined, 'he')).toBe('לא מצאתי מידע על זה.')
    expect(shapeNotFound('Pepito', 'he')).toBe('לא מצאתי מידע על Pepito.')
  })

  it('lang="es" returns Spanish', () => {
    expect(shapeNotFound(undefined, 'es')).toBe('No lo encontré.')
    expect(shapeNotFound('Pepito', 'es')).toBe('No lo encontré (Pepito).')
  })

  it('lang="en" returns English', () => {
    expect(shapeNotFound(undefined, 'en')).toBe('I could not find anything about that.')
    expect(shapeNotFound('Pepito', 'en')).toBe('I could not find anything about Pepito.')
  })

  it('lang="mixed" prefers Hebrew when uncertain', () => {
    expect(shapeNotFound(undefined, 'mixed')).toBe('לא מצאתי מידע על זה.')
  })
})

describe('shapeToolError — language hint', () => {
  it('default (no hint) returns Hebrew (regression)', () => {
    expect(shapeToolError()).toBe('אני לא מצליחה לבדוק את זה כרגע. נסי שוב.')
  })

  it('lang="es" returns Spanish', () => {
    expect(shapeToolError('es')).toBe('No puedo comprobarlo ahora. Probá de nuevo en un rato.')
  })

  it('lang="en" returns English', () => {
    expect(shapeToolError('en')).toBe('I cannot check that right now. Please try again in a moment.')
  })

  it('lang="he" returns Hebrew', () => {
    expect(shapeToolError('he')).toBe('אני לא מצליחה לבדוק את זה כרגע. נסי שוב.')
  })

  it('lang="mixed" prefers Hebrew', () => {
    expect(shapeToolError('mixed')).toBe('אני לא מצליחה לבדוק את זה כרגע. נסי שוב.')
  })
})

describe('Hebrew behavior preserved across the existing call surface', () => {
  it('shapeNotFound() always returns the original Hebrew string when called without args', () => {
    // This is the exact contract every legacy call site relies on.
    expect(shapeNotFound()).toBe('לא מצאתי מידע על זה.')
  })
  it('shapeToolError() always returns the original Hebrew string when called without args', () => {
    expect(shapeToolError()).toBe('אני לא מצליחה לבדוק את זה כרגע. נסי שוב.')
  })
})
