/*
 * Single Turn Store — proves there is ONE canonical turn store (Memory Engine v2) behind
 * Copy Last 20 / diagnostics, with provider + speech + finalizer + error traces, and no
 * separate LiveTurnRecord ring buffer.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { lastTurns, dumpTurns, clearTurns, copyLastTurns, type LiveTurnRecord } from '../screens/AbuAI/liveTurnDiagnostics'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}
const NOW = new Date(2026, 6, 6, 9, 0, 0)
const T: FullTurnTools = { llm: async () => 'משפט ראשון. משפט שני.', online: async () => ({ ok: true, answer: 'תוצאה 2-1.' }) }
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]); clearTurns() })
const run = (st: RuntimeState, q: string) => ExecutiveCognitiveController.handleTurn(st, q, { messages: [], now: NOW }, T)

// ── structural: no independent ring buffer remains ──
describe('single store: no LiveTurnRecord BUFFER in liveTurnDiagnostics', () => {
  it('the source has no parallel ring buffer', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/screens/AbuAI/liveTurnDiagnostics.ts'), 'utf8')
    expect(src).not.toMatch(/const BUFFER/)
    expect(src).not.toMatch(/BUFFER\.(push|shift|slice|length)/)
    expect(src).toContain('exportDiagnostics')            // reads from Memory Engine v2
  })
})

// ── Copy Last 20 sourced only from Memory Engine v2, with traces ──
describe('single store: Copy Last 20 = Memory Engine v2, with traces', () => {
  it('online turn: dump carries provider trace + speech chunks + finalizer stamp', async () => {
    clearTurns()
    await run(IDLE_RUNTIME, 'איזה משחקים יש היום?')
    const dump = JSON.parse(dumpTurns())
    expect(dump.turns.length).toBe(1)
    const t = dump.turns[0] as LiveTurnRecord
    expect(t.onlineTrace).toBeTruthy()                    // provider trace stored
    expect(Array.isArray(t.speechChunks)).toBe(true)      // speech trace stored
    expect(t.finalizerStamp).toBe('RUNTIME_FINALIZED')    // finalizer trace stored
    expect(Array.isArray(t.finalizerStages)).toBe(true)
    expect('error' in t).toBe(true)                       // error slot present
    expect(dump.lastTool?.tool).toBe('online')            // tool result in the single store
  })
  it('lastTurns() returns Memory Engine v2 records (rich fields intact)', async () => {
    clearTurns()
    await run(IDLE_RUNTIME, 'מה יש לי היום')
    const [t] = lastTurns()
    expect(t!.input).toBe('מה יש לי היום')
    expect(t!.intent).toBeTruthy(); expect(t!.finalAnswer.length).toBeGreaterThan(0)
  })
})

// ── cap + isolation ──
describe('single store: cap 20 + no cross-session leak', () => {
  it('caps at 20 across a long session', async () => {
    clearTurns(); let st = IDLE_RUNTIME
    for (let i = 0; i < 26; i++) { const r = await run(st, 'מה יש לי היום'); st = r.state }
    expect(lastTurns().length).toBe(20)
    expect(JSON.parse(dumpTurns()).count).toBe(20)
  })
  it('clearTurns starts a fresh store — earlier turns cannot leak', async () => {
    await run(IDLE_RUNTIME, 'בוקר טוב')
    expect(lastTurns().length).toBeGreaterThan(0)
    clearTurns()
    expect(lastTurns().length).toBe(0)                    // no leak from the prior session
    await run(IDLE_RUNTIME, 'מה השעה')
    expect(lastTurns().length).toBe(1)
  })
})

// ── ErrorBoundary support export still works ──
describe('single store: ErrorBoundary/Settings export still works', () => {
  it('copyLastTurns returns valid JSON sourced from the single store', async () => {
    clearTurns(); await run(IDLE_RUNTIME, 'מה יש לי היום')
    const dump = await copyLastTurns()
    const parsed = JSON.parse(dump)
    expect(parsed.count).toBe(1)
    expect(parsed.turns).toHaveLength(1)
    expect(parsed).not.toHaveProperty('memoryTurns')      // no duplicate list anymore
  })
})
