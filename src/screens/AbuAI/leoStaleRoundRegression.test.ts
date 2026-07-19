/*
 * Leo's "catastrophic" verification round — PERMANENT regressions.
 * ═══════════════════════════════════════════════════════════════
 * That round ran on a 49-versions-stale build (0.79.0). These encode the observed
 * failures against the CURRENT app entry, so they can never silently regress again:
 *   - Bug 1 (calendar which-day/when): a saved meeting queried for its day/when must
 *     return DAY + DATE + TIME — never only the hour, a location dead-end, or the LLM.
 *   - Bug 2 (family contradiction): עדי & נועם are BROTHERS (twins) — the deterministic
 *     graph answers, never an invented "בן דוד". Any family fact comes from the graph.
 *   - Bug 3 (relation-phrase create): "אח של נועם" resolves to עדי, never saved literally.
 *   - Bug 4 (in-law chain): "מה הקשר בין ירדן לנועם" composes the real chain (עילי).
 * Evidence class: CODE.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { saveAppointments } from '../AbuCalendar/service'
import type { FullTurnTools } from './runtimeFullTurn'

const FIXED = new Date('2026-07-19T09:00:00') // Sunday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
  saveAppointments([])
})
// LLM returns a sentinel — a family/calendar fact must NEVER come from here.
const LLM_SENTINEL = '[[LLM]]'
const TOOLS: FullTurnTools = { llm: async () => LLM_SENTINEL, online: async () => ({ ok: true, answer: 'x', reason: null }) }

async function run(seq: string[]) {
  let state: RuntimeState = IDLE_RUNTIME
  const msgs: Array<{ role: string; content: string }> = []
  const out: Array<{ input: string; source: string; display: string; side: string | null }> = []
  for (const text of seq) {
    const r = await ExecutiveCognitiveController.handleTurn(state, text, { messages: msgs, now: FIXED }, TOOLS)
    state = r.state
    msgs.push({ role: 'user', content: text }); if (r.display) msgs.push({ role: 'assistant', content: r.display })
    out.push({ input: text, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim(), side: r.sideEffect ?? null })
  }
  return out
}

describe('Leo stale-round — Bug 1: calendar which-day/when returns DAY + DATE + TIME', () => {
  it('after saving a meeting, "באיזה יום" gives the weekday + date + time (not only the hour, not a dead-end, not the LLM)', async () => {
    const [, , whichDay] = await run(['תקבעי פגישה עם רפי מחר בשלוש', 'כן', 'באיזה יום הפגישה'])
    expect(whichDay!.source).not.toBe('llm')
    expect(whichDay!.display).not.toContain(LLM_SENTINEL)
    expect(whichDay!.display).not.toContain('לא מצאתי')           // not a location dead-end
    expect(whichDay!.display).toMatch(/יום (?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|מחר/) // the DAY
    expect(whichDay!.display).toContain('20 ביולי')               // the DATE (tomorrow = Mon 20 Jul)
    expect(whichDay!.display).toContain('15:00')                   // the TIME
  })

  it('bare "מתי" about the focused meeting also gives day + date + time deterministically', async () => {
    const [, , when] = await run(['תקבעי פגישה עם רפי מחר בשלוש', 'כן', 'מתי הפגישה'])
    expect(when!.source).not.toBe('llm')
    expect(when!.display).toMatch(/יום (?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|מחר/)
    expect(when!.display).toContain('15:00')
  })
})

describe('Leo stale-round — Bug 2: family relations are graph-sourced, never fabricated', () => {
  it('עדי and נועם are BROTHERS (twins) — deterministic, no invented "בן דוד"', async () => {
    const [a] = await run(['מה הקשר בין עדי לנועם'])
    expect(a!.source).toBe('deterministic')
    expect(a!.display).not.toContain(LLM_SENTINEL)
    expect(a!.display).toMatch(/אח|אחים|תאום/)
    expect(a!.display).not.toContain('בן דוד')
    const [b] = await run(['מי עדי לנועם'])
    expect(b!.source).toBe('deterministic')
    expect(b!.display).toMatch(/אח|אחים|תאום/)
    expect(b!.display).not.toContain('בן דוד')
  })
})

describe('Leo stale-round — Bug 3: a relation-phrase create resolves the person', () => {
  it('"אח של נועם" schedules with עדי, never the literal phrase', async () => {
    const [create] = await run(['תקבעי פגישה עם אח של נועם מחר בארבע'])
    expect(create!.display).toContain('עדי')
    expect(create!.display).not.toContain('אח של נועם')
  })
})

describe('Leo stale-round — Bug 4: composed in-law chain', () => {
  it('"מה הקשר בין ירדן לנועם" composes the real chain via עילי (deterministic)', async () => {
    const [rel] = await run(['מה הקשר בין ירדן לנועם'])
    expect(rel!.source).toBe('deterministic')
    expect(rel!.display).not.toContain(LLM_SENTINEL)
    expect(rel!.display).toContain('עילי')
  })
})
