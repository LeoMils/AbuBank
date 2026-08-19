/*
 * INTAKE SHADOW VALIDATION (standing proof obligations #2, #6, #13).
 * ════════════════════════════════════════════════════════════════════════════
 * Run an OLD intake and a NEW intake in PARALLEL over a corpus, compare every
 * turn, and classify the divergences — the binding gate before retiring the old
 * intake or replacing production. No migration without these metrics.
 *
 *   agree      — both punt, or both resolve to the SAME people
 *   recovered  — old punted, NEW resolved            (understanding GAINED)
 *   regressed  — old resolved, NEW punted            (understanding LOST — must be 0)
 *   disagree   — both resolved to DIFFERENT people    (correctness risk — must be 0)
 *
 * Retirement criterion (obligation 13): retire the old intake only when, over the
 * corpus, regressed === 0 AND disagree === 0 (the new intake is a strict superset).
 * Pure + deterministic — a real provider shadow is a separate PREVIEW run.
 */

export type IntakeFn = (text: string) => { known: boolean; results: string[] } | null

export interface ShadowDivergence { input: string; kind: 'recovered' | 'regressed' | 'disagree'; old: string[] | null; neu: string[] | null }

export interface ShadowReport {
  total: number
  agree: number
  recovered: number
  regressed: number
  disagree: number
  divergences: ShadowDivergence[]
  /** KPIs (obligation 7). */
  agreementRate: number
  recoveryRate: number
}

const resolvedSet = (r: ReturnType<IntakeFn>): string[] | null =>
  r && r.known && r.results.length ? [...r.results].sort() : null

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

export function shadowCompare(oldFn: IntakeFn, newFn: IntakeFn, corpus: string[]): ShadowReport {
  let agree = 0, recovered = 0, regressed = 0, disagree = 0
  const divergences: ShadowDivergence[] = []
  for (const input of corpus) {
    const o = resolvedSet(oldFn(input))
    const n = resolvedSet(newFn(input))
    if (o === null && n === null) { agree++; continue }
    if (o === null && n !== null) { recovered++; divergences.push({ input, kind: 'recovered', old: null, neu: n }); continue }
    if (o !== null && n === null) { regressed++; divergences.push({ input, kind: 'regressed', old: o, neu: null }); continue }
    if (sameSet(o!, n!)) { agree++; continue }
    disagree++; divergences.push({ input, kind: 'disagree', old: o, neu: n })
  }
  const total = corpus.length
  return {
    total, agree, recovered, regressed, disagree, divergences,
    agreementRate: total ? agree / total : 0,
    recoveryRate: total ? recovered / total : 0,
  }
}

/** Adapt any FamilyAnswer-shaped resolver to the shadow IntakeFn contract. */
export function asIntakeFn(fn: (t: string) => { known: boolean; results: string[] } | null): IntakeFn {
  return (t) => { const r = fn(t); return r ? { known: r.known, results: r.results } : null }
}
