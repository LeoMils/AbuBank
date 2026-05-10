/*
 * AbuAI proactive layer tests (B1 — Checkpoint 2)
 *
 * Pins the contract:
 *   - boredom / no_topic / loneliness / ideas detected per language
 *   - rotation avoids exact duplicate via previousSeedId
 *   - no seed contains forbidden childish / patronising / therapy phrases
 *   - non-trigger inputs return null (so proactive never fires on
 *     calendar / family / open culture)
 */

import { describe, it, expect } from 'vitest'
import {
  detectLanguage,
  detectIntent,
  getProactiveSeed,
  hasForbiddenTone,
  __ALL_SEEDS__,
} from './proactive'

describe('detectLanguage', () => {
  it('Hebrew text → he', () => {
    expect(detectLanguage('אני משועממת')).toBe('he')
  })
  it('Spanish text → es', () => {
    expect(detectLanguage('Estoy aburrida')).toBe('es')
  })
  it('English text → en', () => {
    expect(detectLanguage("I'm bored")).toBe('en')
  })
  it('Hebrew + Spanish → mixed', () => {
    expect(detectLanguage('משועממת hoy')).toBe('mixed')
  })
})

describe('detectIntent', () => {
  it('Spanish boredom', () => {
    expect(detectIntent('Estoy aburrida')).toBe('boredom')
    expect(detectIntent('Me aburro')).toBe('boredom')
  })
  it('Spanish no-topic', () => {
    expect(detectIntent('No sé de qué hablar')).toBe('no_topic')
    expect(detectIntent('No sé qué hacer')).toBe('no_topic')
  })
  it('Spanish loneliness', () => {
    expect(detectIntent('Hoy me siento un poco sola')).toBe('loneliness')
    expect(detectIntent('Estoy sola')).toBe('loneliness')
  })
  it('Spanish ideas', () => {
    expect(detectIntent('Dame ideas para hacer algo hoy')).toBe('ideas')
  })
  it('Hebrew boredom', () => {
    expect(detectIntent('אני משועממת')).toBe('boredom')
    expect(detectIntent('משעמם לי')).toBe('boredom')
  })
  it('Hebrew no-topic', () => {
    expect(detectIntent('אין לי על מה לדבר')).toBe('no_topic')
  })
  it('Hebrew loneliness', () => {
    expect(detectIntent('אני מרגישה לבד')).toBe('loneliness')
    expect(detectIntent('קצת לבד')).toBe('loneliness')
  })
  it('Hebrew ideas', () => {
    expect(detectIntent('תני לי רעיון')).toBe('ideas')
    expect(detectIntent('מה אפשר לעשות היום')).toBe('ideas')
  })
  it('English boredom', () => {
    expect(detectIntent("I'm bored")).toBe('boredom')
  })
  it('non-proactive returns null', () => {
    expect(detectIntent('¿Qué tengo hoy?')).toBeNull()
    expect(detectIntent('Háblame de Leo')).toBeNull()
    expect(detectIntent('Recomendame un podcast')).toBeNull()
    expect(detectIntent('מה יש לי היום')).toBeNull()
  })
})

