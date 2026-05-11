import { describe, it, expect } from 'vitest'
import { chooseAbuAISource } from './sourceRouter'

describe('chooseAbuAISource — personal tools', () => {
  it('calendar → calendar_tool', () => {
    expect(chooseAbuAISource('¿Qué tengo hoy?').source).toBe('calendar_tool')
    expect(chooseAbuAISource('מה יש לי היום').source).toBe('calendar_tool')
  })
  it('family → family_tool', () => {
    expect(chooseAbuAISource('Háblame de Leo').source).toBe('family_tool')
    expect(chooseAbuAISource('מי זה אופיר').source).toBe('family_tool')
  })
  it('contacts → contacts_tool (when no known family name appears)', () => {
    // Use a non-family phrasing — when a known family name like "לאו"
    // appears, the router intentionally routes to family_tool first.
    expect(chooseAbuAISource('número de teléfono del banco').source).toBe('contacts_tool')
    expect(chooseAbuAISource('מספר הטלפון של הרופאה').source).toBe('contacts_tool')
  })
})

describe('chooseAbuAISource — realtime sources', () => {
  it('weather → weather_api with location-aware', () => {
    const r = chooseAbuAISource('¿Cómo está el clima hoy?')
    expect(r.source).toBe('weather_api')
    expect(r.locationAware).toBe(true)
  })
  it('movies now → online_search with sources required', () => {
    const r = chooseAbuAISource('¿Qué películas hay ahora?')
    expect(r.source).toBe('online_search')
    expect(r.requiresSources).toBe(true)
  })
  it('local activity content world → online_search with location-aware', () => {
    const r = chooseAbuAISource('Algo para hacer', 'local_activity')
    expect(r.source).toBe('online_search')
    expect(r.locationAware).toBe(true)
  })
})

describe('chooseAbuAISource — proactive / open / culture', () => {
  it('vague boredom → proactive_content', () => {
    expect(chooseAbuAISource('Estoy aburrida').source).toBe('proactive_content')
    expect(chooseAbuAISource('No sé de qué hablar').source).toBe('proactive_content')
  })
  it('podcast / story / Italy → open_conversation', () => {
    expect(chooseAbuAISource('Recomendame un podcast').source).toBe('open_conversation')
    expect(chooseAbuAISource('Tell me about Italy').source).toBe('open_conversation')
    expect(chooseAbuAISource('Contame una historia corta').source).toBe('open_conversation')
  })
})

describe('chooseAbuAISource — evidence + source flags', () => {
  it('personal tools require evidence', () => {
    expect(chooseAbuAISource('¿Qué tengo hoy?').requiresEvidence).toBe(true)
    expect(chooseAbuAISource('Háblame de Leo').requiresEvidence).toBe(true)
  })
  it('online search requires evidence AND sources', () => {
    const r = chooseAbuAISource('¿Qué películas hay ahora?')
    expect(r.requiresEvidence).toBe(true)
    expect(r.requiresSources).toBe(true)
  })
  it('open conversation does not require evidence', () => {
    expect(chooseAbuAISource('Recomendame un podcast').requiresEvidence).toBe(false)
  })
})
