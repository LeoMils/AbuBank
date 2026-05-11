import { describe, it, expect } from 'vitest'
import { buildDailyContentPack } from './dailyContentPack'

describe('buildDailyContentPack — missing data is omitted', () => {
  it('empty input → empty arrays + no calendar/weather', () => {
    const p = buildDailyContentPack({})
    expect(p.calendarSummary).toBeUndefined()
    expect(p.weatherSummary).toBeUndefined()
    expect(p.localIdeas.length).toBe(0)
    expect(p.contentSeeds.length).toBe(0)
    expect(p.conversationSeeds.length).toBe(0)
    expect(p.totalSeeds).toBe(0)
  })
  it('null / undefined / whitespace summaries are dropped', () => {
    const p = buildDailyContentPack({ calendarSummary: '   ', weatherSummary: '' })
    expect(p.calendarSummary).toBeUndefined()
    expect(p.weatherSummary).toBeUndefined()
  })
  it('preserves provided non-empty summaries (trimmed)', () => {
    const p = buildDailyContentPack({ calendarSummary: '  Mor at 10:00  ', weatherSummary: '21°C in Kfar Saba' })
    expect(p.calendarSummary).toBe('Mor at 10:00')
    expect(p.weatherSummary).toBe('21°C in Kfar Saba')
  })
})

describe('buildDailyContentPack — 5-seed cap with even sampling', () => {
  it('caps at 5 total seeds and samples across categories', () => {
    const p = buildDailyContentPack({
      localIdeas:        ['café A', 'café B', 'café C', 'café D'],
      contentSeeds:      ['film X', 'film Y', 'film Z'],
      conversationSeeds: ['memory 1', 'memory 2', 'memory 3'],
    })
    expect(p.totalSeeds).toBe(5)
    expect(p.localIdeas.length).toBeGreaterThanOrEqual(1)
    expect(p.contentSeeds.length).toBeGreaterThanOrEqual(1)
    expect(p.conversationSeeds.length).toBeGreaterThanOrEqual(1)
  })
  it('does not exceed available items', () => {
    const p = buildDailyContentPack({ localIdeas: ['only one'] })
    expect(p.totalSeeds).toBe(1)
    expect(p.localIdeas.length).toBe(1)
  })
  it('de-duplicates case-insensitively', () => {
    const p = buildDailyContentPack({ contentSeeds: ['Cuento', 'cuento', 'CUENTO', 'Podcast'] })
    expect(p.contentSeeds.length).toBe(2)
  })
})
