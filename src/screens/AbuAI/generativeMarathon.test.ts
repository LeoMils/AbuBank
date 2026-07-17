/**
 * GENERATIVE MARATHON (P4) — thousands of multi-turn sessions through the REAL app entry.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * The answer to "what Leo didn't check": a seeded generator composes full sessions
 * (family chains × calendar CRUD with pronoun referability × date arithmetic × memory
 * store/recall/forget), each turn driven through the SAME entry the app uses —
 * index.tsx's guarded pronoun/follow-up preprocessing + ExecutiveCognitiveController —
 * with MOCKED llm/online tools (so batches are fast + free + deterministic). Every
 * break is collected and printed for triage. Green batch = a real generalization signal.
 *
 * Evidence class: CODE at the app-entry level (the real controller + the real
 * preprocessing; NOT runCognitiveTurn directly). Browser-on-preview sampling
 * (e2e/preview-typed-script) confirms no lab↔app divergence.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'
import { loadGraph, type GraphNode } from './familyGraph'
import { loadAppointments, deleteAppointment } from '../AbuCalendar/service'
import { clearMemories } from './savedMemory'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
})

const TOOLS = { llm: async () => 'LLM_STUB', online: async () => ({ ok: true, answer: 'ONLINE_STUB' }) }
const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 } }
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)]!
const clearStore = () => { for (const a of loadAppointments()) deleteAppointment(a.id) }

// ── Faithful app text-entry: the guarded preprocessing + the controller. ──
async function appTurn(state: RuntimeState, msgs: Array<{ role: string; content: string }>, text: string) {
  const hasCalFocus = state.focus?.kind === 'calendar_event'
  const { resolved } = resolvePronouns(text, msgs as never)
  let eff = (resolved !== text && !hasCalFocus) ? resolved : text
  const fu = resolveFollowUp(eff, msgs as never, { pendingCreate: state.createState.phase !== 'idle' })
  if (fu.wasFollowUp && !hasCalFocus) eff = fu.resolved
  const cur = [...msgs, { role: 'user', content: eff }]
  const r = await ExecutiveCognitiveController.handleTurn(state, eff, { messages: cur, now: new Date() }, TOOLS)
  msgs.push({ role: 'user', content: eff })
  if (r.display) msgs.push({ role: 'assistant', content: r.display })
  return r
}

// ── Graph oracles (independent of the resolver). ──
const G = loadGraph()
const byHe = new Map(G.map((n) => [n.hebrew, n]))
const nodesOf = (arr: string[]) => arr.map((h) => byHe.get(h)).filter((n): n is GraphNode => !!n)
const femaleParent = (p: GraphNode) => nodesOf(p.parentsHe).filter((x) => x.gender === 'female')
const maleParent = (p: GraphNode) => nodesOf(p.parentsHe).filter((x) => x.gender === 'male')
const daughters = (p: GraphNode) => nodesOf(p.childrenHe).filter((x) => x.gender === 'female')
const sons = (p: GraphNode) => nodesOf(p.childrenHe).filter((x) => x.gender === 'male')
const HE_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']

type Step = { text: string; check: (display: string, side: string | null, state: RuntimeState) => string | null } // null = pass, else reason
interface Break { seed: number; scenario: string; text: string; reason: string; display: string }

// ── Scenario generators (each returns coherent multi-turn steps with oracles). ──
function familyWhoScenario(r: () => number): { name: string; steps: Step[] } | null {
  const withUnique = (sel: (p: GraphNode) => GraphNode[], word: string) => {
    const cands = G.filter((p) => sel(p).length === 1)
    if (!cands.length) return null
    const p = pick(r, cands); const ans = sel(p)[0]!
    return { name: `who:${word}`, steps: [{ text: `מי ${word} של ${p.hebrew}`, check: (d: string) => d.includes(ans.hebrew) ? null : `want ${ans.hebrew}` }] }
  }
  return pick(r, [
    () => withUnique(femaleParent, 'אמא'), () => withUnique(maleParent, 'אבא'),
    () => withUnique(daughters, 'הבת'), () => withUnique(sons, 'הבן'),
  ])()
}

const CAL_PEOPLE = ['רפי', 'גבי', 'מור', 'דנה', 'יוסי', 'שרה']
function calendarScenario(r: () => number): { name: string; steps: Step[] } {
  const p = pick(r, CAL_PEOPLE)
  const withLoc = r() < 0.5
  const create = `תקבעי פגישה עם ${p} מחר בשלוש${withLoc ? ' בבית קפה מרוקו' : ''}`
  const steps: Step[] = [
    { text: create, check: (d) => d.includes(p) ? null : `create card missing ${p}` },
    { text: 'כן', check: (_d, side) => side === 'saved_appointment' ? null : `save side=${side}` },
  ]
  if (withLoc) steps.push({ text: 'איפה אני פוגשת אותו?', check: (d) => d.includes('מרוקו') ? null : `referable where missing location: "${d}"` })
  // Either move-then-cancel or straight cancel.
  if (r() < 0.5) steps.push({ text: 'תעבירי אותה ליום ראשון', check: (_d, side) => side === 'updated' ? null : `move side=${side}` })
  steps.push({ text: 'תבטלי אותה', check: (_d, side, st) => side === 'deleted' ? null : `cancel side=${side} phase=${st.createState.phase}` })
  return { name: `calendar${withLoc ? '+loc' : ''}`, steps }
}

function memoryScenario(r: () => number): { name: string; steps: Step[] } {
  const fact = pick(r, ['אני אוהבת יין אדום', 'יום שישי הכי חשוב לי', 'אני אוהבת קפה עם חלב'])
  return {
    name: 'memory',
    steps: [
      { text: `תזכרי ש${fact}`, check: (d) => /אזכור|זוכרת|רשמתי/.test(d) ? null : `store: "${d}"` },
      { text: 'מה את זוכרת עליי?', check: (d) => d.includes(fact) ? null : `recall missing fact: "${d}"` },
      { text: `תשכחי ש${fact}`, check: (d) => /שכחתי|בסדר/.test(d) ? null : `forget: "${d}"` },
    ],
  }
}

function dateScenario(r: () => number): { name: string; steps: Step[] } {
  const n = 3 + Math.floor(r() * 15)
  const t = new Date(FIXED); t.setDate(t.getDate() + n)
  return { name: 'date', steps: [{ text: `בעוד ${n} ימים איזה יום`, check: (d) => d.includes(HE_DAYS[t.getDay()]!) ? null : `want ${HE_DAYS[t.getDay()]}: "${d}"` }] }
}

describe('GENERATIVE MARATHON — app-entry sessions', () => {
  it('a fresh batch of generated multi-turn sessions passes clean', async () => {
    const SESSIONS = 400
    const breaks: Break[] = []
    for (let seed = 1; seed <= SESSIONS; seed++) {
      clearStore(); clearMemories()
      const r = rng(seed * 7 + 3)
      let state: RuntimeState = IDLE_RUNTIME
      const msgs: Array<{ role: string; content: string }> = []
      const builders = [familyWhoScenario, calendarScenario, memoryScenario, dateScenario]
      const nScen = 3 + Math.floor(r() * 3) // 3..5 scenarios per session
      for (let i = 0; i < nScen; i++) {
        const scen = pick(r, builders)(r)
        if (!scen) continue
        for (const step of scen.steps) {
          const res = await appTurn(state, msgs, step.text)
          state = res.state
          const reason = step.check(res.display ?? '', res.sideEffect ?? null, state)
          if (reason) breaks.push({ seed, scenario: scen.name, text: step.text, reason, display: res.display ?? '' })
        }
      }
    }
    if (breaks.length) {
      // eslint-disable-next-line no-console
      console.log(`\n[MARATHON] ${breaks.length} break(s) across ${SESSIONS} sessions:`)
      const byClass: Record<string, number> = {}
      for (const b of breaks) { const k = `${b.scenario}:${b.reason.split(':')[0]}`; byClass[k] = (byClass[k] ?? 0) + 1 }
      console.log('[MARATHON] by class: ' + JSON.stringify(byClass))
      for (const b of breaks.slice(0, 24)) console.log(`  seed=${b.seed} [${b.scenario}] «${b.text}» → ${b.reason} :: "${b.display.slice(0, 50)}"`)
    }
    expect(breaks.map((b) => `${b.scenario}:${b.reason}`)).toEqual([])
  }, 120_000)
})
