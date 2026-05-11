import { describe, it, expect } from 'vitest'
import { shouldAskFollowUp } from './humanFollowUp'

describe('shouldAskFollowUp — allowed paths', () => {
  it('open_conversation → allowed', () => {
    const r = shouldAskFollowUp({ source: 'open_conversation', evidenceKind: 'open' })
    expect(r.allowed).toBe(true)
  })
  it('proactive_content → allowed', () => {
    const r = shouldAskFollowUp({ source: 'proactive_content', evidenceKind: 'open' })
    expect(r.allowed).toBe(true)
  })
  it('online_search after concise answer → allowed (one follow-up)', () => {
    const r = shouldAskFollowUp({ source: 'online_search', evidenceKind: 'online' })
    expect(r.allowed).toBe(true)
  })
  it('weather_api after concise answer → allowed', () => {
    const r = shouldAskFollowUp({ source: 'weather_api', evidenceKind: 'weather' })
    expect(r.allowed).toBe(true)
  })
})

describe('shouldAskFollowUp — blocked paths', () => {
  it('calendar factual answer → blocked', () => {
    const r = shouldAskFollowUp({ source: 'calendar_tool', evidenceKind: 'calendar' })
    expect(r.allowed).toBe(false)
  })
  it('family factual answer → blocked', () => {
    const r = shouldAskFollowUp({ source: 'family_tool', evidenceKind: 'family' })
    expect(r.allowed).toBe(false)
  })
  it('contact action → blocked', () => {
    const r = shouldAskFollowUp({ source: 'contacts_tool', evidenceKind: 'contacts' })
    expect(r.allowed).toBe(false)
  })
  it('tool error → blocked regardless of source', () => {
    const r = shouldAskFollowUp({ source: 'online_search', evidenceKind: 'tool_error', hadFailure: true })
    expect(r.allowed).toBe(false)
  })
  it('API missing → blocked', () => {
    const r = shouldAskFollowUp({ source: 'online_search', evidenceKind: 'online', apiMissing: true })
    expect(r.allowed).toBe(false)
  })
  it('safety/urgent → blocked', () => {
    const r = shouldAskFollowUp({ source: 'open_conversation', evidenceKind: 'open', isSafetyOrUrgent: true })
    expect(r.allowed).toBe(false)
  })
  it('practical_help → blocked by default', () => {
    const r = shouldAskFollowUp({ source: 'practical_help', evidenceKind: 'none' })
    expect(r.allowed).toBe(false)
  })
})
