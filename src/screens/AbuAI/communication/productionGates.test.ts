/*
 * AbuAI Communication — Production Acceptance Gates (synthetic, privacy-safe).
 * Every contact/number here is SYNTHETIC. No real family data is used.
 * Runs in the repo's `node` env — we inject a tiny in-memory localStorage so the
 * device-local contact store is readable (no jsdom needed).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from '../executiveCognitiveController'
import { IDLE_RUNTIME } from '../cognitiveRuntime'
import type { FullTurnTools } from '../runtimeFullTurn'
import {
  detectWhatsAppTurn, understandWhatsAppCommand, refineIntentSemantics,
  composeWhatsAppMessage, verifyDraft, localCompose, STYLE_BLOCKS,
  type WhatsAppTurn,
} from '../whatsappCompose'
import { buildCommunicationAction } from './capability'
import { getAdapter } from './registry'

// HERMETIC (fixes O-FLAKE): the comment below ASSUMES providers are unreachable in unit
// tests — but that broke once VITE_GROQ_API_KEY landed in .env: composeWhatsAppMessageDetailed
// then made REAL Groq/openai-server calls (20s timeouts) that flaked under parallel load.
// Enforce the assumption by failing the network fast → deterministic local composer. No retries.
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('unit test: network disabled') })))
afterEach(() => vi.unstubAllGlobals())

// Providers are never reachable in unit tests → deterministic local composer.
const TOOLS: FullTurnTools = { llm: async () => '[LLM_UNUSED]', online: async () => ({ ok: true, answer: '' }) }
const NOW = new Date(2026, 6, 31, 10, 0, 0)
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
const turn = (text: string) => ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, text, ctx(), TOOLS)

const KEY = 'abubank.familyContacts.v1'
const SYN_PHONE = '+972500000001' // synthetic

beforeAll(() => {
  const store = new Map<string, string>()
  const mockLS = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: () => null, length: 0,
  }
  ;(globalThis as any).window = { localStorage: mockLS }
  ;(globalThis as any).localStorage = mockLS
  mockLS.setItem(KEY, JSON.stringify({ v: 2, contacts: [{ id: 'mor', enabled: true, phoneE164: SYN_PHONE }] }))
})
afterAll(() => { delete (globalThis as any).window; delete (globalThis as any).localStorage })

describe('Gate 1-3 · CALL', () => {
  it('1: call intent → generic call CommunicationAction', async () => {
    const r = await turn('תתקשרי למור')
    expect(r.intent).toBe('whatsapp')
    expect(r.action?.capability).toBe('communication')
    expect(r.action?.mode).toBe('call')
    expect(r.action?.channel).toBe('phone')
    // Truthful lead from the ONE response-truth policy — prepares, never claims it started.
    expect(r.display).toMatch(/מכינה שיחה|אין מספר/)
    expect(r.display).not.toMatch(/התקשרתי|השיחה בוצעה/)
  })
  it('2: phone adapter builds the correct sanitized tel: handoff', () => {
    const h = getAdapter('phone')!.buildHandoff('מור', '')
    expect(h.url).toBe('tel:+972500000001')
  })
  it('3: no auto-call — the Action is only a descriptor (no dial side effect)', async () => {
    const r = await turn('תתקשרי למור')
    expect(r.action?.action).toBe('handoff')
    expect(JSON.stringify(r.action)).not.toContain('tel:')  // no URL/number in the Action
    expect(r.sideEffect ?? null).toBeNull()
  })
})

describe('Gate 4-5 · routing', () => {
  it('4: a WhatsApp message containing a date is NOT routed to Calendar', async () => {
    const r = await turn('תכתבי למור שמחר בערב אני אביא קולה')
    expect(r.intent).toBe('whatsapp')
    expect(r.action?.mode).toBe('message')
    expect(r.display).not.toMatch(/אין כלום ביומן/)
  })
  it('5: a real calendar command stays a calendar command', async () => {
    const r = await turn('תקבעי פגישה עם מור מחר בשלוש')
    expect(r.intent).not.toBe('whatsapp')
    expect(r.action ?? null).toBeNull()
  })
})

describe('Gate 6-8 · recipient resolution', () => {
  it('6: Hebrew prefixes resolve the intended contact', () => {
    expect(detectWhatsAppTurn('תכתבי למור שלום')?.targetHebrew).toBe('מור')
    expect(detectWhatsAppTurn('תתקשרי למור')?.targetHebrew).toBe('מור')
    expect(understandWhatsAppCommand('שלחי למורי נשיקות').targetHebrew).toBe('מור') // alias
  })
  it('7: an ambiguous/unknown recipient triggers ONE specific clarification', async () => {
    const a = await buildCommunicationAction(detectWhatsAppTurn('תכתבי לאדד שלום')!) // STT-ish misspelling
    expect(a.action).toBe('clarify')
    expect(a.clarify?.field).toBe('recipient')
  })
  it('8: missing telephone and missing WhatsApp are handled separately', () => {
    // "יעל" exists in the scaffold but has NO saved number here.
    const tel = getAdapter('phone')!.buildHandoff('יעל', '')
    const wa = getAdapter('whatsapp')!.buildHandoff('יעל', 'שלום')
    expect(tel.url).toBeNull(); expect(tel.reason).toBe('no_phone')
    expect(wa.url).toBeNull(); expect(wa.reason).toBe('no_whatsapp')
  })
})

describe('Gate 9-12 · meaning & fact safety', () => {
  it('9: a long message preserves beginning, middle and end', () => {
    const c = understandWhatsAppCommand('תכתבי למור שאני מגיעה בשמונה בערב לבית של יעל ואביא סלט ועוגה ואם אני מתעכבת אני אודיע')
    const msg = localCompose(c, { recipientLabel: 'מור' })
    expect(msg).toContain('שמונה')  // beginning fact
    expect(msg).toContain('סלט')    // middle fact
    expect(msg).toContain('אודיע')  // end fact
  })
  it('10: a self-correction retains only the final value', () => {
    expect(refineIntentSemantics('מגיעה בארבע סליחה בחמש').text).toContain('בחמש')
    expect(refineIntentSemantics('מגיעה בארבע סליחה בחמש').text).not.toContain('בארבע')
  })
  it('11: negated/retracted content is removed', () => {
    const out = refineIntentSemantics('תכתבי על הטרקטור בעצם אל תזכירי את הטרקטור').text
    expect(out).not.toContain('טרקטור')
  })
  it('12: uncertainty / conditions / promises are preserved', () => {
    const c = understandWhatsAppCommand('תכתבי למור שאולי אגיע בסביבות שבע ואם ירד גשם אודיע לה')
    const msg = localCompose(c, { recipientLabel: 'מור' })
    expect(msg).toContain('אולי')
    expect(msg).toMatch(/אם/)
    expect(msg).toContain('אודיע')
  })
})

describe('Gate 13-16 · style, verification, byte-exact handoff', () => {
  it('13: the Martita Default Style is the default voice (not clean AI)', () => {
    expect(understandWhatsAppCommand('תכתבי למור שלום').style).toBe('normal')
    expect(STYLE_BLOCKS.normal).toContain('הקול האמיתי של מרטיטה')
  })
  it('14: style transforms preserve every material fact', async () => {
    for (const style of ['normal', 'funny', 'abu'] as const) {
      const c = { ...understandWhatsAppCommand('תכתבי למור שאני מגיעה ב-8'), style }
      const msg = localCompose(c, { recipientLabel: 'מור' })
      expect(msg).toContain('8')
      expect(verifyDraft(c, msg).ok).toBe(true)
    }
  })
  it('15: the verified draft reaches the adapter byte-for-byte before encoding', () => {
    const draft = 'מור, מגיעה ב-8:30!! מביאה עוגה 🎂\nשורה שנייה & עוד'
    const h = getAdapter('whatsapp')!.buildHandoff('מור', draft)
    const decoded = decodeURIComponent(h.url!.split('?text=')[1]!)
    expect(decoded).toBe(draft)
  })
  it('16: Hebrew, line breaks, punctuation and emoji survive the handoff', () => {
    const draft = 'שלום 👋\nמה שלומך?\nנתראה! 🎉'
    const url = getAdapter('whatsapp')!.buildHandoff('מור', draft).url!
    expect(url).not.toContain(' ')                     // spaces encoded
    expect(decodeURIComponent(url.split('?text=')[1]!)).toBe(draft)
  })
})

describe('Gate 18-22 · parity, privacy, resilience, UX', () => {
  it('18: typed and voice produce equivalent intent + Action shape', async () => {
    // Parity is asserted on the DETERMINISTIC command/plan (the composer itself
    // is stochastic when a provider is reachable — equal drafts are not the claim).
    const t = detectWhatsAppTurn('תכתבי למור שמחר אני אביא קולה', { source: 'text' })
    const v = detectWhatsAppTurn('תכתבי למור שמחר אני אביא קולה', { source: 'voice' })
    expect(t?.command?.intent).toBe(v?.command?.intent)
    expect(t?.targetHebrew).toBe(v?.targetHebrew)
    expect(t?.command?.style).toBe(v?.command?.style)
    expect(t?.command?.plan).toEqual(v?.command?.plan)
    const at = await buildCommunicationAction(t!); const av = await buildCommunicationAction(v!)
    expect(at.mode).toBe(av.mode)
    expect(at.channel).toBe(av.channel)
    expect(at.recipient.name).toBe(av.recipient.name)
  })
  it('19: private numbers + message content never enter the Action', async () => {
    const a = await buildCommunicationAction(detectWhatsAppTurn('תכתבי למור שמחר אני אביא קולה')!)
    expect(JSON.stringify(a)).not.toMatch(/\+?\d{7,}/) // no phone-shaped digits
  })
  it('20: a failed handoff preserves the full draft and offers a fallback reason', async () => {
    const a = await buildCommunicationAction(detectWhatsAppTurn('תכתבי ליעל שמחר אני אביא קולה')!)
    expect(a.draft.text.length).toBeGreaterThan(0)         // draft not lost
    expect(a.recipient.canHandoff).toBe(false)             // no number → UI shows copy/retry
    expect(getAdapter('whatsapp')!.buildHandoff('יעל', a.draft.text).reason).toBe('no_whatsapp')
  })
  it('21: the clear path has no redundant confirmation (one action, no card, not review)', async () => {
    const r = await turn('תכתבי למור שמחר אני אביא קולה')
    // Truthful message lead: ready + opens WhatsApp + not sent until Send.
    expect(r.display).toMatch(/מוכנה|WhatsApp/)
    expect(r.display).not.toMatch(/שלחתי|נשלח/)          // no auto-send claim
    expect(r.display).not.toMatch(/בטוח|לשלוח\?|את בטוחה/)
    expect(r.action?.review ?? false).toBe(false)          // no editable card by default
  })
  it('22: an explicit review request allows editing before handoff', () => {
    const c = understandWhatsAppCommand('תכתבי למור שמחר אני אביא קולה, תראי לי לפני')
    expect(c.wantsReview).toBe(true)
  })
})
