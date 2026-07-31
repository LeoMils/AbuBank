import { describe, it, expect } from 'vitest'
import { buildCommunicationAction, communicationLead } from './capability'
import { getAdapter, listAdapters } from './registry'
import { detectWhatsAppTurn, understandWhatsAppCommand, type WhatsAppTurn } from '../whatsappCompose'
import { ExecutiveCognitiveController } from '../executiveCognitiveController'
import { IDLE_RUNTIME } from '../cognitiveRuntime'
import type { FullTurnTools } from '../runtimeFullTurn'

const TOOLS: FullTurnTools = { llm: async () => '[LLM_UNUSED]', online: async () => ({ ok: true, answer: '' }) }
const NOW = new Date(2026, 6, 31, 10, 0, 0)
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })

// ════════════════════════════════════════════════════════════════════════════
// Registry — channel adapters are pluggable; WhatsApp is the first
// ════════════════════════════════════════════════════════════════════════════
describe('channel adapter registry', () => {
  it('has the WhatsApp adapter registered', () => {
    const a = getAdapter('whatsapp')
    expect(a).not.toBeNull()
    expect(a!.id).toBe('whatsapp')
    expect(a!.primaryActionLabel).toBeTruthy()
    expect(listAdapters().some(x => x.channel === 'whatsapp')).toBe(true)
  })
  it('WhatsApp adapter refuses a handoff with no saved number (never invents one)', () => {
    const h = getAdapter('whatsapp')!.buildHandoff('מור', 'שלום מור')
    expect(h.url).toBeNull()          // no phone seeded → cannot open
    expect(h.reason).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// buildCommunicationAction — verified, channel-agnostic handoff Action
// ════════════════════════════════════════════════════════════════════════════
describe('buildCommunicationAction', () => {
  it('produces a verified handoff Action for a compose turn', async () => {
    const turn = detectWhatsAppTurn('תכתבי למור שמחר בערב אני אביא קולה')!
    const action = await buildCommunicationAction(turn)
    expect(action.capability).toBe('communication')
    expect(action.action).toBe('handoff')
    expect(action.channel).toBe('whatsapp')
    expect(action.adapter).toBe('whatsapp')
    expect(action.primaryActionLabel).toBe('פתחי בוואטסאפ')
    expect(action.recipient.name).toBe('מור')
    expect(typeof action.recipient.canHandoff).toBe('boolean')
    expect(action.draft.text.length).toBeGreaterThan(0)
    expect(action.draft.text).toContain('קולה')      // fact preserved in the draft
    expect(action.verification.ok).toBe(true)
    // The Action is PURE DATA — no phone number leaks into it.
    expect(JSON.stringify(action)).not.toMatch(/\+?\d{7,}/)
  })

  it('asks for the message when the recipient is known but the message is empty', async () => {
    const turn = detectWhatsAppTurn('תכתבי למור')!
    const action = await buildCommunicationAction(turn)
    expect(action.action).toBe('clarify')
    expect(action.clarify?.field).toBe('intent')
    expect(communicationLead(action)).toContain('מה לכתוב')
  })

  it('asks for the recipient when none is named', async () => {
    const turn: WhatsAppTurn = { kind: 'compose', targetName: null, targetHebrew: null, command: understandWhatsAppCommand('מזל טוב') }
    const action = await buildCommunicationAction(turn)
    expect(action.action).toBe('clarify')
    expect(action.clarify?.field).toBe('recipient')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// End-to-end: the executive controller returns the Action for a compose turn
// ════════════════════════════════════════════════════════════════════════════
describe('ExecutiveCognitiveController — communication action flows out of the runtime', () => {
  it('"תכתבי למור שמחר בערב אני אביא קולה" → result.action handoff (not calendar)', async () => {
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תכתבי למור שמחר בערב אני אביא קולה', ctx(), TOOLS)
    expect(r.intent).toBe('whatsapp')
    expect(r.source).not.toBe('llm')
    expect(r.action).toBeTruthy()
    expect(r.action!.capability).toBe('communication')
    expect(r.action!.channel).toBe('whatsapp')
    expect(r.action!.draft.text).toContain('קולה')
    expect(r.display).toContain('מור')                 // the lead line
    expect(r.display).not.toMatch(/אין כלום ביומן/)     // never a calendar answer
  })

  it('a normal calendar read carries NO communication action', async () => {
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מה יש לי מחר', ctx(), TOOLS)
    expect(r.action ?? null).toBeNull()
  })
})
