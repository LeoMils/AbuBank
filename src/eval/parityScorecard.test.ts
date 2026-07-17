/*
 * PARITY SCORECARD — standing suite (deterministic half of Priority 2).
 * ════════════════════════════════════════════════════════════════════
 * Runs a curated, grounded turn set (He + Es, drawn from the app's PROVEN
 * deterministic capabilities: calendar CRUD + referability, family-who, date
 * arithmetic, memory) through the REAL app entry and scores every turn on the 6
 * mandate parity dimensions. Oracles are computed from the SAME engines the runtime
 * uses (family graph + the fixed clock), so they cannot drift. Per-dimension floors
 * make this a repeatable regression: any drop names a real parity gap to fix.
 *
 * Live-model parity (a ChatGPT-class reference + judge) is the pluggable seam in
 * parityScorecard.ts — deliberately NOT run here (this env mocks the LLM). Honest
 * label: DETERMINISTIC quality parity, CODE evidence.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { runParityScorecard, formatScorecard, type ParitySession } from './parityScorecard'
import { loadGraph, type GraphNode } from '../screens/AbuAI/familyGraph'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
})

// ── oracles from the real engines (never hand-typed facts) ──
const G = loadGraph()
const byHe = new Map(G.map((n) => [n.hebrew, n]))
const nodesOf = (arr: string[]) => arr.map((h) => byHe.get(h)).filter((n): n is GraphNode => !!n)
// A parent that is the UNIQUE female parent of exactly one child → a clean "מי אמא של X" oracle.
function uniqueMotherPair(): { child: string; mother: string } {
  for (const p of G) {
    const mums = nodesOf(p.parentsHe).filter((x) => x.gender === 'female')
    if (mums.length === 1) return { child: p.hebrew, mother: mums[0]!.hebrew }
  }
  throw new Error('no unique mother pair in graph')
}
const HE_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']
const dayInNDays = (n: number) => { const t = new Date(FIXED); t.setDate(t.getDate() + n); return HE_DAYS[t.getDay()]! }

function buildSessions(): ParitySession[] {
  const mom = uniqueMotherPair()
  return [
    // He — calendar create → save → referable where → cancel it (the core CRUD chain).
    { id: 'he-calendar', turns: [
      { text: 'תקבעי פגישה עם רפי מחר בשלוש בבית קפה מרוקו', lang: 'he', cat: 'calendar', expect: 'רפי' },
      { text: 'כן', lang: 'he', cat: 'calendar', expectSide: 'saved_appointment' },
      { text: 'איפה אני פוגשת אותו?', lang: 'he', cat: 'calendar', expect: 'מרוקו' },
      { text: 'תבטלי אותה', lang: 'he', cat: 'calendar', expectSide: 'deleted' },
    ] },
    // He — family who (unique-mother oracle) + date arithmetic.
    { id: 'he-knowledge', turns: [
      { text: `מי אמא של ${mom.child}`, lang: 'he', cat: 'family', expect: mom.mother },
      { text: 'בעוד 5 ימים איזה יום', lang: 'he', cat: 'date', expect: dayInNDays(5) },
    ] },
    // He — memory store → recall.
    { id: 'he-memory', turns: [
      { text: 'תזכרי שאני אוהבת יין אדום', lang: 'he', cat: 'memory' },
      { text: 'מה את זוכרת עליי?', lang: 'he', cat: 'memory', expect: 'יין' },
    ] },
    // Es — Rioplatense calendar create → save → cancel (language-discipline focus).
    { id: 'es-calendar', turns: [
      { text: 'agendá una reunión con Gabi mañana a las tres', lang: 'es', cat: 'calendar' },
      { text: 'dale, agendalo', lang: 'es', cat: 'calendar', expectSide: 'saved_appointment' },
      { text: 'cancelalo', lang: 'es', cat: 'calendar', expectSide: 'deleted' },
    ] },
  ]
}

describe('PARITY SCORECARD — deterministic quality parity (standing suite)', () => {
  it('every dimension holds its floor on the curated real-capability turn set', async () => {
    const res = await runParityScorecard(buildSessions())
    // Surface the scorecard for the docs/eval/PARITY_SCORECARD.md refresh + triage.
    // eslint-disable-next-line no-console
    console.log('\n[PARITY]\n' + formatScorecard(res))
    for (const t of res.turns.filter((x) => x.fails.length)) {
      // eslint-disable-next-line no-console
      console.log(`  FAIL [${t.session}] «${t.text}» → ${t.fails.join(',')} :: "${t.reply.slice(0, 60)}"`)
    }
    // Floors: the deterministic engines must be RIGHT and DISCIPLINED — a drop is a real gap.
    const rate = (d: keyof typeof res.perDim) => res.perDim[d].total ? res.perDim[d].pass / res.perDim[d].total : 1
    expect(rate('correctness')).toBe(1)
    expect(rate('answered')).toBe(1)
    expect(rate('language')).toBe(1)
    expect(rate('brevity')).toBe(1)
    expect(rate('warmth')).toBe(1)
    expect(rate('naturalness')).toBe(1)
  })
})
