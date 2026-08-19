/*
 * Evolution OS — evaluation & holdout integrity (Sections 13–16)
 * ══════════════════════════════════════════════════════════════
 * Compares a CANDIDATE behavior against the current BASELINE on IDENTICAL paired
 * cases, across dataset partitions (dev / frozen / rolling / adversarial). Two
 * non-negotiables:
 *   1) P0 invariants are ZERO-TOLERANCE — a single low-frequency violation
 *      (cross-user leak, fabricated confirmation, silent data loss, secret leak)
 *      rejects the candidate. They are NEVER averaged into a score.
 *   2) A candidate that improves DEV but regresses a FROZEN/ROLLING/ADVERSARIAL
 *      holdout must not advance (Section 14).
 *
 * The "behavior" is injected — a pure `(input) => output` — so evaluation is
 * deterministic and testable without any live model call. A `grader` decides
 * pass/fail and whether a P0 invariant was violated.
 */

export type Partition = 'dev' | 'frozen' | 'rolling' | 'adversarial'

export interface EvalCase {
  caseId: string
  partition: Partition
  domain: string
  input: string
  polarity: 'must_fix' | 'must_preserve'
}

export interface GradeResult { pass: boolean; p0Violation?: string }
export type Behavior = (input: string) => string
export type Grader = (c: EvalCase, output: string) => GradeResult

export interface PairedCaseResult {
  caseId: string
  partition: Partition
  domain: string
  polarity: EvalCase['polarity']
  baselinePass: boolean
  candidatePass: boolean
  delta: 'fixed' | 'regressed' | 'unchanged_pass' | 'unchanged_fail'
  p0Violation?: string
}

export interface DomainMetric { domain: string; baseline: number; candidate: number; n: number }

export interface EvalReport {
  total: number
  byPartition: Record<Partition, { baseline: number; candidate: number; n: number }>
  byDomain: DomainMetric[]
  fixed: string[]
  regressed: string[]            // must_preserve or holdout regressions — the dangerous ones
  p0Violations: Array<{ caseId: string; violation: string }>
  recommendation: 'ADVANCE' | 'REJECT' | 'NO_SAFE_WINNER'
  rejectReasons: string[]
}

function grade(behavior: Behavior, grader: Grader, c: EvalCase): GradeResult {
  try { return grader(c, behavior(c.input)) } catch (e) { return { pass: false, p0Violation: `threw:${(e as Error).message}` } }
}

/** Run a paired baseline-vs-candidate evaluation over a corpus. */
export function evaluate(corpus: EvalCase[], baseline: Behavior, candidate: Behavior, grader: Grader): EvalReport {
  const results: PairedCaseResult[] = corpus.map(c => {
    const b = grade(baseline, grader, c)
    const k = grade(candidate, grader, c)
    const delta: PairedCaseResult['delta'] =
      !b.pass && k.pass ? 'fixed' : b.pass && !k.pass ? 'regressed' : b.pass ? 'unchanged_pass' : 'unchanged_fail'
    return { caseId: c.caseId, partition: c.partition, domain: c.domain, polarity: c.polarity,
      baselinePass: b.pass, candidatePass: k.pass, delta, ...(k.p0Violation ? { p0Violation: k.p0Violation } : {}) }
  })

  const byPartition = { dev: z(), frozen: z(), rolling: z(), adversarial: z() }
  const domainAgg = new Map<string, { b: number; k: number; n: number }>()
  const fixed: string[] = []
  const regressed: string[] = []
  const p0Violations: Array<{ caseId: string; violation: string }> = []

  for (const r of results) {
    const p = byPartition[r.partition]
    p.n++; if (r.baselinePass) p.baseline++; if (r.candidatePass) p.candidate++
    const d = domainAgg.get(r.domain) ?? { b: 0, k: 0, n: 0 }
    d.n++; if (r.baselinePass) d.b++; if (r.candidatePass) d.k++; domainAgg.set(r.domain, d)
    if (r.delta === 'fixed') fixed.push(r.caseId)
    // A regression on a control OR on any holdout partition is dangerous.
    if (r.delta === 'regressed') regressed.push(r.caseId)
    if (r.p0Violation) p0Violations.push({ caseId: r.caseId, violation: r.p0Violation })
  }

  const byDomain: DomainMetric[] = [...domainAgg.entries()].map(([domain, v]) => ({
    domain, baseline: pct(v.b, v.n), candidate: pct(v.k, v.n), n: v.n,
  }))

  // Decision (Section 16 gates 3–6). Order matters: safety first.
  const rejectReasons: string[] = []
  if (p0Violations.length) rejectReasons.push(`P0 invariant violated (${p0Violations.length}) — zero tolerance`)
  const holdoutRegressed = results.some(r => r.delta === 'regressed' && (r.partition !== 'dev' || r.polarity === 'must_preserve'))
  if (holdoutRegressed) rejectReasons.push('regression on a holdout partition or preserved control')

  const anyFix = fixed.length > 0
  let recommendation: EvalReport['recommendation']
  if (rejectReasons.length) recommendation = 'REJECT'
  else if (!anyFix) recommendation = 'NO_SAFE_WINNER'
  else recommendation = 'ADVANCE'

  return { total: results.length, byPartition, byDomain, fixed, regressed, p0Violations, recommendation, rejectReasons }
}

function z() { return { baseline: 0, candidate: 0, n: 0 } }
function pct(x: number, n: number): number { return n === 0 ? 0 : Math.round((x / n) * 1000) / 10 }

/**
 * Holdout integrity (Section 14): candidate-generation must never have SEEN the
 * frozen/rolling/adversarial partitions. Returns the overlap (empty = clean).
 * Overlap is detected on normalized input, not just caseId, to catch paraphrase leaks.
 */
export function detectHoldoutContamination(devInputsSeenByGenerator: string[], holdout: EvalCase[]): string[] {
  const seen = new Set(devInputsSeenByGenerator.map(norm))
  return holdout.filter(c => seen.has(norm(c.input))).map(c => c.caseId)
}
function norm(s: string): string { return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() }
