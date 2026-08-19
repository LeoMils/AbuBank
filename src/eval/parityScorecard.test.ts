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
    // He — relation-phrase create (saves the RESOLVED person) → ordinal "first" cancel.
    { id: 'he-relation-ordinal', turns: [
      { text: 'תקבעי פגישה עם רפי מחר בשלוש', lang: 'he', cat: 'calendar', expect: 'רפי' },
      { text: 'כן', lang: 'he', cat: 'calendar', expectSide: 'saved_appointment' },
      { text: 'תקבעי פגישה עם דנה ביום ראשון בארבע', lang: 'he', cat: 'calendar', expect: 'דנה' },
      { text: 'כן', lang: 'he', cat: 'calendar', expectSide: 'saved_appointment' },
      { text: 'תבטלי את הפגישה הראשונה', lang: 'he', cat: 'calendar', expectSide: 'deleted' },
    ] },
    // Es — Rioplatense calendar create → save → cancel (language-discipline focus).
    { id: 'es-calendar', turns: [
      { text: 'agendá una reunión con Gabi mañana a las tres', lang: 'es', cat: 'calendar' },
      { text: 'dale, agendalo', lang: 'es', cat: 'calendar', expectSide: 'saved_appointment' },
      { text: 'cancelalo', lang: 'es', cat: 'calendar', expectSide: 'deleted' },
    ] },
    // Es — under-tested surfaces (family / memory). No `expect` oracle: these only score
    // language + brevity + warmth when the app answers DETERMINISTICALLY; if they route to
    // the LLM they are reported model-dependent (not counted), never falsely passed. Their
    // job is to catch a DETERMINISTIC Spanish reply that leaks Hebrew or a menu (a real gap).
    { id: 'es-probes', turns: [
      { text: '¿quién es Gabi?', lang: 'es', cat: 'family' },
      { text: 'recordá que me gusta el vino tinto', lang: 'es', cat: 'memory' },
    ] },

    // ── REAL Leo device flows (docs/eval/LEO_DEVICE_FAILURES_REPRO.json +
    //    deviceFailuresTriage.test.ts). Each turn is grounded in something Leo
    //    actually typed on device; the `expect` oracle asserts the answer names
    //    the right person/place so a silent drift reds correctness. ──
    // Midnight + person + place extraction (title must not be the whole sentence).
    { id: 'he-cal-midnight', turns: [
      { text: 'תקבעי פגישה עם אופיר מחר בחצות בקפה אילנה', lang: 'he', cat: 'calendar', expect: 'אופיר' },
    ] },
    // Relation-BETWEEN two family members (He) — reply must name the queried person.
    { id: 'he-fam-between', turns: [
      { text: 'מה הקשר בין אנבל ללאו', lang: 'he', cat: 'family', expect: 'לאו' },
    ] },
    // Same relation in Rioplatense — the deterministic Spanish reply must not leak Hebrew.
    { id: 'es-fam-between', turns: [
      { text: '¿qué relación hay entre Anabel y Leo?', lang: 'es', cat: 'family', expect: 'Leo' },
    ] },
    // Relation-FOR ("מי X עבור Y") — the in-law edge resolves deterministically.
    { id: 'he-relation-for', turns: [
      { text: 'מי גלעד עבור רפי', lang: 'he', cat: 'family', expect: 'רפי' },
    ] },
    // P2 rambling-story create: buried in narrative, the confirm must resolve the
    // relation-phrase person (גלעד), keep the real place, and NOT restate the subject
    // twice (the "בנושא … (…)" duplication fixed in shapeCreateConfirm) — so brevity holds.
    { id: 'he-rambling-create', turns: [
      { text: 'אז תשמעי, דיברתי היום עם החתן של רפי, והוא סיפר לי שהוא טס לניו יורק בשבוע הבא, ואנחנו רוצים להיפגש מחר בשלוש אחר הצהריים בבית קפה טולדנו כדי לדבר על הטיול המשפחתי', lang: 'he', cat: 'calendar', expect: 'גלעד' },
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
