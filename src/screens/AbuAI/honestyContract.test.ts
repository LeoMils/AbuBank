/*
 * AbuAI B1 — Checkpoint 4: live-info honesty + multilingual claim guards.
 */

import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT, containsUngroundedClaim } from './service'

describe('SYSTEM_PROMPT — live-info honesty (HE / ES / EN)', () => {
  // B2: the offline-only honesty clause was replaced with a tool-aware
  // one. AbuAI now HAS an online tool — so the prompt tells the LLM to
  // use the tool when it returned data, fall back honestly when it did
  // not, and never invent live facts.
  it('Hebrew clause says use the online tool and never invent live info', () => {
    expect(SYSTEM_PROMPT.includes('כלי חיפוש אונליין')).toBe(true)
    expect(SYSTEM_PROMPT.includes('אל תמציאי')).toBe(true)
  })
  it('Spanish clause mentions the online tool and forbids invention', () => {
    expect(SYSTEM_PROMPT.includes('herramienta online')).toBe(true)
    expect(SYSTEM_PROMPT.toLowerCase().includes('nunca inventes')).toBe(true)
  })
  it('English clause mentions the online tool and forbids invention', () => {
    expect(SYSTEM_PROMPT.includes('online tool')).toBe(true)
    expect(SYSTEM_PROMPT.includes('Never invent current information')).toBe(true)
  })
  it('live-info section sits BEFORE the safety section so it is not stripped on truncation', () => {
    const liveIdx = SYSTEM_PROMPT.indexOf('מידע חי / live info')
    const safetyIdx = SYSTEM_PROMPT.indexOf('═══ בטיחות ═══')
    expect(liveIdx).toBeGreaterThan(-1)
    expect(safetyIdx).toBeGreaterThan(-1)
    expect(liveIdx).toBeLessThan(safetyIdx)
  })
})

describe('containsUngroundedClaim — Spanish patterns', () => {
  it('flags "Tienes cita a las 5"', () => {
    expect(containsUngroundedClaim('Tienes cita a las 5', false)).toBe(true)
  })
  it('flags "Tenés turno con el médico"', () => {
    expect(containsUngroundedClaim('Tenés turno con el médico', false)).toBe(true)
  })
  it('flags "Hoy tienes médico"', () => {
    expect(containsUngroundedClaim('Hoy tienes médico', false)).toBe(true)
  })
  it('flags "En tu calendario aparece..."', () => {
    expect(containsUngroundedClaim('En tu calendario aparece una reunión', false)).toBe(true)
  })
  it('does NOT flag a normal Spanish reply that has no claim', () => {
    expect(containsUngroundedClaim('No puedo comprobarlo ahora.', false)).toBe(false)
    expect(containsUngroundedClaim('No lo encontré.', false)).toBe(false)
  })
  it('does NOT flag when a tool actually ran (hadToolCall=true)', () => {
    expect(containsUngroundedClaim('Tienes cita a las 5', true)).toBe(false)
  })
})

describe('containsUngroundedClaim — English patterns', () => {
  it('flags "You have an appointment tomorrow"', () => {
    expect(containsUngroundedClaim('You have an appointment tomorrow', false)).toBe(true)
  })
  it('flags "Today you have a doctor visit"', () => {
    expect(containsUngroundedClaim('Today you have a doctor visit', false)).toBe(true)
  })
  it('flags "In your calendar there is a meeting"', () => {
    expect(containsUngroundedClaim('In your calendar there is a meeting', false)).toBe(true)
  })
  it('flags "According to your calendar..."', () => {
    expect(containsUngroundedClaim('According to your calendar there is a doctor at 5pm', false)).toBe(true)
  })
  it('does NOT flag honest English fallback', () => {
    expect(containsUngroundedClaim("I cannot check that right now.", false)).toBe(false)
    expect(containsUngroundedClaim("I don't have live access today.", false)).toBe(false)
  })
})

describe('Hebrew claim guards remain functional (regression)', () => {
  it('flags "יש לך תור לרופא"', () => {
    expect(containsUngroundedClaim('יש לך תור לרופא מחר', false)).toBe(true)
  })
  it('does NOT flag honest Hebrew fallback', () => {
    expect(containsUngroundedClaim('אני לא מצליחה לבדוק את זה כרגע.', false)).toBe(false)
  })
})
