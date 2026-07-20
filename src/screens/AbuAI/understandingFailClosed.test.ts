/*
 * P1 · FAIL-CLOSED handling (standing obligation #9). Under every degenerate
 * interpreter outcome — timeout, malformed/partial schema, provider down, unknown/
 * unsupported op, low-confidence/ambiguous, contradictory (action with nothing) —
 * the layer NEVER fabricates a structured action: it falls to 'unknown' or asks ONE
 * clarifying question. The interpreter may be unsure; it may never invent an action.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  interpretUtterance, groundIntent, decideIntakeAction,
  type StructuredIntent, type InterpretTransport,
} from './understandingIntake'

const base: StructuredIntent = {
  operation: 'chat', personRefs: [], dateWords: null, timeWords: null, place: null,
  title: null, fact: null, correction: null, confirmation: null, ambiguousQuestion: null,
}

describe('#9 · interpret fails closed on provider failure modes', () => {
  it('provider throws → unknown', async () => {
    const t: InterpretTransport = async () => { throw new Error('provider down') }
    expect((await interpretUtterance('x', t)).operation).toBe('unknown')
  })
  it('malformed JSON string → unknown', async () => {
    const t: InterpretTransport = async () => 'not an object'
    expect((await interpretUtterance('x', t)).operation).toBe('unknown')
  })
  it('partial schema (missing fields) → safe shape, never fabricated', async () => {
    const t: InterpretTransport = async () => ({ operation: 'calendar_create' }) // everything else missing
    const si = await interpretUtterance('x', t)
    expect(si.operation).toBe('calendar_create')
    expect(si.personRefs).toEqual([]); expect(si.dateWords).toBeNull(); expect(si.fact).toBeNull()
  })
  it('unsupported operation value → unknown', async () => {
    const t: InterpretTransport = async () => ({ ...base, operation: 'transfer_money' })
    expect((await interpretUtterance('x', t)).operation).toBe('unknown')
  })
  it('TIMEOUT → unknown (a hanging provider never blocks the turn)', async () => {
    vi.useFakeTimers()
    const t: InterpretTransport = () => new Promise(() => { /* never resolves */ })
    const p = interpretUtterance('x', t, { timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(150)
    expect((await p).operation).toBe('unknown')
    vi.useRealTimers()
  })
})

describe('#9 · decideIntakeAction never acts on empty / contradictory / unsure meaning', () => {
  it('ambiguity → clarify with the one question', () => {
    const d = decideIntakeAction(groundIntent({ ...base, operation: 'calendar_create', ambiguousQuestion: 'לאיזו שעה?' }))
    expect(d).toEqual({ action: 'clarify', ask: 'לאיזו שעה?' })
  })
  it('unknown / chat → decline (normal path, no fabricated action)', () => {
    expect(decideIntakeAction(groundIntent({ ...base, operation: 'unknown' })).action).toBe('decline')
    expect(decideIntakeAction(groundIntent({ ...base, operation: 'chat' })).action).toBe('decline')
  })
  it('a "create" with NOTHING concrete → clarify, never act', () => {
    expect(decideIntakeAction(groundIntent({ ...base, operation: 'calendar_create' })).action).toBe('clarify')
  })
  it('a family_query with no resolvable person → clarify', () => {
    expect(decideIntakeAction(groundIntent({ ...base, operation: 'family_query', personRefs: ['הכלב של מור'] })).action).toBe('clarify')
  })
  it('a well-grounded create → act', () => {
    const g = groundIntent({ ...base, operation: 'calendar_create', personRefs: ['בת הזוג של מור'], dateWords: 'מחר', timeWords: 'בשלוש' })
    expect(decideIntakeAction(g).action).toBe('act')
  })
})
