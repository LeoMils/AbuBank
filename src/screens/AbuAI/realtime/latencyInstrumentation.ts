/*
 * REALTIME LATENCY / VAD INSTRUMENTATION (ADR-0001 §9 — production hardening).
 * ════════════════════════════════════════════════════════════════════════════
 * Privacy-safe, PURE timing instrumentation for the Realtime turn. Records ONLY
 * event names + monotonic millisecond marks + small integer counters — never
 * transcript/message content, names, numbers, or any payload (assertPrivacySafe
 * enforces this). Timestamps are supplied by the caller (no Date.now here) so the
 * module is deterministic and unit-testable; production passes performance.now().
 *
 * It computes per-turn phase latencies, evaluates them against budgets (yielding
 * rollback triggers), and aggregates distributions (median / p95 / p99 / failure
 * & interruption rates) across many turns — the frozen-baseline substrate.
 */

/** Ordered, content-free lifecycle marks of one Realtime turn. */
export const TURN_EVENTS = [
  'audioStart', 'audioEnd', 'transcriptAccepted', 'turnCommitted', 'firstModelAudio',
  'functionRequest', 'functionCompletion', 'actionCommitted', 'cardVisible',
  'interruptionDetected', 'obsoletePlaybackStopped', 'fallbackEntered',
  'reconnectCompleted', 'turnCompleted',
] as const
export type TurnEvent = typeof TURN_EVENTS[number]

/** A turn timeline: event -> monotonic ms. Missing events (e.g. no interruption) are absent. */
export type TurnTimeline = Partial<Record<TurnEvent, number>>

export interface PhaseLatencies {
  /** STT: user stopped speaking -> transcript accepted. */
  stt: number | null
  /** Think-to-speak: turn committed -> first model audio. */
  thinkToSpeak: number | null
  /** Tool round-trip: function requested -> completion. */
  tool: number | null
  /** Action commit: function completion -> action committed. */
  actionCommit: number | null
  /** Card render: action committed -> card visible (UI does not gate speech). */
  card: number | null
  /** Barge-in stop: interruption detected -> obsolete playback stopped. */
  interruptionStop: number | null
  /** Whole turn: audio start -> turn completed. */
  total: number | null
}

function delta(t: TurnTimeline, from: TurnEvent, to: TurnEvent): number | null {
  const a = t[from], b = t[to]
  if (typeof a !== 'number' || typeof b !== 'number') return null
  return b - a
}

/** Content-free by construction: reject any non-(event,number) data smuggled in. */
export function assertPrivacySafe(t: TurnTimeline): void {
  for (const [k, v] of Object.entries(t)) {
    if (!(TURN_EVENTS as readonly string[]).includes(k)) throw new Error(`instrumentation: unknown/unsafe key '${k}'`)
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`instrumentation: non-numeric mark for '${k}'`)
  }
}

export function computePhaseLatencies(t: TurnTimeline): PhaseLatencies {
  assertPrivacySafe(t)
  return {
    stt: delta(t, 'audioEnd', 'transcriptAccepted'),
    thinkToSpeak: delta(t, 'turnCommitted', 'firstModelAudio'),
    tool: delta(t, 'functionRequest', 'functionCompletion'),
    actionCommit: delta(t, 'functionCompletion', 'actionCommitted'),
    card: delta(t, 'actionCommitted', 'cardVisible'),
    interruptionStop: delta(t, 'interruptionDetected', 'obsoletePlaybackStopped'),
    total: delta(t, 'audioStart', 'turnCompleted'),
  }
}

export type PhaseName = keyof PhaseLatencies
export type Budgets = Partial<Record<PhaseName, number>>

export interface BudgetVerdict { phase: PhaseName; ms: number; budgetMs: number; ok: boolean }

/** Evaluate present phases against budgets. A phase over budget is a rollback trigger. */
export function evaluateBudgets(lat: PhaseLatencies, budgets: Budgets): BudgetVerdict[] {
  const out: BudgetVerdict[] = []
  for (const phase of Object.keys(budgets) as PhaseName[]) {
    const ms = lat[phase]
    const budgetMs = budgets[phase]!
    if (typeof ms === 'number') out.push({ phase, ms, budgetMs, ok: ms <= budgetMs })
  }
  return out
}

export interface Distribution { count: number; min: number; median: number; p95: number; p99: number; max: number }

/** Percentile via nearest-rank on a sorted copy (deterministic; no interpolation). */
export function summarizeDistribution(values: number[]): Distribution | null {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).slice().sort((a, b) => a - b)
  if (xs.length === 0) return null
  const at = (p: number): number => xs[Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1))]!
  return { count: xs.length, min: xs[0]!, median: at(0.5), p95: at(0.95), p99: at(0.99), max: xs[xs.length - 1]! }
}

export interface TurnAggregate {
  turns: number
  phases: Partial<Record<PhaseName, Distribution>>
  /** Fraction of turns with >=1 phase over budget (a rollback-trigger rate). */
  budgetFailureRate: number
  /** Fraction of turns that recorded an interruption. */
  interruptionRate: number
  /** Fraction of turns that entered fallback. */
  fallbackRate: number
  overBudgetTurns: number
}

/** Aggregate many turns into distributions + rates — the frozen baseline substrate. */
export function aggregateTurns(timelines: TurnTimeline[], budgets: Budgets = {}): TurnAggregate {
  const phaseValues: Partial<Record<PhaseName, number[]>> = {}
  let overBudgetTurns = 0, interruptionTurns = 0, fallbackTurns = 0
  for (const t of timelines) {
    const lat = computePhaseLatencies(t)
    for (const phase of Object.keys(lat) as PhaseName[]) {
      const v = lat[phase]
      if (typeof v === 'number') (phaseValues[phase] ??= []).push(v)
    }
    if (evaluateBudgets(lat, budgets).some((b) => !b.ok)) overBudgetTurns += 1
    if (typeof t.interruptionDetected === 'number') interruptionTurns += 1
    if (typeof t.fallbackEntered === 'number') fallbackTurns += 1
  }
  const phases: Partial<Record<PhaseName, Distribution>> = {}
  for (const phase of Object.keys(phaseValues) as PhaseName[]) {
    const d = summarizeDistribution(phaseValues[phase]!)
    if (d) phases[phase] = d
  }
  const turns = timelines.length || 1
  return {
    turns: timelines.length,
    phases,
    budgetFailureRate: overBudgetTurns / turns,
    interruptionRate: interruptionTurns / turns,
    fallbackRate: fallbackTurns / turns,
    overBudgetTurns,
  }
}
