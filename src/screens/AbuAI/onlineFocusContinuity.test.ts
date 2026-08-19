import { describe, it, expect } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME, finalizeExternalAnswer, type RuntimeState } from './cognitiveRuntime'

const ctx = { messages: [] as Array<{ role: string; content: string }>, now: new Date('2026-06-24T20:00:00') }

describe('ONLINE FOCUS continuity (isolated runtime)', () => {
  it('finalizing an online answer sets an online focus', () => {
    const d = finalizeExternalAnswer(IDLE_RUNTIME, 'בכפר סבא 29 מעלות, שמש.', {
      intent: 'online', topic: 'מה מזג האוויר בכפר סבא',
      online: { ok: true, query: 'מה מזג האוויר בכפר סבא', summary: 'שמש' },
    })
    expect(d.state.focus?.kind).toBe('online')
    expect(d.state.focus?.label).toContain('מזג האוויר')
  })

  it('a bare "ומחר?" with an active online focus continues online (not calendar)', () => {
    const state: RuntimeState = { ...IDLE_RUNTIME, focus: { kind: 'online', label: 'מה מזג האוויר בכפר סבא' } }
    const d = runCognitiveTurn(state, 'ומחר?', ctx)
    // Must route to the online tool, never the calendar reader.
    expect(d.intent).not.toBe('calendar_read')
    expect(d.needsOnline).toBe(true)
    expect(d.online?.query).toContain('מזג האוויר')
    expect(d.online?.query).toContain('מחר')
  })

  it('a bare "ומחר?" with NO focus is untouched (does not spuriously go online)', () => {
    const d = runCognitiveTurn(IDLE_RUNTIME, 'ומחר?', ctx)
    expect(d.needsOnline).not.toBe(true)
  })
})
