/*
 * VERIFICATION REGIME · UNDERSTANDING-SHADOW KPIs (obligations #2, #6, #7, #8).
 * ════════════════════════════════════════════════════════════════════════════
 * Runs a Hebrew corpus through the PER-TURN shadow: the REAL legacy intake
 * (`runCognitiveTurn` + `observeOldIntake`) vs the understanding path
 * (interpret → ground → decide). Reports understanding KPIs + latency percentiles
 * — NOT test counts — and asserts the migration-safety gate:
 *
 *     regressed === 0   (understanding never LOSES what the patterns had)
 *     disagree  === 0   (understanding never resolves DIFFERENT people)
 *
 * The interpreter is a DETERMINISTIC MOCK encoding the understanding layer's TARGET
 * behavior (agree with the engines on handled turns; recover missed ones; ask on
 * ambiguity). This is CODE evidence for the shadow PIPELINE + safety gate. The
 * real-provider agreement/recovery/latency numbers over live traffic are
 * PREVIEW-class and are written to the report as PENDING, never fabricated.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { runCognitiveTurn, IDLE_RUNTIME, type RuntimeContext } from '../screens/AbuAI/cognitiveRuntime'
import { metaReason } from '../screens/AbuAI/metaReasoner'
import { observeOldIntake, runIntakeShadow, aggregateKPIs, kpiSummaryLine, type ShadowRecord } from '../screens/AbuAI/understandingShadow'
import type { InterpretTransport, StructuredIntent } from '../screens/AbuAI/understandingIntake'

const FIXED = new Date('2026-07-20T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
})

const ctx: RuntimeContext = { messages: [], now: FIXED }
const si = (o: Partial<StructuredIntent>): StructuredIntent => ({ operation: 'unknown', personRefs: [], dateWords: null, timeWords: null, place: null, title: null, fact: null, correction: null, confirmation: null, ambiguousQuestion: null, ...o })

/** A corpus entry: the turn + a builder that produces the understanding layer's
 *  structured intent (given the people the LEGACY path resolved, so agreement
 *  cases genuinely align with the deterministic engine). */
interface Entry { input: string; build: (oldPeople: string[]) => StructuredIntent; note: string }

const CORPUS: Entry[] = [
  // A · handled family relations → understanding AGREES with the engine (same people).
  { input: 'מי הבת של מרטיטה', build: (p) => si({ operation: 'family_query', personRefs: p }), note: 'agree/family' },
  { input: 'מי הבן של מרטיטה', build: (p) => si({ operation: 'family_query', personRefs: p }), note: 'agree/family' },
  { input: 'מי החתן של מור', build: (p) => si({ operation: 'family_query', personRefs: p }), note: 'agree/family' },
  { input: 'מי בת הזוג של מור', build: (p) => si({ operation: 'family_query', personRefs: p }), note: 'agree/family' },
  { input: 'מי אמא של אופיר', build: (p) => si({ operation: 'family_query', personRefs: p }), note: 'agree/family' },
  // B · indirect / paraphrased person reference the patterns MISS → understanding RECOVERS.
  { input: 'תגידי, הבחורה שנשואה לגלעד — מי היא בעצם', build: () => si({ operation: 'family_query', personRefs: ['אשתו של גלעד'] }), note: 'recovered/indirect' },
  { input: 'אני חושבת על בת הזוג של מור, איך קוראים לה', build: () => si({ operation: 'family_query', personRefs: ['בת הזוג של מור'] }), note: 'recovered/indirect' },
  { input: 'מי זאת הכלה של מרטיטה שגרה קרוב', build: () => si({ operation: 'family_query', personRefs: ['הכלה של מרטיטה'] }), note: 'recovered/indirect' },
  // C · genuinely ambiguous → understanding asks ITS ONE question.
  { input: 'תזכירי לו על זה מחר', build: () => si({ operation: 'unknown', ambiguousQuestion: 'למי להזכיר ועל מה?' }), note: 'clarify/ambiguous' },
  { input: 'תקבעי לזה משהו', build: () => si({ operation: 'calendar_create', ambiguousQuestion: 'מה לקבוע ולמתי?' }), note: 'clarify/ambiguous' },
  // D · chit-chat / non-actionable → understanding declines (both non-actionable).
  { input: 'סתם רציתי להגיד שלום', build: () => si({ operation: 'chat' }), note: 'unresolved/chat' },
  { input: 'איזה יום יפה היום', build: () => si({ operation: 'chat' }), note: 'unresolved/chat' },
]

