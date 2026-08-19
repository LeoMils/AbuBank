/*
 * REALTIME CONFIG TOURNAMENT (ADR-0001 §5 tournament runner — automatable core).
 * ════════════════════════════════════════════════════════════════════════════
 * PURE, deterministic scorer + Pareto selector for Realtime configuration
 * candidates (model / VAD / eagerness / silence threshold / voice) over ONE frozen
 * corpus with identical metrics. It is the OFFLINE runner; executing candidates
 * against LIVE audio (real VAD/voice A/B) is PHYSICAL and belongs to device
 * validation — this module selects a Pareto winner from supplied per-turn samples.
 *
 * HARD RULE (ADR): a candidate may NOT buy naturalness by weakening truth,
 * privacy, correction, latency tails or action consistency. Any candidate with a
 * truth/correction/stale/grounding violation, or a p95 latency over budget, is
 * REJECTED before the Pareto comparison — naturalness never overrides those.
 */
import { summarizeDistribution, type Distribution } from './latencyInstrumentation'

export interface CandidateConfig {
  id: string
  model: string
  vad: 'server' | 'semantic'
  silenceMs: number
  eagerness: 'low' | 'medium' | 'high'
  voice: string
}

/** One turn's observed metrics for a candidate (from the frozen corpus). */
export interface TurnSample {
  latencyMs: number
  naturalness: number          // 1..5 subjective proxy (from the corpus rubric)
  groundingIncident: boolean   // spoke unverified current-info
  correctionLoss: boolean      // lost a user correction
  staleAction: boolean         // a stale action swallowed a turn
  clarification: boolean       // asked a clarification
  lostSpeech: boolean          // dropped accepted user speech
}

export interface Budgets { p95LatencyMs: number }

export interface CandidateScore {
  id: string
  latency: Distribution | null
  meanNaturalness: number
  clarificationRate: number
  lostSpeechRate: number
  truthViolations: number      // grounding + correctionLoss + staleAction (hard)
  rejected: boolean
  rejectReasons: string[]
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const rate = (xs: boolean[]): number => (xs.length ? xs.filter(Boolean).length / xs.length : 0)

export function scoreCandidate(config: CandidateConfig, samples: TurnSample[], budgets: Budgets): CandidateScore {
  const latency = summarizeDistribution(samples.map((s) => s.latencyMs))
  const truthViolations =
    samples.filter((s) => s.groundingIncident).length +
    samples.filter((s) => s.correctionLoss).length +
    samples.filter((s) => s.staleAction).length
  const reasons: string[] = []
  if (truthViolations > 0) reasons.push(`truth/correction/stale violations: ${truthViolations}`)
  if (latency && latency.p95 > budgets.p95LatencyMs) reasons.push(`p95 latency ${latency.p95} > budget ${budgets.p95LatencyMs}`)
  return {
    id: config.id,
    latency,
    meanNaturalness: mean(samples.map((s) => s.naturalness)),
    clarificationRate: rate(samples.map((s) => s.clarification)),
    lostSpeechRate: rate(samples.map((s) => s.lostSpeech)),
    truthViolations,
    rejected: reasons.length > 0,
    rejectReasons: reasons,
  }
}

/** A dominates B iff A is >= on naturalness AND <= on p95 latency, strictly better on one. */
function dominates(a: CandidateScore, b: CandidateScore): boolean {
  const al = a.latency?.p95 ?? Infinity, bl = b.latency?.p95 ?? Infinity
  const betterOrEq = a.meanNaturalness >= b.meanNaturalness && al <= bl
  const strictly = a.meanNaturalness > b.meanNaturalness || al < bl
  return betterOrEq && strictly
}

export interface TournamentResult {
  scores: CandidateScore[]
  survivors: string[]          // not hard-rejected
  paretoFront: string[]        // non-dominated survivors
  winner: string | null        // best survivor: max naturalness, then min p95 latency
  rejected: string[]
}

export function runTournament(
  entries: { config: CandidateConfig; samples: TurnSample[] }[],
  budgets: Budgets,
): TournamentResult {
  const scores = entries.map((e) => scoreCandidate(e.config, e.samples, budgets))
  const survivors = scores.filter((s) => !s.rejected)
  const paretoFront = survivors.filter((s) => !survivors.some((o) => o.id !== s.id && dominates(o, s)))
  // Winner: among the Pareto front, highest naturalness, tie-break lowest p95 latency.
  const winner = [...paretoFront].sort((a, b) =>
    b.meanNaturalness - a.meanNaturalness || (a.latency?.p95 ?? Infinity) - (b.latency?.p95 ?? Infinity),
  )[0]?.id ?? null
  return {
    scores,
    survivors: survivors.map((s) => s.id),
    paretoFront: paretoFront.map((s) => s.id),
    winner,
    rejected: scores.filter((s) => s.rejected).map((s) => s.id),
  }
}
