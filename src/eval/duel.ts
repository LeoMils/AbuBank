/*
 * CHAMPION vs CHALLENGER — the promotion duel (Constitution §6).
 * ═════════════════════════════════════════════════════════════
 * A build is promotable ONLY if it beats the previous build on the ENTIRE corpus with
 * NO dimension regressing. The corpus is the union of every standing signal — the parity
 * scorecard (6 dimensions), the marathon smoke, the flight-recorder reality replay, and
 * the metamorphic mirror suite — scored into one per-dimension scorecard. `duel` is a
 * pure comparison; a single regressed dimension BLOCKS promotion. The weekly guard runs
 * the same duel and emits Leo one plain-Hebrew line.
 *
 * REUSE, not rebuild: corpusScore composes runParityGuard (src/eval/parityGuard) + the
 * mirror suite (src/truth/mirrorSuite). No parallel scoring path.
 */
import fs from 'fs'
import path from 'path'
import { runParityGuard } from './parityGuard'
import { DIMENSIONS } from './parityScorecard'
import { generateRelationMirrors, runMirrors } from '../truth/mirrorSuite'

export interface Dimension { name: string; pass: number; total: number }
export interface Scorecard { dimensions: Dimension[] }
export const rateOf = (d: Dimension): number => (d.total ? d.pass / d.total : 1)

/** Score the WHOLE corpus into one per-dimension scorecard (the real current build). */
export async function corpusScore(date: string): Promise<Scorecard> {
  const g = await runParityGuard(date)
  const m = runMirrors(generateRelationMirrors(['he', 'es']))
  const dimensions: Dimension[] = [
    ...DIMENSIONS.map((k) => ({ name: `parity:${k}`, pass: g.parity.perDim[k].pass, total: g.parity.perDim[k].total })),
    { name: 'marathonSmoke', pass: g.marathonSmoke.turns - g.marathonSmoke.failures, total: g.marathonSmoke.turns },
    { name: 'flightRecorder', pass: g.flightRecorder.turns - g.flightRecorder.failures, total: g.flightRecorder.turns },
    { name: 'mirrors', pass: m.passed, total: m.total },
  ]
  return { dimensions }
}

export interface DimDelta { name: string; champion: number; challenger: number }
export interface DuelResult {
  promotable: boolean
  regressions: DimDelta[]
  improvements: DimDelta[]
  caught: number      // total failing checks in the challenger this run
  fixed: number       // dimensions that improved vs champion
  returned: number    // dimensions that regressed vs champion (MUST be 0 to promote)
  summaryHe: string   // Leo's one plain-Hebrew line
}

/**
 * The duel: challenger is promotable ONLY if NO dimension regressed vs champion. A dimension
 * present in the champion but MISSING from the challenger counts as a regression (coverage lost).
 */
export function duel(champion: Scorecard, challenger: Scorecard): DuelResult {
  const champMap = new Map(champion.dimensions.map((d) => [d.name, d]))
  const challMap = new Map(challenger.dimensions.map((d) => [d.name, d]))
  const regressions: DimDelta[] = []
  const improvements: DimDelta[] = []
  let caught = 0
  for (const cd of challenger.dimensions) caught += cd.total - cd.pass
  for (const champ of champion.dimensions) {
    const chall = challMap.get(champ.name)
    const pr = rateOf(champ)
    const cr = chall ? rateOf(chall) : 0 // lost coverage = worst case
    if (cr < pr) regressions.push({ name: champ.name, champion: pr, challenger: cr })
    else if (chall && cr > pr) improvements.push({ name: champ.name, champion: pr, challenger: cr })
  }
  void champMap
  const returned = regressions.length
  const fixed = improvements.length
  const promotable = returned === 0
  const summaryHe = `השבוע: ${caught} נתפסו, ${fixed} תוקנו, ${returned} חזרו (חובה: 0 חזרו) — ${promotable ? 'עבר ✓' : 'נחסם ✗'}`
  return { promotable, regressions, improvements, caught, fixed, returned, summaryHe }
}

// ── the promoted champion baseline (last build that passed the duel) ──────────
const BASELINE = path.resolve(__dirname, '../../docs/eval/CHAMPION_BASELINE.json')
export function loadChampion(): Scorecard | null {
  try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Scorecard } catch { return null }
}

export interface WeeklyDuel { result: DuelResult; challenger: Scorecard; hadBaseline: boolean }
/**
 * The WEEKLY GUARD's promotion step: score the current build, duel it against the stored
 * champion baseline (or self on the first run), and produce Leo's one plain-Hebrew line.
 * With `write`, refreshes docs/eval/DUEL_LATEST.md and — only if promotable — advances the
 * champion baseline. `champion` may be injected for tests. Never throws into a normal run.
 */
export async function runWeeklyDuel(date: string, opts: { champion?: Scorecard; write?: boolean } = {}): Promise<WeeklyDuel> {
  const challenger = await corpusScore(date)
  const champion = opts.champion ?? loadChampion()
  const hadBaseline = !!champion
  const result = duel(champion ?? challenger, challenger) // first run → self-duel (promotable)
  if (opts.write) {
    const body = [
      `# Champion vs Challenger — ${date}`, ``, `**${result.summaryHe}**`, ``,
      `- promotable: ${result.promotable ? 'YES' : 'NO (blocked)'}`,
      `- regressions: ${result.regressions.map((r) => `${r.name} ${Math.round(r.champion * 100)}%→${Math.round(r.challenger * 100)}%`).join(', ') || 'none'}`,
      `- improvements: ${result.improvements.map((r) => r.name).join(', ') || 'none'}`,
      ``, `_Corpus dimensions: ${challenger.dimensions.map((d) => `${d.name} ${d.pass}/${d.total}`).join(' · ')}_`, ``,
    ].join('\n')
    try {
      fs.writeFileSync(path.resolve(__dirname, '../../docs/eval/DUEL_LATEST.md'), body)
      if (result.promotable) fs.writeFileSync(BASELINE, JSON.stringify(challenger, null, 2)) // promote
    } catch { /* report write is best-effort */ }
  }
  return { result, challenger, hadBaseline }
}
