/*
 * UNDERSTANDING SHADOW — per-turn old-vs-new intake comparison (obligations #2, #6, #7, #8).
 * The classifier + KPI/latency aggregation are PURE and CODE-provable here; the real-provider
 * shadow over live traffic is PREVIEW-class and is NOT claimed by these tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  classifyShadow, aggregateKPIs, observeOldIntake, runIntakeShadow,
  type OldIntakeObservation, type ShadowRecord,
} from './understandingShadow'
import type { GroundedIntent, IntakeDecision, InterpretTransport } from './understandingIntake'

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
})

const OLD = (o: Partial<OldIntakeObservation>): OldIntakeObservation => ({ operation: 'other', handledDeterministically: false, people: [], ...o })
const G = (o: Partial<GroundedIntent>): GroundedIntent => ({ operation: 'unknown', people: [], unresolvedRefs: [], date: null, time: null, timeAmbiguous: false, place: null, title: null, fact: null, correction: null, confirmation: null, ask: null, ...o })
const ACT: IntakeDecision = { action: 'act' }
const CLARIFY: IntakeDecision = { action: 'clarify', ask: 'על מי מדובר?' }
const DECLINE: IntakeDecision = { action: 'decline' }

describe('classifyShadow — the correctness-first buckets', () => {
  it('DISAGREE when both resolve people but to DIFFERENT people (the correctness risk, must be 0)', () => {
    expect(classifyShadow(OLD({ handledDeterministically: true, people: ['מור'] }), G({ operation: 'family_query', people: ['אופיר'] }), ACT)).toBe('disagree')
  })
  it('AGREE when both resolve the SAME people', () => {
    expect(classifyShadow(OLD({ handledDeterministically: true, people: ['מור'] }), G({ operation: 'family_query', people: ['מור'] }), ACT)).toBe('agree')
  })
  it('RECOVERED when old punted but new produced a grounded actionable op', () => {
    expect(classifyShadow(OLD({ handledDeterministically: false }), G({ operation: 'family_query', people: ['גלעד'] }), ACT)).toBe('recovered')
  })
  it('REGRESSED when old handled deterministically but new declined (understanding LOST, must be 0)', () => {
    expect(classifyShadow(OLD({ handledDeterministically: true, operation: 'calendar_read' }), G({ operation: 'unknown' }), DECLINE)).toBe('regressed')
  })
  it('CLARIFY when new asks and old had not handled (healthy ambiguity surfaced)', () => {
    expect(classifyShadow(OLD({ handledDeterministically: false }), G({ operation: 'family_query', ask: 'על מי?' }), CLARIFY)).toBe('clarify')
  })
  it('FALSE_CLARIFY when new asks though old confidently handled (must stay low)', () => {
    expect(classifyShadow(OLD({ handledDeterministically: true, operation: 'calendar_read' }), G({ operation: 'calendar_read', ask: 'מתי?' }), CLARIFY)).toBe('false_clarify')
  })
  it('UNRESOLVED when neither side is actionable', () => {
    expect(classifyShadow(OLD({ handledDeterministically: false }), G({ operation: 'chat' }), DECLINE)).toBe('unresolved')
  })
})

describe('observeOldIntake — the REAL legacy intake output (family people resolved by the live seam)', () => {
  it('maps runtime intent → operation and resolves the old path family people', () => {
    const o = observeOldIntake('מי הבת של מרטיטה', { intent: 'family', handled: true, domain: 'family' })
    expect(o.operation).toBe('family_query')
    expect(o.handledDeterministically).toBe(true)
    expect(o.people.length).toBeGreaterThan(0)          // the old intake really resolved someone
    o.people.forEach((p) => expect(typeof p).toBe('string'))
  })
  it('non-family intents carry no people and map operation honestly', () => {
    const o = observeOldIntake('מה יש לי מחר', { intent: 'calendar_read', handled: true, domain: 'calendar' })
    expect(o.operation).toBe('calendar_read')
    expect(o.people).toEqual([])
  })
})

describe('runIntakeShadow — never throws, times each stage, classifies (mock transport)', () => {
  const transport: InterpretTransport = async () => ({ operation: 'family_query', personRefs: ['מור'], dateWords: null, timeWords: null, place: null, title: null, fact: null, correction: null, confirmation: null, ambiguousQuestion: null })
  it('produces a classified record with per-stage latency and a real grounded intent', async () => {
    const rec = await runIntakeShadow('מי זאת מור', observeOldIntake('מי זאת מור', { intent: 'family', handled: true, domain: 'family' }), transport)
    expect(rec.grounded.operation).toBe('family_query')
    expect(rec.grounded.people.length).toBeGreaterThan(0)
    expect(['agree', 'recovered', 'disagree']).toContain(rec.bucket)
    expect(rec.latency.totalMs).toBeGreaterThanOrEqual(0)
    expect(rec.latency.decideMs).toBeGreaterThanOrEqual(0)
  })
  it('a throwing/hanging transport fails closed to unknown → never throws, decision declines', async () => {
    const boom: InterpretTransport = async () => { throw new Error('provider down') }
    const rec = await runIntakeShadow('משהו', OLD({}), boom, { timeoutMs: 50 })
    expect(rec.grounded.operation).toBe('unknown')
    expect(rec.decision.action).toBe('decline')
    expect(rec.bucket).toBe('unresolved')
  })
})

describe('aggregateKPIs — understanding KPIs + latency percentiles (obligations #7, #8)', () => {
  const mk = (bucket: ShadowRecord['bucket'], t: number): ShadowRecord => ({ input: 'x', old: OLD({}), grounded: G({}), decision: ACT, bucket, latency: { interpretMs: t, groundMs: 1, decideMs: 0, totalMs: t + 1 } })
  it('rates sum coherently and disagreement/regression are isolated KPIs', () => {
    const k = aggregateKPIs([mk('agree', 10), mk('agree', 20), mk('recovered', 30), mk('disagree', 40), mk('clarify', 50)])
    expect(k.total).toBe(5)
    expect(k.agreementRate).toBeCloseTo(2 / 5)
    expect(k.semanticRecoveryRate).toBeCloseTo(1 / 5)
    expect(k.disagreementRate).toBeCloseTo(1 / 5)
    expect(k.regressionRate).toBe(0)
    expect(k.ambiguityRate).toBeCloseTo(1 / 5)
  })
  it('latency percentiles are ordered p50 ≤ p95 ≤ worst', () => {
    const k = aggregateKPIs(Array.from({ length: 20 }, (_, i) => mk('agree', i)))
    expect(k.latency.interpret.p50).toBeLessThanOrEqual(k.latency.interpret.p95)
    expect(k.latency.interpret.p95).toBeLessThanOrEqual(k.latency.interpret.worst)
    expect(k.latency.total.n).toBe(20)
  })
})
