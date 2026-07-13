/*
 * GOLD CONVERSATION REPLAY — fragmented ("drip") calendar create.
 * ═══════════════════════════════════════════════════════════════════════════
 * Source of truth: the MARTITA red-team's #1 (and only) failing class,
 * `fragmented-create-lost` (60/1560 conversations). Real behaviour: when Martita
 * builds an appointment across SEPARATE turns —
 *     "תקבעי" → "עם מור" → "מחר בשלוש" → "כן"
 * — AbuAI used to reply "מה לרשום?" WITHOUT opening a pending-create draft, so each
 * following fragment was orphaned to the LLM and nothing was ever saved. That is a
 * conversation-continuity failure (the thread is dropped), not a calendar-parse bug.
 *
 * First divergence: a bare create opener ("תקבעי") does not persist a `creating`
 * draft (startCreate → IDLE_STATE), so the pending-create path never runs.
 *
 * These replays drive the REAL runtime (ExecutiveCognitiveController.handleTurn →
 * runFullTurn → runCognitiveTurn), threading state exactly like index.tsx. Evidence
 * class: CODE (deterministic runtime, LLM/online stubbed). Not device-proven.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments, type Appointment } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { resolvePronouns } from '../screens/AbuAI/pronounResolver'
import { resolveFollowUp } from '../screens/AbuAI/contextResolver'
import type { ChatMessage } from '../screens/AbuAI/types'

class MemoryLocalStorage {
  private s = new Map<string, string>()
  getItem(k: string) { return this.s.has(k) ? this.s.get(k)! : null }
  setItem(k: string, v: string) { this.s.set(k, String(v)) }
  removeItem(k: string) { this.s.delete(k) }
  clear() { this.s.clear() }
  key(i: number) { return [...this.s.keys()][i] ?? null }
  get length() { return this.s.size }
}

// LLM/online are stubs so the test isolates ROUTING + CONTINUITY, not model text.
// The [LLM] tag makes an orphaned-to-the-model turn visible.
const tools: FullTurnTools = {
  llm: async (input: string) => `[LLM] ${input.slice(0, 40)}`,
  online: async (q: string) => ({ ok: true, answer: `online: ${q}` }),
}

interface TurnResult { say: string; intent: string; source: string; phase: string; sideEffect: unknown; display: string }

async function replay(turns: string[]): Promise<TurnResult[]> {
  ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  saveAppointments([])
  let state: RuntimeState = IDLE_RUNTIME
  const messages: Array<{ role: string; content: string }> = []
  const now = new Date('2026-06-24T20:00:00') // Wed, pinned
  const out: TurnResult[] = []
  for (const say of turns) {
    const prior: ChatMessage[] = messages.map((m, i) => ({ id: String(i), role: m.role as 'user' | 'assistant', content: m.content, timestamp: 0 }))
    const { resolved: pr } = resolvePronouns(say, prior)
    let eff = pr !== say ? pr : say
    const fu = resolveFollowUp(eff, prior, { pendingCreate: state.createState.phase !== 'idle' })
    if (fu.wasFollowUp) eff = fu.resolved
    messages.push({ role: 'user', content: eff })
    const r = await ExecutiveCognitiveController.handleTurn({ ...state, conv: state.conv }, eff, { messages: [...messages], now }, tools)
    state = r.state
    messages.push({ role: 'assistant', content: r.display })
    out.push({ say, intent: r.intent, source: r.source, phase: r.state.createState.phase, sideEffect: r.sideEffect, display: r.display })
  }
  return out
}

describe('GOLD REPLAY — fragmented create is never lost to the LLM', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
  afterEach(() => { vi.useRealTimers(); delete (globalThis as { localStorage?: unknown }).localStorage })

  it('drip create with an UNAMBIGUOUS time saves the appointment', async () => {
    const log = await replay(['תקבעי', 'עם מור', 'מחר בשלוש', 'כן'])
    // The create must be RETAINED across every fragment — never orphaned to the LLM.
    for (const t of log.slice(1)) expect(t.source).not.toBe('llm')
    // Final "כן" saves.
    expect(log[log.length - 1]!.sideEffect).toBe('saved_appointment')
    const appts: Appointment[] = loadAppointments()
    expect(appts).toHaveLength(1)
    expect(appts[0]!.time).toBe('15:00')
    expect(appts[0]!.title).toContain('מור')
  })

  it('bare "תקבעי" opens a pending draft (does not stay idle)', async () => {
    const log = await replay(['תקבעי'])
    expect(log[0]!.intent).toBe('calendar_create')
    expect(log[0]!.phase).not.toBe('idle') // draft opened, ready to absorb fragments
  })

  it('drip create with an AMBIGUOUS hour stays a live create (retained, asks AM/PM), never lost', async () => {
    const log = await replay(['תקבעי', 'עם מור', 'מחר בשמונה', 'כן'])
    // Every fragment turn is handled by the runtime, never punted to the LLM.
    for (const t of log.slice(1)) expect(t.source).not.toBe('llm')
    // The person was absorbed into a retained draft (not orphaned).
    const finalPhase = log[log.length - 1]!.phase
    expect(finalPhase).not.toBe('idle')
  })

  it('after the person fragment, AbuAI asks a NATURAL next question (not a "say it again" loop-break, not "באיזה יום?")', async () => {
    const log = await replay(['תקבעי', 'עם מור'])
    const t2 = log[1]!.display
    // The generic dialogue loop-breaker ("say it again in your words") is a
    // dead-end mid-create — the natural progression (title -> day/time) must not
    // be mistaken for a repeated-clarification loop.
    expect(t2).not.toContain('תגידי לי שוב במילים שלך')
    // The bald phone-tree phrase is banned product-wide.
    expect(t2).not.toMatch(/באיזה יום\?/)
    // It should feel like a companion continuing the thread — reference the
    // person she just named.
    expect(t2).toContain('מור')
  })
})
