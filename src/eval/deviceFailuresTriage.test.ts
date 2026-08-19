/*
 * Device-observed failures — triage probe (text-only, real runtime)
 * ═════════════════════════════════════════════════════════════════
 * Drives the REAL controller over the SPECIFIC failures Leo saw on device, so we can
 * see which are already fixed (cycles 1–11) and which are still RED. PROBE (prints a
 * report; instrumented online tool captures the query passed). Evidence class: CODE.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

beforeAll(() => {
  const m = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) }, clear: () => { m.clear() },
    key: (i: number) => Array.from(m.keys())[i] ?? null, get length() { return m.size },
  }
})
afterAll(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

const NOW = new Date(2026, 6, 15, 10, 0, 0) // Wed 2026-07-15
const onlineLog: string[] = []
const TOOLS: FullTurnTools = {
  llm: async () => '[LLM_ECHO]',
  online: async (q: string) => { onlineLog.push(q); return { ok: true, answer: `[ONLINE for: ${q}]` } },
}
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function one(input: string) {
  saveAppointments([]); onlineLog.length = 0
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim(), online: [...onlineLog] }
}

const CASES: Array<{ id: string; input: string; want: string }> = [
  // ── ONLINE ──
  { id: 'ONL-Y"DAY', input: 'מי ניצח אתמול במשחק?', want: 'route online; query keeps "אתמול" (yesterday), not today' },
  { id: 'ONL-TOP', input: 'מי מלך השערים במונדיאל?', want: 'route online (top scorer), not LLM' },
  { id: 'ONL-SCORE', input: 'מה התוצאה של המשחק אתמול?', want: 'online, keeps yesterday' },
  // ── DATES: Independence Day / memorial ──
  { id: 'DAT-INDEP', input: 'מתי יום העצמאות הבא?', want: 'deterministic/honest, NEVER a hallucinated past year' },
  { id: 'DAT-ZIKARON', input: 'מתי יום הזיכרון הבא?', want: 'deterministic/honest' },
  // ── CALENDAR: midnight + person + place ──
  { id: 'CAL-MIDNIGHT', input: 'פגישה עם אופיר מחר בחצות בקפה אילנה', want: 'person=אופיר, place=קפה אילנה, time=00:00; NOT "what time?", title not whole sentence' },
  { id: 'CAL-MIDNIGHT2', input: 'תקבעי פגישה עם אופיר מחר בחצות בקפה אילנה', want: 'same, with create verb' },
  // ── MEMORY honesty ──
  { id: 'MEM-YDAY', input: 'את זוכרת מה אמרתי לך אתמול?', want: 'honest — never implies it has cross-session memory' },
  // ── CONVERSATION continuity ──
  { id: 'CONV-LASTQ', input: 'מה שאלתי אותך קודם?', want: 'recall last question (or honest if none this session)' },
  // ── FAMILY both directions + Spanish ──
  { id: 'FAM-BETWEEN', input: 'מה הקשר בין אנבל ללאו?', want: 'deterministic relation' },
  { id: 'FAM-ES-BETWEEN', input: '¿qué relación hay entre Anabel y Leo?', want: 'Spanish relation, deterministic' },
]

describe('device-observed failures — triage', () => {
  it('prints outputs + a multi-turn context-mix probe', async () => {
    const rows = [] as Array<{ id: string; want: string; input: string; intent: string; source: string; display: string; online: string[] }>
    for (const c of CASES) rows.push({ ...c, ...(await one(c.input)) })

    // Multi-turn: two DIFFERENT online questions in a row (stale-answer / repeat).
    saveAppointments([]); onlineLog.length = 0
    const o1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מי ניצח במשחק אתמול?', ctx(), TOOLS)
    const o2 = await ExecutiveCognitiveController.handleTurn(o1.state, 'ומי מלך השערים?', ctx(), TOOLS)

    // Multi-turn: create context should NOT leak into a new create.
    saveAppointments([])
    const c1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תקבעי פגישה עם דני מחר בשבע', ctx(), TOOLS)
    const c2 = await ExecutiveCognitiveController.handleTurn(c1.state, 'לא משנה, תקבעי פגישה עם מור ביום ראשון בעשר', ctx(), TOOLS)

    const L: string[] = ['\n════ DEVICE FAILURES TRIAGE ════', `NOW=${NOW.toDateString()}`]
    for (const r of rows) {
      L.push(`[${r.id}] "${r.input}"`); L.push(`   want: ${r.want}`)
      L.push(`   intent=${r.intent} source=${r.source} onlineQ=${JSON.stringify(r.online)}`)
      L.push(`   → ${r.display}`)
    }
    L.push('\n── two different online turns ──')
    L.push(`  O1 → ${(o1.display ?? '').replace(/\s+/g, ' ').trim()}`)
    L.push(`  O2 "ומי מלך השערים?" → ${(o2.display ?? '').replace(/\s+/g, ' ').trim()}`)
    L.push('── create context should not leak ──')
    L.push(`  C1 → ${(c1.display ?? '').replace(/\s+/g, ' ').trim()}`)
    L.push(`  C2 (new create מור) → ${(c2.display ?? '').replace(/\s+/g, ' ').trim()}`)
    L.push('════════════════════════════════\n')
    // eslint-disable-next-line no-console
    console.log(L.join('\n'))
    expect(rows.length).toBeGreaterThan(0)
  })
})
