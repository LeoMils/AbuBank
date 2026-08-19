/*
 * commCardDedup.test.ts — E3 (card half): the SAME card must not be re-announced. Device: the Mor
 * call card appeared twice. A second identical prepare returns 'already_on_screen', not a new card.
 */
import { describe, it, expect } from 'vitest'
import { LiveTools, type LiveCalendarStore, type LiveEvent } from './liveTools'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'

function memStore(): LiveCalendarStore {
  const items: LiveEvent[] = []; let n = 0
  return { list: () => items.slice(), add: (e) => { const ev = { ...e, id: `e${++n}` }; items.push(ev); return ev }, update: (id, p) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...p }; return items[i]! } }
}
function tools() {
  const sent: Array<Record<string, unknown>> = []
  return { t: new LiveTools((e) => sent.push(e), memStore()), sent }
}
const outputs = (sent: Array<Record<string, unknown>>) =>
  sent.filter((e) => e.type === 'conversation.item.create').map((e) => JSON.parse(((e.item as { output?: string }).output) ?? '{}'))

describe('a card already on screen is not re-announced', () => {
  it('phone_call to מור twice → second is already_on_screen (no duplicate card)', () => {
    const { t, sent } = tools()
    t.handleFunctionCall({ name: 'phone_call', callId: 'c1', argsJson: JSON.stringify({ recipient: 'מור' }) } as ParsedFunctionCall)
    t.handleFunctionCall({ name: 'phone_call', callId: 'c2', argsJson: JSON.stringify({ recipient: 'מור' }) } as ParsedFunctionCall)
    const outs = outputs(sent)
    expect(outs[0]?.status).toBe('READY_TO_CALL')
    expect(outs[1]?.status).toBe('already_on_screen')
  })

  it('a DIFFERENT message text to the same person is a new, legitimate card', () => {
    const { t, sent } = tools()
    t.handleFunctionCall({ name: 'whatsapp_draft', callId: 'm1', argsJson: JSON.stringify({ recipient: 'לאו', message: 'אני אאחר' }) } as ParsedFunctionCall)
    t.handleFunctionCall({ name: 'whatsapp_draft', callId: 'm2', argsJson: JSON.stringify({ recipient: 'לאו', message: 'אני כבר מגיעה' }) } as ParsedFunctionCall)
    const outs = outputs(sent)
    expect(outs[0]?.status).toBe('READY_TO_SEND')
    expect(outs[1]?.status).toBe('READY_TO_SEND') // different message → not a duplicate
  })
})
