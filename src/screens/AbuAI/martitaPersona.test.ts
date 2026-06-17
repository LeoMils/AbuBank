import { describe, it, expect } from 'vitest'
import {
  MARTITA_PERSONA_PROSE,
  FORBIDDEN_PHRASES,
  hasForbiddenPersonaTone,
  getMartitaPersona,
} from './martitaPersona'

describe('Martita persona prose', () => {
  it('exposes HE / ES / EN / mixed variants', () => {
    expect(MARTITA_PERSONA_PROSE.he.length).toBeGreaterThan(40)
    expect(MARTITA_PERSONA_PROSE.es.length).toBeGreaterThan(40)
    expect(MARTITA_PERSONA_PROSE.en.length).toBeGreaterThan(40)
    expect(MARTITA_PERSONA_PROSE.mixed.length).toBeGreaterThan(40)
  })
  it('committed prose has no forbidden phrases', () => {
    for (const lang of ['he', 'es', 'en', 'mixed'] as const) {
      expect(hasForbiddenPersonaTone(MARTITA_PERSONA_PROSE[lang]), `lang=${lang}`).toBe(false)
    }
  })
  it('mentions content worlds (podcast / film / music / cooking)', () => {
    for (const lang of ['he', 'es', 'en'] as const) {
      const t = MARTITA_PERSONA_PROSE[lang].toLowerCase()
      expect(/podcast|פודקאסט|pódcast/.test(t)).toBe(true)
      expect(/film|série|series|serie|סרט|película|película/i.test(MARTITA_PERSONA_PROSE[lang])).toBe(true)
    }
  })
  it('forbids princesa / muy bien / כל הכבוד / good job', () => {
    expect(FORBIDDEN_PHRASES).toContain('princesa')
    expect(FORBIDDEN_PHRASES).toContain('muy bien, ')
    expect(FORBIDDEN_PHRASES).toContain('כל הכבוד')
    expect(FORBIDDEN_PHRASES).toContain('good job')
  })
})

describe('hasForbiddenPersonaTone', () => {
  it('flags childish / patronising openers', () => {
    expect(hasForbiddenPersonaTone('Muy bien, mi princesa')).toBe(true)
    expect(hasForbiddenPersonaTone('כל הכבוד על השאלה')).toBe(true)
    expect(hasForbiddenPersonaTone('Good job!')).toBe(true)
  })
  it('flags therapy openers', () => {
    expect(hasForbiddenPersonaTone('How does that make you feel?')).toBe(true)
  })
  it('passes adult tone', () => {
    expect(hasForbiddenPersonaTone('Mirá, podemos hacer algo lindo.')).toBe(false)
    expect(hasForbiddenPersonaTone('תקשיבי, יש לי משהו חמוד.')).toBe(false)
  })
})

describe('getMartitaPersona', () => {
  it('returns HE by default', () => {
    expect(getMartitaPersona().includes('MartitAI')).toBe(true)
  })
  it('returns ES for lang=es', () => {
    expect(getMartitaPersona('es').toLowerCase()).toContain('martitai')
  })
})
