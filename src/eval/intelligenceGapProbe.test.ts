/*
 * Intelligence Gap Probe (text-only, real runtime)
 * ════════════════════════════════════════════════
 * Drives the REAL ExecutiveCognitiveController.handleTurn over a broad
 * Hebrew + Spanish + mixed corpus with NO microphone and NO network — the LLM
 * and online tools are injected/instrumented so every routing + reasoning
 * decision is machine-observable. This is a PROBE, not a pass/fail gate: it
 * prints a structured report the operator reads to build docs/INTELLIGENCE_GAP_MAP.md.
 *
 * Evidence class: CODE (deterministic runtime), no device/preview claim.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'

// Real browsers provide localStorage; the node test env does not. Calendar
// save→readback goes through it, so polyfill a synchronous mirror to observe the
// TRUE runtime save behavior (otherwise every save reads back empty — a node
// artifact, not a product bug).
beforeAll(() => {
  const m = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
    clear: () => { m.clear() },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size },
  }
})
afterAll(() => { delete (globalThis as { localStorage?: unknown }).localStorage })
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

// Fixed "now": Wednesday 2026-07-15 10:00 local. Deterministic relative-date base.
const NOW = new Date(2026, 6, 15, 10, 0, 0)

interface Probe { id: string; cls: string; input: string; note?: string }

// One-shot probes (fresh IDLE state each). Multi-turn handled separately below.
const CORPUS: Probe[] = [
  // ── 1. DATE / TIME REASONING ────────────────────────────────────────────────
  { id: 'D1', cls: 'date', input: 'איזה יום היום?', note: 'today = Wed 2026-07-15' },
  { id: 'D2', cls: 'date', input: 'מה התאריך היום?', note: 'today' },
  { id: 'D3', cls: 'date', input: 'איזה יום היה אתמול?', note: 'EXPECT yesterday Tue 2026-07-14' },
  { id: 'D4', cls: 'date', input: 'איזה תאריך היה אתמול?', note: 'EXPECT 2026-07-14, NOT today' },
  { id: 'D5', cls: 'date', input: 'מה התאריך מחר?', note: 'EXPECT 2026-07-16' },
  { id: 'D6', cls: 'date', input: 'איזה יום יהיה מחר?', note: 'EXPECT Thu' },
  { id: 'D7', cls: 'date', input: 'איזה יום היה שלשום?', note: 'EXPECT Mon 2026-07-13' },
  { id: 'D8', cls: 'date', input: 'מה השעה?', note: 'EXPECT 10:00' },
  { id: 'D9', cls: 'date', input: 'מתי החג הבא?', note: 'EXPECT next holiday after 07-15 = ראש השנה 2026-09-22' },
  { id: 'D10', cls: 'date', input: 'מתי פסח הבא?', note: 'EXPECT פסח 2027-03-22 (next after today)' },
  { id: 'D11', cls: 'date', input: '¿qué día es hoy?', note: 'Spanish today' },
  { id: 'D12', cls: 'date', input: '¿qué día fue ayer?', note: 'Spanish EXPECT yesterday' },

  // ── 2. ONLINE / CURRENT INFO ────────────────────────────────────────────────
  { id: 'O1', cls: 'online', input: 'מה מזג האוויר היום בכפר סבא?', note: 'live retrieval' },
  { id: 'O2', cls: 'online', input: 'מי ראש הממשלה של ישראל עכשיו?', note: 'must retrieve, not memory' },
  { id: 'O3', cls: 'online', input: 'מה קרה היום בחדשות?', note: 'live' },
  { id: 'O4', cls: 'online', input: 'מתי האוטובוס הבא מכפר סבא לתל אביב?', note: 'live' },

  // ── 3. CALENDAR CREATION ────────────────────────────────────────────────────
  { id: 'C1', cls: 'calendar', input: 'תקבעי פגישה עם דני מחר בשבע בערב', note: 'person+relday+time' },
  { id: 'C2', cls: 'calendar', input: 'קבעי לי תור לרופא ביום שלישי בעשר בבוקר אצל ד״ר כהן', note: 'place+relday+time' },
  { id: 'C3', cls: 'calendar', input: 'תזכירי לי לקחת תרופות מחר בחצות', note: 'midnight/בחצות → 00:00' },
  { id: 'C4', cls: 'calendar', input: 'קבעי ארוחת ערב עם אנבל ביום שישי בשמונה', note: 'title should be ארוחת ערב, not whole sentence' },
  { id: 'C5', cls: 'calendar', input: 'תקבעי פגישה עם הרופא מחר בבוקר בקופת חולים בכפר סבא בתשע', note: 'person+place+relday+time all present' },

  // ── 4. FAMILY REASONING ─────────────────────────────────────────────────────
  { id: 'F1', cls: 'family', input: 'מי זה אופיר?', note: 'Ofir is FEMALE' },
  { id: 'F2', cls: 'family', input: 'מה הקשר בין לאו לאנבל?', note: 'both directions' },
  { id: 'F3', cls: 'family', input: 'מי הבת של מרטיטה?', note: '' },
  { id: 'F4', cls: 'family', input: '¿quién es Ofir?', note: 'Spanish, female' },
  { id: 'F5', cls: 'family', input: 'מי זה חורחה?', note: 'unknown? must not invent' },
  { id: 'F6', cls: 'family', input: 'כמה נכדים יש למרטיטה?', note: '' },

  // ── 6. CONVERSATION QUALITY (single-turn parts) ─────────────────────────────
  { id: 'Q1', cls: 'quality', input: 'ספרי לי על המהפכה הצרפתית', note: 'general knowledge → LLM' },
  { id: 'Q2', cls: 'quality', input: 'למה השמיים כחולים?', note: 'general knowledge' },
  { id: 'Q3', cls: 'quality', input: 'את זוכרת מה אמרתי לך אתמול?', note: 'honest: no cross-session memory' },
]

interface Row { id: string; cls: string; input: string; note: string; intent: string; source: string; display: string; onlineCalledWith: string | null }

async function runProbe(p: Probe, onlineLog: { q: string | null }): Promise<Row> {
  saveAppointments([])
  onlineLog.q = null
  const tools: FullTurnTools = {
    llm: async () => `[LLM_ECHO]`,
    online: async (q: string) => { onlineLog.q = q; return { ok: true, answer: `[ONLINE_RESULT for: ${q}]` } },
  }
  const ctx = { messages: [] as Array<{ role: string; content: string }>, now: NOW }
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, p.input, ctx, tools)
  return {
    id: p.id, cls: p.cls, input: p.input, note: p.note ?? '',
    intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim(),
    onlineCalledWith: onlineLog.q,
  }
}

describe('Intelligence Gap Probe (real runtime, text-only)', () => {
  it('drives the controller over the corpus and prints a report', async () => {
    const onlineLog = { q: null as string | null }
    const rows: Row[] = []
    for (const p of CORPUS) rows.push(await runProbe(p, onlineLog))

    // Multi-turn: calendar create → confirm → readback
    const tools: FullTurnTools = {
      llm: async () => '[LLM_ECHO]',
      online: async (q: string) => ({ ok: true, answer: `[ONLINE:${q}]` }),
    }
    saveAppointments([])
    const ctx = { messages: [] as Array<{ role: string; content: string }>, now: NOW }
    const t1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תקבעי פגישה עם דני מחר בשבע בערב', ctx, tools)
    const t2 = await ExecutiveCognitiveController.handleTurn(t1.state, 'כן', ctx, tools)
    const t3 = await ExecutiveCognitiveController.handleTurn(t2.state, 'מה יש לי מחר?', ctx, tools)

    // Multi-turn: correction ("no, make it 4pm") mid-create
    saveAppointments([])
    const c1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תקבעי פגישה עם דני מחר בשבע בערב', ctx, tools)
    const c2 = await ExecutiveCognitiveController.handleTurn(c1.state, 'לא, תעשי בארבע אחר הצהריים', ctx, tools)

    // Multi-turn: memory continuity ("and her?")
    saveAppointments([])
    const m1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מי זה אופיר?', ctx, tools)
    const m2 = await ExecutiveCognitiveController.handleTurn(m1.state, 'ומי אמא שלה?', ctx, tools)

    const fmt = (label: string, r: { intent: string; source: string; display: string; state?: RuntimeState }) =>
      `    ${label}: intent=${r.intent} source=${r.source}\n      → ${(r.display ?? '').replace(/\s+/g, ' ').trim()}`

    const lines: string[] = []
    lines.push('\n════════════ INTELLIGENCE GAP PROBE REPORT ════════════')
    lines.push(`NOW = ${NOW.toString()}  (getDay=${NOW.getDay()})`)
    let cur = ''
    for (const r of rows) {
      if (r.cls !== cur) { cur = r.cls; lines.push(`\n─── ${cur.toUpperCase()} ───`) }
      lines.push(`[${r.id}] "${r.input}"`)
      lines.push(`    note: ${r.note}`)
      lines.push(`    intent=${r.intent} source=${r.source} onlineQ=${r.onlineCalledWith ?? '—'}`)
      lines.push(`    → ${r.display}`)
    }
    lines.push('\n─── MULTI-TURN: calendar create→confirm→readback ───')
    lines.push(fmt('T1 create', t1)); lines.push(fmt('T2 "כן"', t2)); lines.push(fmt('T3 readback "מה יש לי מחר"', t3))
    lines.push('\n─── MULTI-TURN: correction mid-create ───')
    lines.push(fmt('C1 create 7pm', c1)); lines.push(fmt('C2 "לא בארבע"', c2))
    lines.push('\n─── MULTI-TURN: memory continuity ───')
    lines.push(fmt('M1 who is Ofir', m1)); lines.push(fmt('M2 "and her mother?"', m2))
    lines.push('\n═══════════════════════════════════════════════════════\n')
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))
    expect(rows.length).toBeGreaterThan(0)
  })
})
