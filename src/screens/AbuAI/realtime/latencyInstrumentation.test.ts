/*
 * Realtime latency/VAD instrumentation — INTEGRATION proof + independent verifier
 * + privacy hostility + budget/rollback + distribution correctness + mutation sentinels.
 */
import { describe, it, expect } from 'vitest'
import {
  computePhaseLatencies, evaluateBudgets, summarizeDistribution, aggregateTurns,
  assertPrivacySafe, TURN_EVENTS, type TurnTimeline,
} from './latencyInstrumentation'

// A realistic, content-free turn (ms marks). WhatsApp prep with one interruption.
const turn = (over: Partial<TurnTimeline> = {}): TurnTimeline => ({
  audioStart: 0, audioEnd: 1200, transcriptAccepted: 1400, turnCommitted: 1450,
  firstModelAudio: 1900, functionRequest: 1500, functionCompletion: 1650,
  actionCommitted: 1680, cardVisible: 1720, turnCompleted: 4200, ...over,
})

describe('phase latencies — INTEGRATION over a realistic turn', () => {
  it('computes every phase from the marks', () => {
    const lat = computePhaseLatencies(turn())
    expect(lat.stt).toBe(200)            // 1400-1200
    expect(lat.thinkToSpeak).toBe(450)   // 1900-1450
    expect(lat.tool).toBe(150)           // 1650-1500
    expect(lat.actionCommit).toBe(30)    // 1680-1650
    expect(lat.card).toBe(40)            // 1720-1680
    expect(lat.total).toBe(4200)         // 4200-0
    expect(lat.interruptionStop).toBeNull() // none this turn
  })
  it('records barge-in stop latency when an interruption occurs', () => {
    const lat = computePhaseLatencies(turn({ interruptionDetected: 2000, obsoletePlaybackStopped: 2080 }))
    expect(lat.interruptionStop).toBe(80)
  })
  it('INDEPENDENT VERIFIER — recompute deltas by hand and cross-check', () => {
    const t = turn({ interruptionDetected: 3000, obsoletePlaybackStopped: 3120 })
    const lat = computePhaseLatencies(t)
    expect(lat.stt).toBe(t.transcriptAccepted! - t.audioEnd!)
    expect(lat.thinkToSpeak).toBe(t.firstModelAudio! - t.turnCommitted!)
    expect(lat.tool).toBe(t.functionCompletion! - t.functionRequest!)
    expect(lat.interruptionStop).toBe(t.obsoletePlaybackStopped! - t.interruptionDetected!)
    expect(lat.total).toBe(t.turnCompleted! - t.audioStart!)
  })
})

describe('privacy by construction — content can never enter instrumentation', () => {
  it('rejects an unknown/unsafe key (e.g. a transcript field)', () => {
    expect(() => assertPrivacySafe({ transcript: 5 } as unknown as TurnTimeline)).toThrow(/unknown\/unsafe/)
  })
  it('rejects a non-numeric mark (e.g. smuggled string content)', () => {
    expect(() => assertPrivacySafe({ audioStart: 'שלום' as unknown as number })).toThrow(/non-numeric/)
    expect(() => computePhaseLatencies({ audioEnd: 'x' as unknown as number })).toThrow()
  })
  it('the event vocabulary is a fixed CLOSED set — no dynamic/content keys admitted', () => {
    expect(TURN_EVENTS.length).toBe(14)
    // A closed vocabulary is the privacy guarantee: only these lifecycle marks exist,
    // and assertPrivacySafe rejects anything outside it (proven above). Marks are
    // timestamps, never payloads.
    expect(new Set(TURN_EVENTS).size).toBe(TURN_EVENTS.length) // no duplicates
    for (const e of TURN_EVENTS) expect(typeof e).toBe('string')
    expect(() => assertPrivacySafe({ recipientName: 1 } as unknown as TurnTimeline)).toThrow()
  })
})

describe('budgets → rollback triggers', () => {
  it('flags a phase over budget as not-ok (a rollback trigger)', () => {
    const lat = computePhaseLatencies(turn({ firstModelAudio: 3000 })) // thinkToSpeak = 1550
    const v = evaluateBudgets(lat, { thinkToSpeak: 1200, total: 6000 })
    expect(v.find((x) => x.phase === 'thinkToSpeak')!.ok).toBe(false)
    expect(v.find((x) => x.phase === 'total')!.ok).toBe(true)
  })
  it('only evaluates phases that are present AND budgeted', () => {
    const lat = computePhaseLatencies(turn())
    expect(evaluateBudgets(lat, { interruptionStop: 100 })).toEqual([]) // no interruption this turn
  })
})

describe('distributions — deterministic nearest-rank', () => {
  it('median / p95 / p99 / min / max', () => {
    const d = summarizeDistribution([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])!
    expect(d.count).toBe(10); expect(d.min).toBe(10); expect(d.max).toBe(100)
    expect(d.median).toBe(50); expect(d.p95).toBe(100); expect(d.p99).toBe(100)
  })
  it('returns null for an empty set', () => { expect(summarizeDistribution([])).toBeNull() })
})

describe('aggregate — the frozen-baseline substrate', () => {
  it('distributions + budget-failure / interruption / fallback rates across turns', () => {
    const turns: TurnTimeline[] = [
      turn(),
      turn({ firstModelAudio: 3200 }),                                   // slow thinkToSpeak
      turn({ interruptionDetected: 2000, obsoletePlaybackStopped: 2100 }), // interruption
      turn({ fallbackEntered: 2500 }),                                   // fallback
    ]
    const agg = aggregateTurns(turns, { thinkToSpeak: 1200 })
    expect(agg.turns).toBe(4)
    expect(agg.phases.thinkToSpeak!.count).toBe(4)
    expect(agg.overBudgetTurns).toBe(1)                 // the 3200 turn only
    expect(agg.budgetFailureRate).toBeCloseTo(0.25)
    expect(agg.interruptionRate).toBeCloseTo(0.25)
    expect(agg.fallbackRate).toBeCloseTo(0.25)
  })
  it('MUTATION SENTINEL — a wrong subtraction direction would surface as a negative/!=expected', () => {
    // Guards computePhaseLatencies against a flipped delta (to-from vs from-to).
    expect(computePhaseLatencies(turn()).stt).toBeGreaterThan(0)
    expect(computePhaseLatencies(turn()).total).toBe(4200)
  })
})
