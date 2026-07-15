/*
 * Regression: correcting the PERSON mid-create (Cycle 11, RED-first)
 * ═════════════════════════════════════════════════════════════════
 * Probe-2 evidence: after "תקבעי פגישה עם דני מחר בשבע בערב", the correction
 * "לא, לא עם דני, עם מור" fell to the LLM — resolvePendingMessage had no person-correction
 * branch, so a companion swap with no date/time hit the off-topic guard and was parked as
 * a side question. (A DAY correction already worked via the new-create path.)
 *
 * Drives the REAL controller across the two turns (shared state). Evidence class: CODE.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

// The save round-trip goes through localStorage; the node test env lacks it, so polyfill a
// synchronous mirror (otherwise a real save reads back empty — a node artifact, not a bug).
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

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_HANDLE_A_DRAFT_CORRECTION]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })

describe('mid-create person correction updates the draft, not the LLM', () => {
  it('"…עם דני…" then "לא, לא עם דני, עם מור" → draft now with מור', async () => {
    const t1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תקבעי פגישה עם דני מחר בשבע בערב', ctx(), TOOLS)
    expect(t1.display).toContain('דני')
    const t2 = await ExecutiveCognitiveController.handleTurn(t1.state, 'לא, לא עם דני, עם מור', ctx(), TOOLS)
    expect(t2.source).not.toBe('llm')
    expect(t2.display).toContain('מור')
    expect(t2.display).not.toContain('דני')
    // still a create confirmation, not a cancel
    expect(t2.intent).toMatch(/calendar_create|confirmation/u)
  })

  it('the corrected draft saves with מור on "כן"', async () => {
    const t1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תקבעי פגישה עם דני מחר בשבע בערב', ctx(), TOOLS)
    const t2 = await ExecutiveCognitiveController.handleTurn(t1.state, 'לא, לא עם דני, עם מור', ctx(), TOOLS)
    const t3 = await ExecutiveCognitiveController.handleTurn(t2.state, 'כן', ctx(), TOOLS)
    expect(t3.display).toContain('מור')
    expect(t3.display).not.toContain('דני')
  })
})
