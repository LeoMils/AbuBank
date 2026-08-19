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

  it('a sensitive fact (phone) is declined — reports the category, NEVER "cannot update" (issue ii)', () => {
    const o = fire('הטלפון שלי הוא 050-1234567')
    expect(o.status).toBe('declined_sensitive')
    expect(o.declined).toBe('phone')
    expect(loadMemories().length).toBe(0)
    const say = JSON.stringify(o.allowed_to_say)
    // the ORIGINAL defect ("I cannot update anything") is explicitly forbidden here
    expect(say).toMatch(/FORBIDDEN from saying you cannot update/i)
    expect(say).toMatch(/remember everything else/i)
  })
  it('ongoing medical detail is kept private, but a DEATH (grief) is remembered (issue ii)', () => {
    const med = fire('אבא לוקח תרופה ללחץ דם כל בוקר')
    expect(med.status).toBe('declined_sensitive')
    expect(med.declined).toBe('medical')
    const death = fire('כאצ׳ו נפטר')
    expect(death.status).toBe('saved') // grief/life facts persist
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

  it('memory injection is BOUNDED and recency-first (issue i)', async () => {
    const { formatSavedMemoriesForLLM } = await import('../screens/AbuAI/savedMemory')
    // Save many facts; the newest must appear, the oldest must drop, under the budget.
    for (let i = 0; i < 60; i++) fire(`עובדה מספר ${i} עם קצת טקסט כדי לתפוס מקום בזיכרון`)
    const block = formatSavedMemoriesForLLM(undefined, { maxChars: 800 })
    expect(block.length).toBeLessThanOrEqual(800)
    expect(block).toContain('עובדה מספר 59') // newest kept
    expect(block).not.toContain('עובדה מספר 0') // oldest dropped
    expect(block).toMatch(/ועוד \d+ דברים ישנים/) // honest note about what was dropped
  })
})
