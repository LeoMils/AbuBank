/*
 * P1 · understanding-first intake.
 *   • The LLM half is MOCK-proven here (injected transport) — dictation-corruption
 *     recovery is the transport's contract; this layer validates + grounds it.
 *   • The deterministic half (groundIntent) is CODE-proven: person refs resolve
 *     through the ONE seam, dates/times through the real date engine, nothing invented.
 * The live wiring + real-provider latency is PREVIEW-class and intentionally NOT
 * asserted here.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeIntent, interpretUtterance, groundIntent, groundingLine, makeInterpretTransport,
  type StructuredIntent, type InterpretTransport,
} from './understandingIntake'

/** A fake /api/abuai-chat response carrying the model's JSON content. */
function mockChatFetch(intentJson: unknown): typeof fetch {
  return (async () => ({
    json: async () => ({ ok: true, openai: { choices: [{ message: { content: JSON.stringify(intentJson) } }] } }),
  })) as unknown as typeof fetch
}

const base: StructuredIntent = {
  operation: 'chat', personRefs: [], dateWords: null, timeWords: null, place: null,
  title: null, fact: null, correction: null, confirmation: null, ambiguousQuestion: null,
}

describe('P1 · normalizeIntent coerces arbitrary model JSON safely (never throws / invents)', () => {
  it('malformed payload → operation:unknown, empty fields', () => {
    const si = normalizeIntent('not json at all')
    expect(si.operation).toBe('unknown')
    expect(si.personRefs).toEqual([])
    expect(si.fact).toBeNull()
  })
  it('null → unknown', () => { expect(normalizeIntent(null).operation).toBe('unknown') })
  it('an unknown operation value degrades to unknown', () => {
    expect(normalizeIntent({ operation: 'launch_missiles' }).operation).toBe('unknown')
  })
  it('keeps only well-formed fields; drops junk personRefs + malformed fact', () => {
    const si = normalizeIntent({ operation: 'calendar_create', personRefs: ['מור', 42, '', 'החתן של מור'], fact: { kind: 'work' } })
    expect(si.personRefs).toEqual(['מור', 'החתן של מור'])
    expect(si.fact).toBeNull() // value missing → dropped, not fabricated
  })
  it('valid confirmation passes; invalid confirmation → null', () => {
    expect(normalizeIntent({ operation: 'chat', confirmation: 'yes' }).confirmation).toBe('yes')
    expect(normalizeIntent({ operation: 'chat', confirmation: 'maybe' }).confirmation).toBeNull()
  })
})

describe('P1 · interpretUtterance (injected transport — MOCK)', () => {
  it('returns the validated intent the transport produced', async () => {
    const transport: InterpretTransport = async () => ({ ...base, operation: 'calendar_create', personRefs: ['בת הזוג של מור'], dateWords: 'מחר', timeWords: 'בשלוש' })
    const si = await interpretUtterance('...', transport)
    expect(si.operation).toBe('calendar_create')
    expect(si.personRefs).toEqual(['בת הזוג של מור'])
  })
  it('a transport failure degrades to unknown (caller falls back, no crash)', async () => {
    const transport: InterpretTransport = async () => { throw new Error('provider down') }
    expect((await interpretUtterance('...', transport)).operation).toBe('unknown')
  })
  it('dictation-corruption recovery is honored: transport returns the MEANING, layer grounds it', async () => {
    // The corrupted transcript "תקבע עם החתן של מור מחרר בשלוש" is recovered by the
    // transport into a clean structured intent; the layer then grounds it deterministically.
    const transport: InterpretTransport = async () => ({ ...base, operation: 'calendar_create', personRefs: ['החתן של מור'], dateWords: 'מחר', timeWords: 'בשלוש אחר הצהריים' })
    const g = groundIntent(await interpretUtterance('תקבע עם החתן של מור מחרר בשלוש', transport))
    expect(g.people).toEqual(['גלעד'])
    expect(g.time).toBe('15:00')
    expect(g.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('P1 · groundIntent resolves through the real engines (deterministic, never invents)', () => {
  it('person refs (relation phrase + name) resolve via the seam; non-kin stays unresolved', () => {
    const g = groundIntent({ ...base, operation: 'calendar_create', personRefs: ['החתן של מור', 'מרטיטה', 'הכלב של מור'] })
    expect(g.people).toEqual(['גלעד', 'מרטיטה'])
    expect(g.unresolvedRefs).toEqual(['הכלב של מור']) // dog → never invented as a person
  })
  it('date + time validate through the date engine', () => {
    const g = groundIntent({ ...base, dateWords: 'מחר', timeWords: 'בשלוש אחר הצהריים' })
    expect(g.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(g.time).toBe('15:00')
    expect(g.timeAmbiguous).toBe(false)
  })
  it('an unparseable date/time stays null (no guessing)', () => {
    const g = groundIntent({ ...base, dateWords: 'מתישהו', timeWords: null })
    expect(g.date).toBeNull()
    expect(g.time).toBeNull()
  })
  it('a genuinely ambiguous turn carries the ONE question forward', () => {
    const g = groundIntent({ ...base, operation: 'calendar_create', ambiguousQuestion: 'לאיזו שעה לקבוע?' })
    expect(g.ask).toBe('לאיזו שעה לקבוע?')
  })
  it('a fact + confirmation pass through for the LAWS gate / pending flow', () => {
    const g = groundIntent({ ...base, operation: 'remember_fact', fact: { kind: 'residence', value: 'חיפה' }, confirmation: 'yes' })
    expect(g.fact).toEqual({ kind: 'residence', value: 'חיפה' })
    expect(g.confirmation).toBe('yes')
  })
})

describe('P1 · groundingLine renders only VERIFIED facts for the LLM (never unresolved)', () => {
  it('resolved people + date + time → a verified-facts line', () => {
    const g = groundIntent({ ...base, operation: 'calendar_create', personRefs: ['בת הזוג של מור'], dateWords: 'מחר', timeWords: 'בשלוש אחר הצהריים' })
    const line = groundingLine(g)!
    expect(line).toContain('יעל')
    expect(line).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(line).toContain('15:00')
  })
  it('nothing deterministic resolved → null (no empty grounding)', () => {
    expect(groundingLine(groundIntent({ ...base, operation: 'chat' }))).toBeNull()
  })
  it('an unresolved ref never leaks into the line', () => {
    const line = groundingLine(groundIntent({ ...base, personRefs: ['הכלב של מור'] }))
    expect(line).toBeNull()
  })
})

describe('P1 · real transport (makeInterpretTransport) — request/response plumbing (PREVIEW behavior not asserted)', () => {
  it('parses the model JSON from the /api/abuai-chat envelope', async () => {
    const transport = makeInterpretTransport({ fetchImpl: mockChatFetch({ ...base, operation: 'calendar_create', personRefs: ['החתן של מור'] }) })
    const si = await interpretUtterance('תקבע עם החתן של מור', transport)
    expect(si.operation).toBe('calendar_create')
    expect(si.personRefs).toEqual(['החתן של מור'])
  })
  it('a provider error degrades to unknown (caller falls back)', async () => {
    const failFetch = (async () => ({ json: async () => ({ ok: false, errorCode: 'CHAT_PROVIDER_FAILED' }) })) as unknown as typeof fetch
    const transport = makeInterpretTransport({ fetchImpl: failFetch })
    expect((await interpretUtterance('...', transport)).operation).toBe('unknown')
  })
})
