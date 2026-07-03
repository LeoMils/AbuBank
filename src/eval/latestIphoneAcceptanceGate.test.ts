/*
 * Latest iPhone Acceptance Gate — fails if any of Leo's latest live failures
 * reappear. Behavior through the ExecutiveCognitiveController + the diagnostics.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME } from '../screens/AbuAI/cognitiveRuntime'
import { checkExtraction, extractionScore, EX1, EX2 } from './latestIphoneLiveFailureRepro'
import { lastTurns, clearTurns } from '../screens/AbuAI/liveTurnDiagnostics'
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

const NOW = new Date(2026, 6, 3, 9, 0, 0)
const T: FullTurnTools = { llm: async () => 'תשובה קצרה.', online: async () => ({ ok: true, answer: 'יש הקרנה בשבע וחצי.' }) }
const turn = (input: string) => ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, { messages: [], now: NOW }, T)

describe('Latest iPhone Acceptance Gate', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); clearTurns() })

  it('calendar extraction from natural speech is correct (repro fixed)', () => {
    expect(extractionScore(checkExtraction(NOW)).failures.map(f => f.id)).toEqual([])
  })

  it('EX1 confirm is clean: person title, location present, summarized details, no raw dump / double period', async () => {
    const r = await turn(EX1)
    expect(r.intent).toBe('calendar_create')
    expect(r.display).toContain('פגישה עם מוטי')       // person title, not raw transcript
    expect(r.display).toContain('קפה מורנו')            // location present (never "חסר מקום")
    expect(r.display).toContain('פרטים חשובים')          // summarized details
    expect(r.display).not.toMatch(/\.\s*\./)             // no double period
    expect(r.display).not.toMatch(/להגיע ב.*במקום נעים/) // no garbled detail
    expect(r.display.length).toBeLessThan(200)           // not a raw-sentence dump
  })

  it('EX2 resolves the pronoun venue and captures the גלעד detail', async () => {
    const r = await turn(EX2)
    expect(r.display).toContain('פגישה עם אופיר')
    expect(r.display).toMatch(/אצל אופיר/)               // "אצלה בבית" → "אצל אופיר בבית"
    expect(r.display).toMatch(/גלעד/)
  })

  it('no generic loops / wrong missing field: search-all never asks "באיזה יום"', async () => {
    const r = await turn('מתי יש לי פגישה עם מורנו')
    expect(r.display).not.toMatch(/באיזה יום/)
  })

  it('every turn is recorded in diagnostics (Copy Last 20)', async () => {
    await turn(EX1)
    const turns = lastTurns()
    expect(turns.length).toBeGreaterThanOrEqual(1)
    expect(turns[turns.length - 1]!.input).toBe(EX1)
    expect(turns[turns.length - 1]!.finalAnswer.length).toBeGreaterThan(0)
    expect(typeof turns[turns.length - 1]!.version).toBe('string')
  })
})
