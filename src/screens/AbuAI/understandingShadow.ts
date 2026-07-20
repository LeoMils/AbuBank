/*
 * UNDERSTANDING SHADOW — per-turn old-vs-new intake comparison.
 * ════════════════════════════════════════════════════════════════════════════
 * Standing proof obligations #2 (shadow validation before migration), #6 (shadow
 * metrics), #7 (report understanding KPIs, not test counts) and #8 (latency is a
 * product feature — p50/p95/worst per stage) — applied to the P1 UNDERSTANDING
 * path as a whole, not only the family-REL seam (which was already discharged in
 * `src/eval/intakeShadow.ts`).
 *
 * For a turn we compare:
 *   OLD  — what the pattern-bound runtime intake did (`observeOldIntake`): its
 *          operation, whether it handled deterministically, and — for family turns
 *          — the REAL people the legacy family intake resolved (via the live seam).
 *   NEW  — the understanding-first result: interpret → groundIntent → decideIntakeAction.
 *
 * This module is OBSERVATION-ONLY. It never changes a turn's answer; `runIntakeShadow`
 * is fire-and-forget from the live path. The classifier + aggregation are PURE and
 * CODE-provable; the real-provider shadow over live traffic is PREVIEW-class.
 *
 * Buckets (correctness-first):
 *   agree       — both actionable (people match when both resolved people)
 *   recovered   — old punted, NEW produced a grounded actionable op (understanding GAINED)
 *   regressed   — old handled deterministically, NEW declined/unknown (understanding LOST — must be 0)
 *   disagree    — both resolved people but to DIFFERENT people (correctness risk — must be 0)
 *   clarify     — NEW asks its one question and old had not handled (healthy ambiguity surfaced)
 *   false_clarify — NEW asks though the LEGACY path acted. A DIVERGENCE TO REVIEW, not
 *                   automatically a defect: it is over-asking ONLY if the legacy action was
 *                   correct; when the legacy path acted on under-specified input (e.g. an empty
 *                   "create"), the NEW ask is the SAFER behavior. Root-cause each, do not assume.
 *   unresolved  — neither side is actionable
 */
import {
  interpretUtterance, groundIntent, decideIntakeAction,
  type GroundedIntent, type IntakeDecision, type IntentOperation, type InterpretTransport,
} from './understandingIntake'
import { answerFamilyRelation } from './familyReasoning'
import type { RuntimeIntent } from './cognitiveRuntime'
import type { MetaDomain } from './metaReasoner'

// ─── The OLD intake observation (the real legacy output for this turn) ────────

export interface OldIntakeObservation {
  operation: IntentOperation | 'other'
  handledDeterministically: boolean
  /** People the OLD intake actually resolved (family turns only) — the correctness baseline. */
  people: string[]
}

const OP_OF: Partial<Record<RuntimeIntent, IntentOperation>> = {
  calendar_read: 'calendar_read', calendar_search: 'calendar_search',
  calendar_create: 'calendar_create', calendar_recurring: 'calendar_create',
  calendar_update: 'calendar_edit', calendar_delete: 'calendar_delete',
  reminder: 'calendar_create',
  family: 'family_query', online: 'online_query', memory: 'remember_fact',
}

/** Snapshot what the OLD (pattern-bound) intake did on this turn. For family turns
 *  it calls the REAL legacy family intake so the people comparison is genuine. */
export function observeOldIntake(
  input: string,
  o: { intent: RuntimeIntent; handled: boolean; domain: MetaDomain },
): OldIntakeObservation {
  const operation = OP_OF[o.intent] ?? 'other'
  let people: string[] = []
  if (o.domain === 'family') {
    try { const a = answerFamilyRelation(input); if (a?.known && a.results.length) people = [...a.results].sort() } catch { /* never break */ }
  }
  return { operation, handledDeterministically: o.handled, people }
}

// ─── The classifier ──────────────────────────────────────────────────────────

export type ShadowBucket =
  | 'agree' | 'recovered' | 'regressed' | 'disagree' | 'clarify' | 'false_clarify' | 'unresolved'

const ACTIONABLE_OPS: IntentOperation[] = ['calendar_create', 'calendar_read', 'calendar_search', 'calendar_edit', 'calendar_delete', 'family_query', 'remember_fact', 'online_query']
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

export function classifyShadow(old: OldIntakeObservation, g: GroundedIntent, d: IntakeDecision): ShadowBucket {
  if (d.action === 'clarify') return old.handledDeterministically ? 'false_clarify' : 'clarify'
  const newActionable = d.action === 'act' && ACTIONABLE_OPS.includes(g.operation)
  // People-level correctness first (the real risk): both resolved someone, but different.
  if (old.people.length && g.people.length && !sameSet([...old.people].sort(), [...g.people].sort())) return 'disagree'
  if (newActionable && !old.handledDeterministically) return 'recovered'
  if (!newActionable && old.handledDeterministically) return 'regressed'
  if (newActionable && old.handledDeterministically) return 'agree'
  return 'unresolved'
}

