/*
 * Intelligence Gap Probe 2 — harder scenarios (text-only, real runtime)
 * ════════════════════════════════════════════════════════════════════
 * The ranked gaps from probe 1 are closed (cycles 1–8). This widens the corpus to
 * surface the NEXT real gaps: mid-create field corrections, deeper family chains,
 * age/number facts, date arithmetic, Spanish calendar create, in-conversation memory.
 * PROBE (not a gate): prints a report the operator reads. Evidence class: CODE.
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
const TOOLS: FullTurnTools = { llm: async () => '[LLM_ECHO]', online: async (q: string) => ({ ok: true, answer: `[ONLINE:${q}]` }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
const one = async (input: string) => {
  saveAppointments([])
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

const SINGLE: Array<{ id: string; input: string; note: string }> = [
  { id: 'AGE1', input: 'בן כמה עדי?', note: 'age from data if known, else honest' },
  { id: 'AGE2', input: 'בת כמה מרטיטה?', note: 'age' },
  { id: 'FAM-CHAIN', input: 'מי סבתא של אנבל?', note: 'grandmother chain → Mor? Martita?' },
  { id: 'FAM-SIB', input: 'מי אח של מור?', note: 'brother of Mor = Leo' },
  { id: 'FAM-UNK', input: 'מי זה חורחה?', note: 'unknown — must not invent' },
  { id: 'DATE-ADD', input: 'איזה יום יהיה בעוד שבוע?', note: 'in a week → Wed 2026-07-22' },
  { id: 'DATE-3D', input: 'איזה תאריך יהיה בעוד שלושה ימים?', note: '2026-07-18' },
  { id: 'DATE-NEXTSUN', input: 'מתי יום ראשון הבא?', note: 'next Sunday 2026-07-19' },
  { id: 'TIME-ADD', input: 'מה השעה בעוד שעתיים?', note: 'now 10:00 → 12:00' },
  { id: 'ES-CREATE', input: 'agendá una cena con Anabel el viernes a las ocho', note: 'Spanish dinner create' },
  { id: 'ES-FAM', input: '¿quién es la hija de Martita?', note: 'Spanish daughter → Mor' },
]

describe('Intelligence Gap Probe 2 (harder corpus)', () => {
  it('prints a report + runs mid-create correction chains', async () => {
    const rows = [] as Array<{ id: string; input: string; note: string; intent: string; source: string; display: string }>
    for (const s of SINGLE) rows.push({ ...s, ...(await one(s.input)) })

    // Mid-create field corrections (shared state)
    const tools = TOOLS
    saveAppointments([])
    const p1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תקבעי פגישה עם דני מחר בשבע בערב', ctx(), tools)
    const p2 = await ExecutiveCognitiveController.handleTurn(p1.state, 'לא, לא עם דני, עם מור', ctx(), tools) // change PERSON
    saveAppointments([])
    const q1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תקבעי פגישה עם דני ביום שישי בשבע בערב', ctx(), tools)
    const q2 = await ExecutiveCognitiveController.handleTurn(q1.state, 'לא ביום שישי, ביום ראשון', ctx(), tools) // change DAY

    const L: string[] = ['\n════════ GAP PROBE 2 ════════', `NOW=${NOW.toDateString()}`]
    for (const r of rows) { L.push(`[${r.id}] "${r.input}"  (${r.note})`); L.push(`   intent=${r.intent} source=${r.source} → ${r.display}`) }
    L.push('\n── mid-create: change PERSON ──')
    L.push(`  P1 → ${(p1.display ?? '').replace(/\s+/g, ' ').trim()}`)
    L.push(`  P2 "לא עם דני, עם מור" → ${(p2.display ?? '').replace(/\s+/g, ' ').trim()}`)
    L.push('── mid-create: change DAY ──')
    L.push(`  Q1 → ${(q1.display ?? '').replace(/\s+/g, ' ').trim()}`)
    L.push(`  Q2 "לא שישי, ראשון" → ${(q2.display ?? '').replace(/\s+/g, ' ').trim()}`)
    L.push('═════════════════════════════\n')
    // eslint-disable-next-line no-console
    console.log(L.join('\n'))
    expect(rows.length).toBeGreaterThan(0)
  })
})
