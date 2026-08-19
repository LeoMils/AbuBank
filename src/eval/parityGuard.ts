/*
 * WEEKLY PARITY GUARD — drift detection.
 * ══════════════════════════════════════
 * Reruns the three standing signals through the REAL app entry and produces one dated
 * report, so a regression that slips past a single suite is caught as a drift:
 *   1. Parity scorecard   — the 6 mandate dimensions over a compact grounded He+Es set
 *                           (REUSES runParityScorecard → the existing judges; no rebuild).
 *   2. Marathon smoke     — a batch of varied real-shaped turns replayed through the
 *                           controller; every turn must stay finalized + on-truth.
 *   3. Flight-recorder    — Leo's real device transcripts replayed (importLeoRepro).
 * Runnable manually (`npm run parity:guard`) or scheduled. Evidence class: CODE.
 */
import { runParityScorecard, DIMENSIONS, type ParitySession, type Dim } from './parityScorecard'
import { importLeoRepro, replayExport, type FlightRecorderExport } from './flightRecorderImport'
import fs from 'fs'
import path from 'path'

// Compact, grounded parity set (real capabilities: family / date / calendar CRUD +
// referability / memory / Rioplatense). Kept small so the guard is fast to rerun.
const GUARD_PARITY: ParitySession[] = [
  { id: 'he-cal', turns: [
    { text: 'תקבעי פגישה עם רפי מחר בשלוש בבית קפה מרוקו', lang: 'he', cat: 'calendar', expect: 'רפי' },
    { text: 'כן', lang: 'he', cat: 'calendar', expectSide: 'saved_appointment' },
    { text: 'איפה אני פוגשת אותו?', lang: 'he', cat: 'calendar', expect: 'מרוקו' },
    { text: 'תבטלי אותה', lang: 'he', cat: 'calendar', expectSide: 'deleted' },
  ] },
  { id: 'he-mem', turns: [
    { text: 'תזכרי שאני אוהבת יין אדום', lang: 'he', cat: 'memory' },
    { text: 'מה את זוכרת עליי?', lang: 'he', cat: 'memory', expect: 'יין' },
  ] },
  { id: 'es-crud', turns: [
    { text: 'agendá una reunión con Gabi mañana a las tres', lang: 'es', cat: 'calendar' },
    { text: 'dale, agendalo', lang: 'es', cat: 'calendar', expectSide: 'saved_appointment' },
    { text: 'cancelalo', lang: 'es', cat: 'calendar', expectSide: 'deleted' },
  ] },
]

// Marathon smoke — varied real-shaped turns (relation-phrase create, rambling, ordinal,
// cross-language cancel). Replayed through the controller; each must answer non-empty.
const GUARD_SMOKE: FlightRecorderExport = {
  version: '1.0.0',
  sessions: [
    { id: 'smoke-relation-create', turns: [{ input: 'תקבעי פגישה עם החתן של רפי מחר בשלוש', lang: 'he', expectContains: ['גלעד'] }] },
    { id: 'smoke-rambling', turns: [{ input: 'אז תשמעי, דיברתי עם החתן של רפי, ורוצים להיפגש מחר בשלוש בבית קפה טולדנו לדבר על הטיול', lang: 'he', expectContains: ['גלעד', 'טולדנו'], expectAbsent: ['סיפר לי'] }] },
    { id: 'smoke-ordinal', turns: [
      { input: 'תקבעי פגישה עם רפי מחר בשלוש', lang: 'he', expectContains: ['רפי'] },
      { input: 'כן', lang: 'he', expectSide: 'saved_appointment' },
      { input: 'תקבעי פגישה עם דנה ביום ראשון בארבע', lang: 'he', expectContains: ['דנה'] },
      { input: 'כן', lang: 'he', expectSide: 'saved_appointment' },
      { input: 'תבטלי את הפגישה הראשונה', lang: 'he', expectSide: 'deleted' },
    ] },
  ],
}

export interface ParityGuardResult {
  date: string
  parity: { perDim: Record<Dim, { pass: number; total: number; rate: number }>; modelDependent: number; ok: boolean }
  marathonSmoke: { turns: number; failures: number; ok: boolean; failing: string[] }
  flightRecorder: { turns: number; failures: number; ok: boolean; failing: string[] }
  ok: boolean
}

/** Run all three signals. `date` is injected (deterministic; no Date.now inside). */
export async function runParityGuard(date: string): Promise<ParityGuardResult> {
  const p = await runParityScorecard(GUARD_PARITY)
  const perDim = Object.fromEntries(DIMENSIONS.map((d) => {
    const { pass, total } = p.perDim[d]
    return [d, { pass, total, rate: total ? pass / total : 1 }]
  })) as ParityGuardResult['parity']['perDim']
  const parityOk = DIMENSIONS.every((d) => perDim[d].rate === 1)

  const smoke = await replayExport(GUARD_SMOKE)
  const fr = await replayExport(importLeoRepro(fs.readFileSync(path.resolve(__dirname, '../../docs/eval/LEO_DEVICE_FAILURES_REPRO.json'), 'utf8')))

  const marathonSmoke = { turns: smoke.turns.length, failures: smoke.failures.length, ok: smoke.failures.length === 0, failing: smoke.failures.map((t) => t.session) }
  const flightRecorder = { turns: fr.turns.length, failures: fr.failures.length, ok: fr.failures.length === 0, failing: fr.failures.map((t) => t.session) }

  return {
    date,
    parity: { perDim, modelDependent: p.modelDependent, ok: parityOk },
    marathonSmoke, flightRecorder,
    ok: parityOk && marathonSmoke.ok && flightRecorder.ok,
  }
}

/** Markdown report body for docs/eval/PARITY_GUARD_LATEST.md. */
export function formatParityGuard(r: ParityGuardResult): string {
  const dimRows = DIMENSIONS.map((d) => `| ${d} | ${r.parity.perDim[d].pass}/${r.parity.perDim[d].total} | ${Math.round(r.parity.perDim[d].rate * 100)}% |`)
  return [
    `# Parity Guard — ${r.date}`,
    ``,
    `**Overall: ${r.ok ? '✅ GREEN (no drift)' : '❌ DRIFT DETECTED'}** · evidence class: CODE`,
    ``,
    `## Parity scorecard (6 dimensions)`,
    `| dimension | pass | rate |`,
    `| --- | --- | --- |`,
    ...dimRows,
    ``,
    `_model-dependent (LLM-routed, not scored): ${r.parity.modelDependent}._`,
    ``,
    `## Marathon smoke`,
    `- turns: ${r.marathonSmoke.turns} · failures: ${r.marathonSmoke.failures} · ${r.marathonSmoke.ok ? 'OK' : 'FAIL: ' + r.marathonSmoke.failing.join(', ')}`,
    ``,
    `## Flight-recorder (Leo real device transcripts)`,
    `- turns: ${r.flightRecorder.turns} · failures: ${r.flightRecorder.failures} · ${r.flightRecorder.ok ? 'OK' : 'FAIL: ' + r.flightRecorder.failing.join(', ')}`,
    ``,
  ].join('\n')
}
