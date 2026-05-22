import { describe, it, expect } from 'vitest'
import { chooseContentWorld } from './contentWorldEngine'

describe('chooseContentWorld — vague prompts offer content worlds', () => {
  it('empty input → open_chat with gentle options', () => {
    const r = chooseContentWorld('')
    expect(r.contentMode).toBe('open_chat')
    expect(r.gentleOptions.length).toBeGreaterThanOrEqual(2)
    expect(r.suggestedOpening.length).toBeGreaterThan(0)
    expect(r.needsRealtime).toBe(false)
  })
  it('"hola" → open_chat, falls through to LLM (no passive seed)', () => {
    const r = chooseContentWorld('hola')
    expect(r.contentMode).toBe('open_chat')
    expect(r.language).toBe('es')
    expect(r.suggestedOpening).toBe('')
    expect(r.gentleOptions.length).toBe(0)
  })
  it('"no sé" → open_chat, falls through to LLM (no passive seed)', () => {
    const r = chooseContentWorld('No sé')
    expect(r.contentMode).toBe('open_chat')
    expect(r.suggestedOpening).toBe('')
    expect(r.gentleOptions.length).toBe(0)
  })
  it('Hebrew "שלום" → open_chat with gentle options', () => {
    const r = chooseContentWorld('שלום')
    expect(r.contentMode).toBe('open_chat')
    expect(r.language).toBe('he')
  })
})

describe('chooseContentWorld — boredom offers companionship', () => {
  it('"Estoy aburrida" → open_chat with options (no overwhelm)', () => {
    const r = chooseContentWorld('Estoy aburrida')
    expect(r.contentMode).toBe('open_chat')
    expect(r.gentleOptions.length).toBeLessThanOrEqual(3)
    expect(r.suggestedOpening.length).toBeGreaterThan(0)
  })
  it('"אני משועממת" → open_chat with HE options', () => {
    const r = chooseContentWorld('אני משועממת')
    expect(r.contentMode).toBe('open_chat')
    expect(r.language).toBe('he')
  })
})

describe('chooseContentWorld — content cues route correctly', () => {
  it('current films → film_series with realtime + sources', () => {
    const r = chooseContentWorld('¿Qué películas hay ahora en el cine?')
    expect(r.contentMode).toBe('film_series')
    expect(r.needsRealtime).toBe(true)
    expect(r.needsSources).toBe(true)
  })
  it('film recommendation (no "now") → film_series WITHOUT realtime', () => {
    const r = chooseContentWorld('Recomendame una película')
    expect(r.contentMode).toBe('film_series')
    expect(r.needsRealtime).toBe(false)
  })
  it('podcast → podcast (no realtime)', () => {
    const r = chooseContentWorld('Recomendame un podcast')
    expect(r.contentMode).toBe('podcast')
    expect(r.needsRealtime).toBe(false)
  })
  it('music → music', () => {
    const r = chooseContentWorld('Quiero escuchar música')
    expect(['music', 'podcast'].includes(r.contentMode)).toBe(true)
  })
  it('"qué hacemos hoy" → local_activity with realtime', () => {
    const r = chooseContentWorld('Qué hacemos hoy')
    expect(r.contentMode).toBe('local_activity')
    expect(r.needsRealtime).toBe(true)
  })
  it('"latest news" → news_world with realtime', () => {
    const r = chooseContentWorld('Últimas noticias')
    expect(r.contentMode).toBe('news_world')
    expect(r.needsRealtime).toBe(true)
  })
  it('"contame algo interesante" → curious_facts', () => {
    const r = chooseContentWorld('Contame algo interesante')
    expect(r.contentMode).toBe('curious_facts')
    expect(r.needsRealtime).toBe(false)
  })
  it('"adivinanza" → riddles_games', () => {
    const r = chooseContentWorld('Una adivinanza')
    expect(r.contentMode).toBe('riddles_games')
  })
  it('"empanadas" → cooking', () => {
    const r = chooseContentWorld('Receta de empanadas')
    expect(r.contentMode).toBe('cooking')
  })
  it('"poema" → theatre_poetry', () => {
    const r = chooseContentWorld('Léeme un poema')
    expect(r.contentMode).toBe('theatre_poetry')
  })
  it('"me acuerdo de Buenos Aires" → memories', () => {
    const r = chooseContentWorld('Me acuerdo de Buenos Aires')
    expect(r.contentMode).toBe('memories')
  })
})

describe('chooseContentWorld — never overwhelms', () => {
  it('returns at most 3 gentle options', () => {
    const inputs = ['Estoy aburrida', 'Hola', 'No sé', 'Recomendame un podcast', 'Qué hacemos hoy']
    for (const t of inputs) {
      const r = chooseContentWorld(t)
      expect(r.gentleOptions.length, t).toBeLessThanOrEqual(3)
    }
  })
})
