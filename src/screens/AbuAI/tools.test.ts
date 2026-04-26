import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  searchFamily,
  getFamilyContext,
  getTodayEvents,
  getTomorrowEvents,
  getWeekEvents,
  findEventsByPerson,
  findNextEventByType,
  executeTool,
  TOOL_DEFINITIONS,
} from './tools'

describe('searchFamily', () => {
  it('finds Mor by Hebrew name', () => {
    const r = searchFamily('מור')
    expect(r.found).toBe(true)
    expect(r.answer).toContain('הבת')
  })

  it('finds Ofir by Hebrew name', () => {
    const r = searchFamily('אופיר')
    expect(r.found).toBe(true)
    expect(r.answer).toContain('נכד')
    expect(r.answer).toContain('גלעד')
  })

  it('finds Papi by alias', () => {
    const r = searchFamily('פפי')
    expect(r.found).toBe(true)
    expect(r.answer).toContain('ז"ל')
  })

  it('finds Papi by Pepe alias', () => {
    const r = searchFamily('Pepe')
    expect(r.found).toBe(true)
  })

  it('unknown person returns not found', () => {
    const r = searchFamily('יוסי')
    expect(r.found).toBe(false)
    expect(r.answer).toContain('לא מכירה')
  })

  it('empty query returns error', () => {
    const r = searchFamily('')
    expect(r.found).toBe(false)
  })

  it('partial match works', () => {
    const r = searchFamily('אילון')
    expect(r.found).toBe(true)
    expect(r.answer).toContain('נכד')
  })

  it('finds Tutsi the dog', () => {
    const r = searchFamily('טוטסי')
    expect(r.found).toBe(true)
    expect(r.answer).toContain('כלב')
  })
})

describe('getFamilyContext', () => {
  it('returns family overview with children and grandchildren', () => {
    const ctx = getFamilyContext()
    expect(ctx).toContain('מור')
    expect(ctx).toContain('לאו')
    expect(ctx).toContain('אופיר')
    expect(ctx).toContain('נכדים')
  })
})

describe('calendar tools', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('getTodayEvents returns empty for no events', () => {
    const r = getTodayEvents()
    expect(r.events).toHaveLength(0)
    expect(r.summary).toContain('לא מצאתי')
  })

  it('getTomorrowEvents returns empty for no events', () => {
    const r = getTomorrowEvents()
    expect(r.events).toHaveLength(0)
    expect(r.summary).toContain('לא מצאתי')
  })

  it('getWeekEvents returns empty for no events', () => {
    const r = getWeekEvents()
    expect(r.summary).toContain('לא מצאתי')
  })

  it('findEventsByPerson returns empty for unknown person', () => {
    const r = findEventsByPerson('יוסי הדמיוני')
    expect(r.events).toHaveLength(0)
    expect(r.summary).toContain('לא מצאתי')
  })

  it('findEventsByPerson finds family birthdays', () => {
    const r = findEventsByPerson('אופיר')
    expect(r.events.length).toBeGreaterThan(0)
    expect(r.summary).toContain('אופיר')
  })

  it('findNextEventByType returns empty when no match', () => {
    const r = findNextEventByType('medical')
    expect(r.event).toBeNull()
    expect(r.summary).toContain('לא מצאתי')
  })
})

describe('executeTool', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('executes get_today_events', () => {
    const r = executeTool('get_today_events', {})
    expect(r).toContain('לא מצאתי')
  })

  it('executes search_family_info', () => {
    const r = executeTool('search_family_info', { query: 'מור' })
    expect(r).toContain('הבת')
  })

  it('executes get_family_context', () => {
    const r = executeTool('get_family_context', {})
    expect(r).toContain('מור')
  })

  it('unknown tool returns error', () => {
    const r = executeTool('nonexistent', {})
    expect(r).toContain('לא מוכר')
  })
})

describe('TOOL_DEFINITIONS', () => {
  it('has 7 tools defined', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(7)
  })

  it('all tools have name and description', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.function.name).toBeTruthy()
      expect(tool.function.description).toBeTruthy()
    }
  })

  it('personal query tools are present', () => {
    const names = TOOL_DEFINITIONS.map(t => t.function.name)
    expect(names).toContain('get_today_events')
    expect(names).toContain('get_tomorrow_events')
    expect(names).toContain('get_week_events')
    expect(names).toContain('search_family_info')
    expect(names).toContain('find_next_event_by_type')
  })
})
