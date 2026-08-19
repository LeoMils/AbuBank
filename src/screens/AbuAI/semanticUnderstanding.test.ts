/**
 * AI Semantic Understanding Layer — acceptance tests.
 *
 * The LLM is mocked (injected via opts.sendChat) so the merge + deterministic
 * grounding rules are proven without a network. Every safety rule is asserted:
 * deterministic date/time wins, never invent person/location/time, malformed
 * JSON falls back, low confidence asks, STT slips get corrected by context.
 *
 * Time pinned to 2026-06-24 (Wednesday).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  understandMeetingSemantic,
  parseSemanticJSON,
  mergeUnderstanding,
  type SemanticResult,
} from './semanticUnderstanding'
import { understandMeeting } from './meetingIntelligence'
import type { ServerChatResult } from './serverChatProvider'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d) }

const CTX = { nowISO: FIXED.toISOString(), timezone: 'Asia/Jerusalem', familyNames: ['מור', 'לאו', 'אלכסנדרה'] }

// Build a mock LLM that returns the given object as JSON content.
function mockLLM(payload: object | string): (b: Record<string, unknown>) => Promise<ServerChatResult> {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return async () => ({ ok: true, openai: { choices: [{ message: { content } }] } })
}
function mockLLMError(): (b: Record<string, unknown>) => Promise<ServerChatResult> {
  return async () => ({ ok: false, errorCode: 'OPENAI_API_KEY_MISSING', userMessage: '…' })
}

const FULL: SemanticResult = {
  intent: 'create_meeting', understoodMeaning: 'פגישה עם מור מחר בערב',
  person: 'מור', date: tomorrowStr(), time: '19:00', location: null,
  subject: null, purpose: null, notes: null,
  missingCriticalFields: [], needsClarification: false, clarificationQuestion: null,
  confidence: 0.95, corrections: [],
}

beforeEach(() => {
  const s: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} })
})

describe('parseSemanticJSON — strict validation', () => {
  it('parses a valid object (and tolerates a ```json fence)', () => {
    const r = parseSemanticJSON('```json\n' + JSON.stringify(FULL) + '\n```')
    expect(r).not.toBeNull()
    expect(r!.intent).toBe('create_meeting')
    expect(r!.confidence).toBe(0.95)
  })
  it('rejects malformed JSON', () => {
    expect(parseSemanticJSON('{ not json')).toBeNull()
  })
  it('rejects an unknown intent / missing confidence', () => {
    expect(parseSemanticJSON(JSON.stringify({ ...FULL, intent: 'banana' }))).toBeNull()
    expect(parseSemanticJSON(JSON.stringify({ ...FULL, confidence: 'high' }))).toBeNull()
  })
  it('clamps confidence to [0,1]', () => {
    expect(parseSemanticJSON(JSON.stringify({ ...FULL, confidence: 1.7 }))!.confidence).toBe(1)
  })
})

describe('understandMeetingSemantic — LLM + deterministic merge', () => {
  it('1. mocked LLM JSON → merged structured meeting', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר בשבע בערב', CTX, { sendChat: mockLLM(FULL) })
    expect(m.semanticLayerUsed).toBe(true)
    expect(m.fallbackReason).toBeNull()
    expect(m.draft.person).toBe('מור')
    expect(m.draft.time).toBe('19:00')
    expect(m.needsClarification).toBe(false)
  })

  it('2. malformed LLM JSON → deterministic fallback (calendar not blocked)', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר בשבע בערב', CTX, { sendChat: mockLLM('{ broken') })
    expect(m.semanticLayerUsed).toBe(false)
    expect(m.fallbackReason).toBe('malformed_json')
    expect(m.draft.person).toBe('מור')          // deterministic still works
    expect(m.draft.time).toBe('19:00')
  })

  it('2b. LLM unavailable (key missing) → deterministic fallback with reason', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר בשבע בערב', CTX, { sendChat: mockLLMError() })
    expect(m.semanticLayerUsed).toBe(false)
    expect(m.fallbackReason).toBe('OPENAI_API_KEY_MISSING')
    expect(m.draft.time).toBe('19:00')
  })

  it('3. low LLM confidence (<0.75) → asks clarification, no silent save', async () => {
    const m = await understandMeetingSemantic(
      'תקבעי לי פגישה עם מור מחר בשבע בערב', CTX,
      { sendChat: mockLLM({ ...FULL, confidence: 0.5 }) },
    )
    expect(m.confidence).toBeLessThan(0.75)
    expect(m.needsClarification).toBe(true)
    expect(m.clarificationQuestion).toBeTruthy()
  })

  it('4. deterministic date OVERRIDES a wrong LLM date', async () => {
    const m = await understandMeetingSemantic(
      'תקבעי לי פגישה עם מור מחר בשבע בערב', CTX,
      { sendChat: mockLLM({ ...FULL, date: '2099-01-01' }) },
    )
    expect(m.draft.date).toBe(tomorrowStr())     // deterministic wins
    expect(m.draft.date).not.toBe('2099-01-01')
  })

  it('5. STT correction from context: "הזכיר שכירות" → "השכירות"', async () => {
    const sem = {
      ...FULL, intent: 'create_meeting', person: 'אלכסנדרה', date: null, time: null,
      subject: 'שכירות', notes: 'לדבר על השכירות', confidence: 0.9,
      corrections: [{ heard: 'הזכיר שכירות', understoodAs: 'השכירות', reason: 'rental context' }],
    }
    const m = await understandMeetingSemantic('פגישה עם אלכסנדרה לדבר על הזכיר שכירות', CTX, { sendChat: mockLLM(sem) })
    expect(m.draft.subject).toBe('שכירות')           // LLM fixed the STT slip
    expect(m.draft.notes).toBe('לדבר על השכירות')
    expect(m.corrections).toHaveLength(1)
    expect(m.corrections[0]!.understoodAs).toBe('השכירות')
  })

  it('6. long messy transcript → clean merged event', async () => {
    const raw = 'שמעי, לפני שהדיירים החדשים נכנסים אני חייבת לדבר עם אלכסנדרה על הבית והשכירות, אולי נעשה את זה מחר בערב בקפה גרג ברעננה בשבע'
    const sem = {
      ...FULL, person: 'אלכסנדרה', date: tomorrowStr(), time: '19:00',
      location: 'קפה גרג ברעננה', subject: 'שכירות הבית',
      purpose: 'לדבר על השכירות לפני כניסת הדיירים', notes: 'לדבר על השכירות לפני כניסת הדיירים',
      confidence: 0.92,
    }
    const m = await understandMeetingSemantic(raw, CTX, { sendChat: mockLLM(sem) })
    expect(m.draft.person).toBe('אלכסנדרה')
    expect(m.draft.location).toBe('קפה גרג ברעננה')  // grounded in transcript, time-leak trimmed
    expect(m.draft.subject).toContain('שכירות')
    // The UNDERSTOOD fields are clean summaries — never narrative.
    const NARR = /אולי נעשה|בוא נעשה|^שמעי|אני חייבת/
    expect(m.draft.title ?? '').not.toMatch(NARR)
    expect(m.draft.title).toBe('פגישה עם אלכסנדרה')
    expect(m.draft.notes ?? '').not.toMatch(NARR)
    expect(m.draft.purpose ?? '').not.toMatch(NARR)
    // The transcript itself is preserved only as EVIDENCE.
    expect(m.draft.rawTranscript).toBe(raw)
  })

  it('7. missing time → clarification, time stays empty (never invented)', async () => {
    // LLM tries to supply a time, but the transcript has none → deterministic null wins.
    const m = await understandMeetingSemantic(
      'תקבעי לי פגישה עם מור מחר', CTX,
      { sendChat: mockLLM({ ...FULL, time: '19:00', date: tomorrowStr() }) },
    )
    expect(m.draft.time).toBeNull()                  // never invent time
    expect(m.needsClarification).toBe(true)
    expect(m.clarificationQuestion).toContain('שעה')
  })

  it('8. no location said → location empty even if the LLM invents one', async () => {
    const m = await understandMeetingSemantic(
      'תקבעי לי פגישה עם מור מחר בשבע בערב', CTX,
      { sendChat: mockLLM({ ...FULL, location: 'קפה גרג רעננה' }) }, // not in transcript
    )
    expect(m.draft.location == null).toBe(true)      // never invented
  })

  it('grounding: an LLM person that IS in the transcript is accepted', async () => {
    // deterministic may miss a name; a grounded LLM person is allowed (not invented).
    const det = understandMeeting('קבעי משהו עם אלכסנדרה מחר בשבע בערב')
    const merged = mergeUnderstanding('קבעי משהו עם אלכסנדרה מחר בשבע בערב', det,
      { ...FULL, person: 'אלכסנדרה' }, null)
    expect(merged.draft.person).toBe('אלכסנדרה')
  })

  it('grounding: an LLM person NOT in the transcript and NOT family is rejected', () => {
    const det = understandMeeting('תקבעי לי משהו מחר בשבע בערב')
    const merged = mergeUnderstanding('תקבעי לי משהו מחר בשבע בערב', det,
      { ...FULL, person: 'ויקטור' }, null) // invented, not in transcript / family
    expect(merged.draft.person == null).toBe(true)
  })
})
