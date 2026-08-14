import { describe, it, expect, beforeEach } from 'vitest'
import { LiveTools, type LiveCalendarStore, type LiveEvent } from './liveTools'
import { buildSessionUpdate } from './liveSession'
import { clearMemories, loadMemories } from '../screens/AbuAI/savedMemory'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'

function memStore(): LiveCalendarStore {
  const items: LiveEvent[] = []; let n = 0
  return { list: () => items.slice(), add: (e) => { const ev = { ...e, id: `e${++n}` }; items.push(ev); return ev }, update: (id, p) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...p }; return items[i]! } }
}
function fire(fact: string) {
  const sent: Array<Record<string, unknown>> = []
  const tools = new LiveTools((e) => sent.push(e), memStore())
  tools.handleFunctionCall({ name: 'remember', callId: `c${Math.random()}`, argsJson: JSON.stringify({ fact }) } as ParsedFunctionCall)
  const item = sent.find((e) => e.type === 'conversation.item.create')?.item as { output?: string } | undefined
  return JSON.parse(item?.output ?? '{}') as Record<string, unknown>
}

beforeEach(() => clearMemories())

describe('remember tool — durable, cross-session, never "I cannot update"', () => {
  it('the tool is registered on the live path', () => {
    expect(LiveTools.owns('remember')).toBe(true)
  })

  it('a death is saved durably and Abu confirms — never says she cannot update', () => {
    const o = fire('כאצ׳ו נפטר')
    expect(o.status).toBe('saved')
    expect(loadMemories().some((m) => m.text.includes('כאצ׳ו'))).toBe(true)
    const say = JSON.stringify(o.allowed_to_say)
    expect(say).toMatch(/NEVER say you cannot update/i)
  })

  it('a new family member is saved', () => {
    const o = fire('ללידיה ונוח יש שני בנים, אריאל ומרטין')
    expect(o.status).toBe('saved')
    expect(loadMemories().some((m) => m.text.includes('אריאל'))).toBe(true)
  })

  it('a duplicate is acknowledged, not re-saved', () => {
    fire('עדי הוא הבן של לאו')
    const o2 = fire('עדי הוא הבן של לאו')
    expect(o2.status).toBe('already_known')
    expect(loadMemories().filter((m) => m.text.includes('עדי')).length).toBe(1)
  })

  it('a sensitive fact (phone) is declined at the privacy boundary, gently', () => {
    const o = fire('הטלפון שלי הוא 050-1234567')
    expect(o.status).toBe('declined_sensitive')
    expect(loadMemories().length).toBe(0)
  })

  it('PERSISTENCE: a saved fact is injected into the NEXT session instructions', () => {
    fire('כאצ׳ו נפטר')
    const update = buildSessionUpdate(Date.parse('2026-08-14T09:00:00')) as { session: { instructions: string } }
    expect(update.session.instructions).toContain('כאצ׳ו')
    expect(update.session.instructions).toContain('Martita')
  })

  it('with nothing saved, the session instructions carry no memory block', () => {
    const update = buildSessionUpdate(Date.parse('2026-08-14T09:00:00')) as { session: { instructions: string } }
    expect(update.session.instructions).not.toContain('דברים ש-Martita ביקשה שתזכרי')
  })
})
