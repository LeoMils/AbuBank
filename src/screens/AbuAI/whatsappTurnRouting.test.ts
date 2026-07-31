import { describe, it, expect } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME } from './cognitiveRuntime'
import { detectWhatsAppTurn } from './whatsappCompose'
import { buildWhatsAppReply } from './whatsappTurn'

const CTX = { messages: [] as Array<{ role: string; content: string }>, now: new Date('2026-07-27T10:00:00') }
const run = (text: string) => runCognitiveTurn(IDLE_RUNTIME, text, CTX)

// ════════════════════════════════════════════════════════════════════════════
// The reported bug: a WhatsApp/call request with a DATE in the message body must
// NOT be swallowed by the calendar. Controller owns it ahead of calendar.
// ════════════════════════════════════════════════════════════════════════════
describe('runCognitiveTurn — WhatsApp/call precedence over calendar', () => {
  it('"תכתבי למור שמחר בערב אני אביא קוקה קולה" → whatsapp compose, NOT calendar', () => {
    const d = run('תכתבי למור שמחר בערב אני אביא קוקה קולה')
    expect(d.whatsapp).toBeTruthy()
    expect(d.whatsapp!.kind).toBe('compose')
    expect(d.whatsapp!.targetHebrew).toBe('מור')       // name extracted (prefix-safe)
    expect(d.intent).toBe('whatsapp')
    expect(d.intent).not.toBe('calendar_read')          // the exact bug
    expect(d.handled).toBe(false)                       // caller composes async
    expect(d.needsLLM).toBe(false)                      // no LLM hallucination
    expect(d.whatsapp!.command?.intent).toContain('קולה')
  })

  it('"שלחי וואטסאפ למור..." → whatsapp compose with the recipient', () => {
    const d = run('שלחי וואטסאפ למור תגידי שמחר בערב אני אביא קולה')
    expect(d.whatsapp?.kind).toBe('compose')
    expect(d.whatsapp?.targetHebrew).toBe('מור')
    expect(d.intent).toBe('whatsapp')
  })

  it('"תתקשרי למור" → call turn with the name filled (was blank before)', () => {
    const d = run('תתקשרי למור')
    expect(d.whatsapp?.kind).toBe('call')
    expect(d.whatsapp?.targetHebrew).toBe('מור')
    expect(d.intent).toBe('whatsapp')
  })

  it('does NOT hijack a real calendar read', () => {
    const d = run('מה יש לי מחר')
    expect(d.whatsapp ?? null).toBeNull()
    expect(d.intent).toBe('calendar_read')
  })

  it('does NOT hijack a calendar create', () => {
    const d = run('תקבעי לי פגישה עם מור מחר בשלוש')
    expect(d.whatsapp ?? null).toBeNull()
    expect(d.intent).not.toBe('whatsapp')
  })

  it('does NOT hijack a calendar create that embeds a note "…ותכתבי להביא…"', () => {
    // "תכתבי ל…" here is a calendar NOTE, not a message to a person.
    const d = run('תקבעי פגישה עם מור מחר בשלוש ותכתבי להביא תעודת זהות')
    expect(d.whatsapp ?? null).toBeNull()
    expect(d.intent).not.toBe('whatsapp')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// detectWhatsAppTurn — the single detector both modalities use (parity)
// ════════════════════════════════════════════════════════════════════════════
describe('detectWhatsAppTurn', () => {
  it('compose vs call vs none', () => {
    expect(detectWhatsAppTurn('תכתבי למור שלום')?.kind).toBe('compose')
    expect(detectWhatsAppTurn('תתקשרי למור')?.kind).toBe('call')
    expect(detectWhatsAppTurn('מה השעה')).toBeNull()
  })
  it('is source-tagged for parity', () => {
    expect(detectWhatsAppTurn('תכתבי למור שלום', { source: 'voice' })?.command?.source).toBe('voice')
    expect(detectWhatsAppTurn('תכתבי למור שלום', { source: 'text' })?.command?.source).toBe('text')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// buildWhatsAppReply — inline reply (compose draft / call hand-off)
// ════════════════════════════════════════════════════════════════════════════
describe('buildWhatsAppReply', () => {
  it('call turn names the person and never mentions the calendar', async () => {
    const r = await buildWhatsAppReply({ kind: 'call', targetName: 'למור', targetHebrew: 'מור', command: null })
    expect(r.text).toContain('מור')
    expect(r.text).toContain('להתקשר')
    expect(r.text).not.toMatch(/יומן|ביומן/)
    expect(r.draft).toBeNull()
  })

  it('compose turn drafts a fact-preserving message and points to WhatsApp (no calendar)', async () => {
    const turn = detectWhatsAppTurn('תכתבי למור שמחר בערב אני אביא קולה')!
    const r = await buildWhatsAppReply(turn)
    expect(r.draft && r.draft.length).toBeGreaterThan(0)
    expect(r.text).toContain('מור')
    expect(r.text).toContain('קולה')          // the fact survives
    expect(r.text).toContain('וואטסאפ')       // directs to WhatsApp, not calendar
    expect(r.text).not.toMatch(/אין כלום ביומן/)
  })

  it('compose turn with no message asks what to write', async () => {
    const r = await buildWhatsAppReply({ kind: 'compose', targetName: 'מור', targetHebrew: 'מור', command: detectWhatsAppTurn('תכתבי למור')?.command ?? null })
    expect(r.text).toMatch(/מה לכתוב|למי לכתוב/)
  })
})