describe('getProactiveSeed — adult tone, language-aware', () => {
  it('Spanish "Estoy aburrida" → adult Spanish boredom seed', () => {
    const r = getProactiveSeed('Estoy aburrida')
    expect(r).not.toBeNull()
    expect(r!.lang).toBe('es')
    expect(r!.intent).toBe('boredom')
    expect(r!.text.length).toBeGreaterThan(20)
  })

  it('Spanish "No sé de qué hablar" → adult Spanish no_topic seed', () => {
    const r = getProactiveSeed('No sé de qué hablar')
    expect(r).not.toBeNull()
    expect(r!.lang).toBe('es')
    expect(r!.intent).toBe('no_topic')
  })

  it('Spanish "Hoy me siento un poco sola" → warm non-diagnostic seed', () => {
    const r = getProactiveSeed('Hoy me siento un poco sola')
    expect(r).not.toBeNull()
    expect(r!.lang).toBe('es')
    expect(r!.intent).toBe('loneliness')
    // Anti-therapy: must not contain therapy-form openers.
    expect(/¿c[oó]mo te hace sentir/i.test(r!.text)).toBe(false)
    // Adult: must not start with "Muy bien".
    expect(r!.text.toLowerCase().startsWith('muy bien')).toBe(false)
  })

  it('Hebrew "אני משועממת" → adult Hebrew boredom seed', () => {
    const r = getProactiveSeed('אני משועממת')
    expect(r).not.toBeNull()
    expect(r!.lang).toBe('he')
    expect(r!.intent).toBe('boredom')
  })

  it('English "I\'m bored" → adult English boredom seed (or fallback)', () => {
    const r = getProactiveSeed("I'm bored")
    expect(r).not.toBeNull()
    expect(r!.intent).toBe('boredom')
  })

  it('non-proactive input returns null', () => {
    expect(getProactiveSeed('¿Qué tengo hoy?')).toBeNull()
    expect(getProactiveSeed('Háblame de Leo')).toBeNull()
    expect(getProactiveSeed('Recomendame un podcast')).toBeNull()
    expect(getProactiveSeed('Hello')).toBeNull()
    expect(getProactiveSeed('')).toBeNull()
  })
})

describe('rotation via previousSeedId', () => {
  it('repeated boredom in Spanish does not return the same seed twice', () => {
    const a = getProactiveSeed('Estoy aburrida')
    expect(a).not.toBeNull()
    const b = getProactiveSeed('Estoy aburrida', { previousSeedId: a!.id })
    expect(b).not.toBeNull()
    expect(b!.id).not.toBe(a!.id)
  })

  it('three consecutive boredoms in Spanish yield three distinct seeds', () => {
    const seen = new Set<string>()
    let prev: string | null = null
    for (let i = 0; i < 3; i++) {
      const r = getProactiveSeed('Estoy aburrida', { previousSeedId: prev })
      expect(r).not.toBeNull()
      seen.add(r!.id)
      prev = r!.id
    }
    expect(seen.size).toBe(3)
  })

  it('repeated boredom in Hebrew does not return the same seed twice', () => {
    const a = getProactiveSeed('אני משועממת')
    expect(a).not.toBeNull()
    const b = getProactiveSeed('אני משועממת', { previousSeedId: a!.id })
    expect(b).not.toBeNull()
    expect(b!.id).not.toBe(a!.id)
  })
})

describe('tone constitution — every committed seed', () => {
  it('no seed contains forbidden childish / patronising / therapy phrases', () => {
    for (const s of __ALL_SEEDS__) {
      expect(hasForbiddenTone(s.text), `seed ${s.id}: ${s.text}`).toBe(false)
    }
  })

  it('every intent + lang combination has at least one seed where rotation is required', () => {
    // Coverage spot-check: at least 2 seeds for ES boredom / HE boredom / ES loneliness
    const filter = (intent: string, lang: string) =>
      __ALL_SEEDS__.filter((s) => s.intent === intent && s.lang === lang).length
    expect(filter('boredom', 'es')).toBeGreaterThanOrEqual(2)
    expect(filter('boredom', 'he')).toBeGreaterThanOrEqual(2)
    expect(filter('loneliness', 'es')).toBeGreaterThanOrEqual(2)
  })

  it('hasForbiddenTone correctly flags childish phrases (sanity)', () => {
    expect(hasForbiddenTone('Muy bien, princesa')).toBe(true)
    expect(hasForbiddenTone('כל הכבוד על השאלה')).toBe(true)
    expect(hasForbiddenTone('Good job!')).toBe(true)
    expect(hasForbiddenTone('Mirá, podemos hacer algo lindo.')).toBe(false)
  })
})
