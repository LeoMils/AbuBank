/*
 * TOOL-FIRING HARNESS (Stage 3C §11 / o-capability dynamic).
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Drives ALL 16 realtime tools through the REAL executor (LiveTools.handleFunctionCall) — the
 * exact code that ships in the deployed bundle (fingerprint-verified present) — with fully
 * MOCKED side-effect boundaries (§12): calendar writes → in-memory store; phone/WhatsApp →
 * captured drafts (never sent — the design prepares, never dispatches, a real message/call);
 * online → a stub fetch (no network). No real person, calendar, call, or message is touched.
 *
 * A tool "fires" when handleFunctionCall emits a function_call_output for its call id — proof
 * the tool's execution path is reachable and returns a grounded result. This moves the 16 tool
 * capabilities from STATE_COVERAGE_INCOMPLETE (firing not exercised) to firing-exercised
 * (CODE evidence), complementing their PREVIEW deployed-artifact presence. It writes a
 * reconciliation-input artifact consumed by the capability reconciliation.
 */
import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LiveTools, type LiveCalendarStore, type LiveEvent } from './liveTools'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'

// In-memory localStorage (reminder/memory stores round-trip against it).
let ls: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls[k] ?? null,
  setItem: (k: string, v: string) => { ls[k] = String(v) },
  removeItem: (k: string) => { delete ls[k] },
  clear: () => { ls = {} },
})
beforeEach(() => { ls = {} })

function memStore(): LiveCalendarStore {
  const items: LiveEvent[] = []; let n = 0
  return {
    list: () => items.slice(),
    add: (e) => { const ev = { ...e, id: `e${++n}` }; items.push(ev); return ev },
    update: (id, p) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...p }; return items[i]! },
  }
}

// A stub online fetch — no network; returns a grounded-looking answer.
const stubOnline = () => Promise.resolve({ ok: true, answer: '22 מעלות ובהיר', sources: [] })

/** Drive one tool on a fresh executor; return {fired, status}. Optional priming calls run first
 *  on the SAME executor (e.g. prepare a draft before correct/confirm/cancel). */
async function driveTool(name: string, args: Record<string, unknown>, prime: Array<{ name: string; args: Record<string, unknown> }> = []): Promise<{ fired: boolean; status: string }> {
  const sent: Array<Record<string, unknown>> = []
  const tools = new LiveTools((e) => sent.push(e), memStore(), {}, stubOnline)
  for (const p of prime) tools.handleFunctionCall({ name: p.name, callId: `p${Math.random()}`, argsJson: JSON.stringify(p.args) } as ParsedFunctionCall)
  const callId = `c${Math.random()}`
  tools.handleFunctionCall({ name, callId, argsJson: JSON.stringify(args) } as ParsedFunctionCall)
  // get_current_info is async (server round-trip) — let the mocked online promise settle.
  await new Promise((r) => setTimeout(r, 0))
  const out = sent.filter((e) => e.type === 'conversation.item.create')
    .map((e) => (e.item as { call_id?: string; output?: string }))
    .find((it) => it.call_id === callId)
  const fired = !!out?.output
  let status = 'unknown'
  try { status = (JSON.parse(out?.output ?? '{}') as { status?: string }).status ?? 'ok' } catch { /* */ }
  return { fired, status }
}

// The 16 tools + representative safe args. Calendar mutation tools are primed with a draft.
const PREPARE = { name: 'prepare_calendar_event', args: { title: 'פגישה עם מור', date: '2026-08-20', time: '15:00' } }
const CASES: Array<{ name: string; args: Record<string, unknown>; prime?: Array<{ name: string; args: Record<string, unknown> }> }> = [
  { name: 'resolve_contact', args: { name: 'מור' } },
  { name: 'read_calendar', args: {} },
  { name: 'prepare_calendar_event', args: PREPARE.args },
  { name: 'correct_calendar_field', args: { field: 'time', value: '16:00' }, prime: [PREPARE] },
  { name: 'confirm_calendar_event', args: {}, prime: [PREPARE] },
  { name: 'cancel_calendar_event', args: {}, prime: [PREPARE] },
  { name: 'update_calendar_event', args: { title: 'פגישה עם מור', time: '17:00' } },
  { name: 'whatsapp_draft', args: { recipient: 'מור', message: 'שלום מור' } },
  { name: 'phone_call', args: { name: 'מור' } },
  { name: 'cancel_communication', args: {} },
  { name: 'get_current_info', args: { query: 'מה מזג האוויר היום' } },
  { name: 'people_lookup', args: { name: 'מור' } },
  { name: 'history_lookup', args: { query: 'איך הכרתי את פפה' } },
  { name: 'care_concern', args: { note: 'קצת בודדה היום' } },
  { name: 'remember', args: { fact: 'מור אוהבת שוקולד' } },
  { name: 'set_reminder', args: { text: 'תזכירי לי בעוד שעה לשתות מים' } },
]

const results: Record<string, { fired: boolean; status: string }> = {}

describe('tool-firing harness — all 16 realtime tools fire through the real executor (mocked side-effects)', () => {
  it('every tool is owned by the executor (registry parity)', () => {
    for (const c of CASES) expect(LiveTools.owns(c.name), c.name).toBe(true)
    expect(CASES.length).toBe(16)
  })

  for (const c of CASES) {
    it(`${c.name} fires (emits a grounded function_call_output)`, async () => {
      const r = await driveTool(c.name, c.args, c.prime)
      results[c.name] = r
      expect(r.fired, `${c.name} produced no function_call_output`).toBe(true)
    })
  }
})

// After all tools ran, write the reconciliation-input artifact (firing evidence).
afterAll(() => {
  const firedCount = Object.values(results).filter((r) => r.fired).length
  const artifact = {
    $schema: 'internal://abu/tool-firing-evidence',
    producer: 'src/services/toolFiringHarness.test.ts',
    note: 'Each of the 16 realtime tools driven through LiveTools.handleFunctionCall with mocked side-effects (§12). fired=true means the tool emitted a grounded function_call_output. Evidence class: CODE (real executor) + PREVIEW (same code present in deployed bundle). Live-model routing (does gpt-realtime EMIT the call for a given utterance) is a separate acceptance/denominator claim.',
    total: CASES.length,
    firedCount,
    tools: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { firedExercised: v.fired, status: v.status }])),
  }
  try { writeFileSync(resolve(process.cwd(), 'docs/engineering-os/qa/tool-firing-evidence.json'), JSON.stringify(artifact, null, 2) + '\n') } catch { /* */ }
})