// ─── The shadow runner (fire-and-forget; never throws) ────────────────────────

export interface ShadowStageLatency { interpretMs: number; groundMs: number; decideMs: number; totalMs: number }
export interface ShadowRecord {
  input: string
  old: OldIntakeObservation
  grounded: GroundedIntent
  decision: IntakeDecision
  bucket: ShadowBucket
  latency: ShadowStageLatency
}

/** Run the NEW understanding path for shadow comparison. `pre` lets the live path
 *  reuse an already-computed grounded intent (a pattern MISS already interprets) so
 *  the shadow never fires a SECOND provider call on that turn (obligation #14). */
export async function runIntakeShadow(
  input: string,
  old: OldIntakeObservation,
  transport: InterpretTransport,
  opts?: { timeoutMs?: number; pre?: { grounded: GroundedIntent; interpretMs: number; groundMs: number } },
): Promise<ShadowRecord> {
  const t0 = Date.now()
  let grounded: GroundedIntent
  let interpretMs = 0
  let groundMs = 0
  if (opts?.pre) {
    grounded = opts.pre.grounded; interpretMs = opts.pre.interpretMs; groundMs = opts.pre.groundMs
  } else {
    const ti = Date.now()
    const si = await interpretUtterance(input, transport, opts?.timeoutMs ? { timeoutMs: opts.timeoutMs } : undefined)
    interpretMs = Date.now() - ti
    const tg = Date.now()
    grounded = groundIntent(si) // interpretUtterance already fail-closes → never throws
    groundMs = Date.now() - tg
  }
  const td = Date.now()
  const decision = decideIntakeAction(grounded)
  const decideMs = Date.now() - td
  const bucket = classifyShadow(old, grounded, decision)
  return { input, old, grounded, decision, bucket, latency: { interpretMs, groundMs, decideMs, totalMs: Date.now() - t0 } }
}

// ─── KPI + latency aggregation (obligations #7, #8) ───────────────────────────

export interface Pctl { p50: number; p95: number; worst: number; n: number }
function pctl(xs: number[]): Pctl {
  if (!xs.length) return { p50: 0, p95: 0, worst: 0, n: 0 }
  const s = [...xs].sort((a, b) => a - b)
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]!
  return { p50: at(0.5), p95: at(0.95), worst: s[s.length - 1]!, n: s.length }
}

export interface UnderstandingKPIs {
  total: number
  counts: Record<ShadowBucket, number>
  /** Understanding KPIs (obligation #7) — rates, never raw test counts. */
  agreementRate: number
  semanticRecoveryRate: number
  disagreementRate: number
  regressionRate: number
  ambiguityRate: number
  falseClarificationRate: number
  unresolvedIntentRate: number
  /** Latency (obligation #8) — p50/p95/worst per stage, in ms. */
  latency: { interpret: Pctl; ground: Pctl; decide: Pctl; total: Pctl }
}

export function aggregateKPIs(records: ShadowRecord[]): UnderstandingKPIs {
  const counts: Record<ShadowBucket, number> = { agree: 0, recovered: 0, regressed: 0, disagree: 0, clarify: 0, false_clarify: 0, unresolved: 0 }
  for (const r of records) counts[r.bucket]++
  const total = records.length
  const rate = (n: number) => (total ? n / total : 0)
  return {
    total,
    counts,
    agreementRate: rate(counts.agree),
    semanticRecoveryRate: rate(counts.recovered),
    disagreementRate: rate(counts.disagree),
    regressionRate: rate(counts.regressed),
    ambiguityRate: rate(counts.clarify + counts.false_clarify),
    falseClarificationRate: rate(counts.false_clarify),
    unresolvedIntentRate: rate(counts.unresolved),
    latency: {
      interpret: pctl(records.map((r) => r.latency.interpretMs)),
      ground: pctl(records.map((r) => r.latency.groundMs)),
      decide: pctl(records.map((r) => r.latency.decideMs)),
      total: pctl(records.map((r) => r.latency.totalMs)),
    },
  }
}

/** One-line operator/Leo KPI summary (Hebrew-labelled, rates as %). */
export function kpiSummaryLine(k: UnderstandingKPIs): string {
  const pct = (r: number) => `${(r * 100).toFixed(1)}%`
  return [
    `הבנה: n=${k.total}`,
    `הסכמה ${pct(k.agreementRate)}`,
    `שוחזר ${pct(k.semanticRecoveryRate)}`,
    `רגרסיה ${pct(k.regressionRate)}`,
    `סתירה ${pct(k.disagreementRate)}`,
    `הבהרה ${pct(k.ambiguityRate)}`,
    `לא-פוענח ${pct(k.unresolvedIntentRate)}`,
    `latency p50/p95/worst=${k.latency.total.p50}/${k.latency.total.p95}/${k.latency.total.worst}ms`,
  ].join(' · ')
}
