/*
 * Config tournament runner — INTEGRATION proof: a Pareto winner is selected, and
 * naturalness can NEVER buy its way past a truth/correction/stale violation or a
 * latency-tail budget breach. Independent verifier: hand-computed expectations.
 */
import { describe, it, expect } from 'vitest'
import { runTournament, scoreCandidate, type CandidateConfig, type TurnSample } from './configTournament'

const cfg = (id: string, over: Partial<CandidateConfig> = {}): CandidateConfig => ({
  id, model: 'gpt-realtime', vad: 'server', silenceMs: 500, eagerness: 'medium', voice: 'cedar', ...over,
})
const turn = (over: Partial<TurnSample> = {}): TurnSample => ({
  latencyMs: 900, naturalness: 4, groundingIncident: false, correctionLoss: false,
  staleAction: false, clarification: false, lostSpeech: false, ...over,
})
const samples = (n: number, over: Partial<TurnSample> = {}): TurnSample[] => Array.from({ length: n }, () => turn(over))

const BUDGETS = { p95LatencyMs: 1500 }

describe('config tournament — Pareto selection with hard truth/latency constraints', () => {
  it('rejects a candidate with ANY truth/correction/stale violation (naturalness cannot buy it)', () => {
    const s = scoreCandidate(cfg('A'), [turn({ naturalness: 5, groundingIncident: true })], BUDGETS)
    expect(s.rejected).toBe(true)
    expect(s.rejectReasons.join(' ')).toMatch(/truth\/correction\/stale/)
  })
  it('rejects a candidate whose p95 latency exceeds budget', () => {
    const s = scoreCandidate(cfg('B'), samples(20, { latencyMs: 3000 }), BUDGETS)
    expect(s.rejected).toBe(true)
    expect(s.rejectReasons.join(' ')).toMatch(/p95 latency/)
  })
  it('selects the Pareto winner among truthful survivors — NOT the most-natural violator', () => {
    const r = runTournament([
      // Most "natural" but commits a grounding violation → must be rejected.
      { config: cfg('flashy'), samples: samples(10, { naturalness: 5, groundingIncident: true, latencyMs: 700 }) },
      // Truthful, fast, natural → the right winner.
      { config: cfg('solid'), samples: samples(10, { naturalness: 4.5, latencyMs: 800 }) },
      // Truthful but slower + less natural → dominated.
      { config: cfg('slow'), samples: samples(10, { naturalness: 4.0, latencyMs: 1400 }) },
    ], BUDGETS)
    expect(r.rejected).toContain('flashy')
    expect(r.survivors.sort()).toEqual(['slow', 'solid'])
    expect(r.winner).toBe('solid')                 // MUTATION-CATCH: drop the truth gate → 'flashy' wins
    expect(r.paretoFront).toContain('solid')
    expect(r.paretoFront).not.toContain('slow')    // dominated by solid (more natural AND faster)
  })
  it('winner is null when every candidate is rejected', () => {
    const r = runTournament([{ config: cfg('bad'), samples: samples(5, { staleAction: true }) }], BUDGETS)
    expect(r.winner).toBeNull()
    expect(r.rejected).toEqual(['bad'])
  })
})