describe('UNDERSTANDING-SHADOW KPIs · migration-safety gate + published metrics', () => {
  it('regressed=0, disagree=0 over the corpus; recovery>0; KPIs + latency reported', async () => {
    const records: ShadowRecord[] = []
    for (const e of CORPUS) {
      const decision = runCognitiveTurn(IDLE_RUNTIME, e.input, ctx)
      const meta = metaReason(e.input)
      const old = observeOldIntake(e.input, { intent: decision.intent, handled: decision.handled, domain: meta.domain })
      const transport: InterpretTransport = async () => e.build(old.people)
      records.push(await runIntakeShadow(e.input, old, transport))
    }
    const k = aggregateKPIs(records)

    // The binding migration-safety gate (obligations #2/#6/#13).
    expect(k.counts.regressed, 'understanding must never LOSE what the patterns had').toBe(0)
    expect(k.counts.disagree, 'understanding must never resolve DIFFERENT people').toBe(0)
    // The shadow is doing real work, not trivially agreeing.
    expect(k.semanticRecoveryRate, 'understanding recovers turns the patterns missed').toBeGreaterThan(0)
    expect(k.ambiguityRate, 'ambiguous turns surface a clarifying question').toBeGreaterThan(0)
    expect(k.total).toBe(CORPUS.length)

    // eslint-disable-next-line no-console
    console.info(`[SHADOW|KPI] ${kpiSummaryLine(k)}`)

    if (process.env.SHADOW_KPI_WRITE) {
      const HERE = path.dirname(fileURLToPath(import.meta.url))
      const OUT = path.resolve(HERE, '../../docs/eval/UNDERSTANDING_SHADOW_KPI.md')
      const pct = (r: number) => `${(r * 100).toFixed(1)}%`
      const lat = (p: { p50: number; p95: number; worst: number }) => `${p.p50} / ${p.p95} / ${p.worst}`
      const lines = [
        '# Understanding-Shadow KPIs (obligations #2, #6, #7, #8)',
        '',
        'Per-turn OLD (legacy pattern intake) vs NEW (understanding: interpret→ground→decide),',
        'over an internal Hebrew corpus. **CODE evidence for the shadow pipeline + the',
        'migration-safety gate.** The interpreter here is a deterministic MOCK encoding the',
        'target behavior; the real-provider agreement/recovery/latency over LIVE traffic is',
        '**PREVIEW-class and PENDING** (collected by `intakeShadowCollector` in the deployed app).',
        '',
        `Corpus size: **${k.total}** turns.`,
        '',
        '## Understanding KPIs (rates, not test counts)',
        '',
        '| KPI | Value |',
        '|---|---|',
        `| Agreement | ${pct(k.agreementRate)} |`,
        `| Semantic recovery | ${pct(k.semanticRecoveryRate)} |`,
        `| Disagreement (people) — MUST be 0 | ${pct(k.disagreementRate)} |`,
        `| Regression — MUST be 0 | ${pct(k.regressionRate)} |`,
        `| Clarification (ambiguity) | ${pct(k.ambiguityRate)} |`,
        `| Clarify-while-legacy-acted (REVIEW — often the safer path) | ${pct(k.falseClarificationRate)} |`,
        `| Unresolved-intent | ${pct(k.unresolvedIntentRate)} |`,
        '',
        '## Latency (ms · p50 / p95 / worst)',
        '',
        '| Stage | p50 / p95 / worst |',
        '|---|---|',
        `| interpret (MOCK — real=PREVIEW) | ${lat(k.latency.interpret)} |`,
        `| ground (deterministic) | ${lat(k.latency.ground)} |`,
        `| decide (deterministic) | ${lat(k.latency.decide)} |`,
        `| total | ${lat(k.latency.total)} |`,
        '',
        '## Buckets',
        '',
        Object.entries(k.counts).map(([b, n]) => `- ${b}: ${n}`).join('\n'),
        '',
        '## Findings surfaced by the shadow',
        '',
        `- **Clarify-while-legacy-acted (${k.counts.false_clarify}):** on under-specified turns`,
        '  (e.g. "תקבעי לזה משהו", "תזכירי לו על זה מחר") the LEGACY path starts an action while the',
        '  understanding path asks ONE question. This is the understanding path being SAFER — a',
        '  candidate to migrate once confirmed on live traffic, not a regression.',
        `- **Regression / people-disagreement: ${k.counts.regressed} / ${k.counts.disagree}** — the`,
        '  migration-safety gate holds (both must be 0).',
        '',
        '**Leo\'s free-language device round decides readiness — nothing else does.**',
        '',
      ]
      fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
    }
  })
})
