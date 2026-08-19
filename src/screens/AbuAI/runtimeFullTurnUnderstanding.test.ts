/*
 * P1 live wiring — understanding runs on a pattern MISS (the needsLLM branch) and
 * enriches the LLM grounding with graph-resolved facts; latency is reported. The
 * transport is a MOCK here (real provider = PREVIEW). Proves the async plumbing,
 * not the model's quality.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runFullTurn, type FullTurnTools } from './runtimeFullTurn'
import { IDLE_RUNTIME, type RuntimeContext } from './cognitiveRuntime'
import type { InterpretTransport } from './understandingIntake'
import type { ShadowRecord } from './understandingShadow'

const ctx: RuntimeContext = { messages: [], now: new Date('2026-07-20T09:00:00Z') }

// A general-knowledge turn falls to the LLM (needsLLM) — the pattern miss where
// understanding-first should run.
const MISS_INPUT = 'ספרי לי על המהפכה הצרפתית'

function toolsWith(interpret: InterpretTransport | undefined, sink: string[], latency: number[]): FullTurnTools {
  return {
    llm: async (_input, grounding) => { sink.push(grounding ?? '<none>'); return 'תשובה כללית.' },
    online: async () => ({ ok: false, answer: '', reason: 'unused' }),
    ...(interpret ? { interpret } : {}),
    onUnderstandLatency: (ms) => latency.push(ms),
  }
}

describe('P1 live · understanding enriches LLM grounding on a pattern miss', () => {
  it('feeds graph-resolved people into the grounding the LLM receives', async () => {
    const sink: string[] = []; const latency: number[] = []
    // The model (mock) recovers a person reference from the turn; the layer grounds it.
    const interpret: InterpretTransport = async () => ({
      operation: 'chat', personRefs: ['בת הזוג של מור'], dateWords: null, timeWords: null,
      place: null, title: null, fact: null, correction: null, confirmation: null, ambiguousQuestion: null,
    })
    await runFullTurn(IDLE_RUNTIME, MISS_INPUT, ctx, toolsWith(interpret, sink, latency))
    expect(sink[0]).toContain('יעל')       // graph-resolved, handed to the LLM
    expect(latency.length).toBe(1)          // latency was reported
  })

  it('a failing interpreter never breaks the turn (falls through to raw LLM)', async () => {
    const sink: string[] = []; const latency: number[] = []
    const interpret: InterpretTransport = async () => { throw new Error('provider down') }
    const r = await runFullTurn(IDLE_RUNTIME, MISS_INPUT, ctx, toolsWith(interpret, sink, latency))
    expect(r.display.length).toBeGreaterThan(0)   // still answered
    expect(sink.length).toBe(1)                   // llm still called
  })

  it('no interpret tool → unchanged pattern-only behavior (backward compatible)', async () => {
    const sink: string[] = []; const latency: number[] = []
    const r = await runFullTurn(IDLE_RUNTIME, MISS_INPUT, ctx, toolsWith(undefined, sink, latency))
    expect(r.display.length).toBeGreaterThan(0)
    expect(latency.length).toBe(0)                // understanding never ran
  })
})

describe('per-turn SHADOW · observation-only, fires every turn, never changes the answer', () => {
  let storage: Record<string, string> = {}
  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  })

  const interpret: InterpretTransport = async () => ({
    operation: 'family_query', personRefs: ['הבת של מרטיטה'], dateWords: null, timeWords: null,
    place: null, title: null, fact: null, correction: null, confirmation: null, ambiguousQuestion: null,
  })

  function toolsWithShadow(records: ShadowRecord[]): FullTurnTools {
    return {
      llm: async () => 'תשובה כללית.',
      online: async () => ({ ok: false, answer: '', reason: 'unused' }),
      interpret,
      onIntakeShadow: (rec) => records.push(rec),
    }
  }

  it('a deterministic family turn still answers, AND a shadow record is emitted', async () => {
    const records: ShadowRecord[] = []
    // The reply is identical with or without the shadow sink (observation-only).
    const baseline = await runFullTurn(IDLE_RUNTIME, 'מי הבת של מרטיטה', ctx, {
      llm: async () => 'תשובה כללית.', online: async () => ({ ok: false, answer: '', reason: 'unused' }), interpret,
    })
    const withShadow = await runFullTurn(IDLE_RUNTIME, 'מי הבת של מרטיטה', ctx, toolsWithShadow(records))
    expect(withShadow.display).toBe(baseline.display)      // shadow never changes the answer
    await new Promise((r) => setTimeout(r, 0))             // let the fire-and-forget settle
    expect(records.length).toBe(1)                         // the shadow observed the turn
    expect(records[0]!.input).toBe('מי הבת של מרטיטה')
    expect(['agree', 'recovered', 'disagree']).toContain(records[0]!.bucket)
  })

  it('no shadow sink → no shadow work (backward compatible)', async () => {
    const records: ShadowRecord[] = []
    await runFullTurn(IDLE_RUNTIME, 'מי הבת של מרטיטה', ctx, {
      llm: async () => 'תשובה כללית.', online: async () => ({ ok: false, answer: '', reason: 'unused' }), interpret,
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(records.length).toBe(0)
  })
})
