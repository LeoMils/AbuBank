/*
 * repeatLookupGuard.test.ts — DEVICE P0: never repeat the same failed name lookup twice in a session.
 * "טוצ'י" was heard as "טורקי" and looked up + failed BOTH times. The second failure must escalate
 * (ask her to spell it / say who in the family), not run the identical failing lookup again.
 */
import { describe, it, expect } from 'vitest'
import { LiveTools, type LiveCalendarStore, type LiveEvent } from './liveTools'

function memStore(): LiveCalendarStore {
  const items: LiveEvent[] = []; let n = 0
  return { list: () => items.slice(), add: (e) => { const ev = { ...e, id: `e${++n}` }; items.push(ev); return ev }, update: (id, p) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...p }; return items[i]! } }
}

/** Call people_lookup want=who for a name and return the parsed tool output. */
function lookup(tools: LiveTools, sent: Array<Record<string, unknown>>, name: string, callId: string): { status?: string } {
  sent.length = 0
  tools.handleFunctionCall({ name: 'people_lookup', callId, argsJson: JSON.stringify({ want: 'who', person: name }) })
  const out = sent.find((e) => e.type === 'conversation.item.create')
  return JSON.parse((out!.item as { output: string }).output) as { status?: string }
}

describe('session repeat-lookup guard', () => {
  it('a NAME that fails twice escalates on the second try (never the same failed lookup again)', () => {
    const sent: Array<Record<string, unknown>> = []
    const tools = new LiveTools((e) => sent.push(e), memStore())
    // "טורקי" is not a person (the misheard "טוצ'י"). First lookup → suggest/not_found.
    const first = lookup(tools, sent, 'טורקי', 'c1')
    expect(['suggest', 'not_found']).toContain(first.status)
    // Second identical failing lookup → escalate, do NOT repeat the same miss.
    const second = lookup(tools, sent, 'טורקי', 'c2')
    expect(second.status).toBe('ask_different')
  })

  it('a DIFFERENT failing name is still a first-time miss (guard is per-name)', () => {
    const sent: Array<Record<string, unknown>> = []
    const tools = new LiveTools((e) => sent.push(e), memStore())
    lookup(tools, sent, 'טורקי', 'c1')
    const other = lookup(tools, sent, 'קשקושמיליון', 'c2') // a different non-name, first time
    expect(other.status).not.toBe('ask_different')
  })

  it('a real name that RESOLVES is never affected by the guard', () => {
    const sent: Array<Record<string, unknown>> = []
    const tools = new LiveTools((e) => sent.push(e), memStore())
    const r1 = lookup(tools, sent, 'מור', 'c1')
    const r2 = lookup(tools, sent, 'מור', 'c2')
    expect(r1.status).toBe('ok'); expect(r2.status).toBe('ok') // resolves both times, no escalation
  })
})
