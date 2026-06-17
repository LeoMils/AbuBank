import { describe, it, expect } from 'vitest'
import { chooseCheapRealtimeSource } from './realtimeCheapSourceRouter'

describe('chooseCheapRealtimeSource', () => {
  it('weather → weather_api (free, location-aware)', () => {
    const r = chooseCheapRealtimeSource('¿Cómo está el clima hoy?')
    expect(r.source).toBe('weather_api')
    expect(r.realtime).toBe(true)
    expect(r.locationAware).toBe(true)
    expect(r.costBand).toBe('free')
  })
  it('calendar → calendar_tool (free)', () => {
    const r = chooseCheapRealtimeSource('¿Qué tengo hoy?')
    expect(r.source).toBe('calendar_tool')
    expect(r.costBand).toBe('free')
  })
  it('family → family_tool (free)', () => {
    const r = chooseCheapRealtimeSource('Háblame de Leo')
    expect(r.source).toBe('family_tool')
    expect(r.costBand).toBe('free')
  })
  it('movies now → online_search (paid)', () => {
    const r = chooseCheapRealtimeSource('¿Qué películas hay ahora en el cine?')
    expect(r.source).toBe('online_search')
    expect(r.costBand).toBe('paid')
  })
  it('local activity content world → online_search location-aware', () => {
    const r = chooseCheapRealtimeSource('Algo para hacer', 'local_activity')
    expect(r.source).toBe('online_search')
    expect(r.locationAware).toBe(true)
  })
  it('open conversation → none (no realtime needed)', () => {
    const r = chooseCheapRealtimeSource('Recomendame un podcast')
    expect(r.source).toBe('none')
    expect(r.realtime).toBe(false)
  })
})
