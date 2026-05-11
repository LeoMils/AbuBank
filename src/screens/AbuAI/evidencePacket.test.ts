import { describe, it, expect } from 'vitest'
import {
  makeOpenEvidence,
  makeNoEvidence,
  makeToolErrorEvidence,
  makeCalendarEvidence,
  makeFamilyEvidence,
  makeContactsEvidence,
  makeWeatherEvidence,
  makeOnlineEvidence,
  hasFacts,
  hasSources,
  isToolFailure,
  requiresEvidence,
} from './evidencePacket'

describe('Evidence constructors', () => {
  it('makeOpenEvidence has kind=open and no facts', () => {
    const p = makeOpenEvidence()
    expect(p.kind).toBe('open')
    expect(hasFacts(p)).toBe(false)
  })
  it('makeNoEvidence has kind=none and low confidence', () => {
    const p = makeNoEvidence('local-calendar')
    expect(p.kind).toBe('none')
    expect(p.confidence).toBe('low')
    expect(hasFacts(p)).toBe(false)
  })
  it('makeToolErrorEvidence is a failure with error message', () => {
    const p = makeToolErrorEvidence('local-calendar', 'storage error')
    expect(isToolFailure(p)).toBe(true)
    expect(p.error).toBe('storage error')
  })
  it('calendar / family / contacts evidence carries facts', () => {
    expect(hasFacts(makeCalendarEvidence(['10:00 רופא']))).toBe(true)
    expect(hasFacts(makeFamilyEvidence(['Leo — הבן שלך']))).toBe(true)
    expect(hasFacts(makeContactsEvidence(['Leo: 050-…']))).toBe(true)
  })
  it('online evidence carries sources only when non-empty', () => {
    const a = makeOnlineEvidence(['hace 22°C'], [{ title: 'meteo.com', url: 'https://x' }])
    const b = makeOnlineEvidence(['hace 22°C'])
    expect(hasSources(a)).toBe(true)
    expect(hasSources(b)).toBe(false)
  })
})

describe('requiresEvidence', () => {
  it('personal + current kinds require evidence', () => {
    expect(requiresEvidence('calendar')).toBe(true)
    expect(requiresEvidence('family')).toBe(true)
    expect(requiresEvidence('contacts')).toBe(true)
    expect(requiresEvidence('weather')).toBe(true)
    expect(requiresEvidence('online')).toBe(true)
  })
  it('open / none / tool_error do not require evidence', () => {
    expect(requiresEvidence('open')).toBe(false)
    expect(requiresEvidence('none')).toBe(false)
    expect(requiresEvidence('tool_error')).toBe(false)
  })
})
