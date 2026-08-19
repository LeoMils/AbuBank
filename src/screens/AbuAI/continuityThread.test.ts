/*
 * CONTINUITY REGRESSION — one evolving 20-turn Hebrew thread
 * ═════════════════════════════════════════════════════════════
 * Drives ONE conversation through the REAL production path the way index.tsx does
 * (ExecutiveCognitiveController.handleTurn → runFullTurn → runCognitiveTurn),
 * threading RuntimeState/conv/messages across turns. Born as the QA red-team's
 * "forgetting" repro; kept as a permanent regression so the continuity fixes can
 * never silently regress.
 *
 * Tools are deterministic stubs (llm tags [LLM#n]; online returns weather) so the
 * routing/deterministic-text decisions are reproducible. `source === 'llm'` means
 * the runtime PUNTED to the general model (did not handle the turn deterministically).
 *
 * PASSING today = the Tier-1 continuity fixes:
 *   • T16 — "מה דיברנו קודם?" never echoes a trivial closer ("דיברנו על עזוב").
 *   • T8  — past-tense read-back "מה קבעתי מחר?" routes to calendar_read.
 *   • T2/T5/T9 — draft opens, interrupted draft still saves, weather goes online.
 * TODO (the "Conversation Object" focus layer — the documented NEXT slice):
 *   • T6/T7 — edits AFTER save bind to the just-saved event.
 *   • T10   — weather follow-up "ומחר?" stays weather, not calendar.
 *   • T18   — an exit ("לא משנה") closes an open draft (no pending pollution).
 *   • T13   — spelling variant "אנבל" resolves like canonical "אנאבל".
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { saveAppointments } from '../AbuCalendar/service'
import type { FullTurnTools } from './runtimeFullTurn'
import type { ChatMessage } from './types'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

const makeTools = (): FullTurnTools => {
  const llmCalls: string[] = []
  return {
    llm: async (input: string) => {
      llmCalls.push(input)
      const n = llmCalls.length
      if (/מור/.test(input)) return `[LLM#${n}] מור היא הבת. גרה קרוב, אוהבת אותך מאוד.`
      if (/אנבל|אנאבל|Anabel/i.test(input)) return `[LLM#${n}] אנאבל היא הנינה מארגנטינה.`
      return `[LLM#${n}] תשובת-מודל-כללית לגבי: ${input}`
    },
    online: async (q: string) => ({ ok: true, answer: `בכפר סבא היום 29 מעלות, שמש. (${q})` }),
  }
}

interface TurnLog {
  n: number; input: string; intent: string; source: string
  sideEffect: unknown; createPhase: string; display: string
}

describe('CONTINUITY — evolving 20-turn thread (real runtime)', () => {
  const log: TurnLog[] = []
  const T = (n: number): TurnLog => log[n - 1]!

  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
    saveAppointments([])
  })

  beforeAll(async () => {
    ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
    saveAppointments([])
    const tools = makeTools()
    let state: RuntimeState = IDLE_RUNTIME
    const messages: ChatMessage[] = []
    let id = 0
    const say = async (input: string): Promise<void> => {
      messages.push({ id: `${++id}`, role: 'user', content: input, timestamp: Date.now() })
      const seed: RuntimeState = { ...state, conv: state.conv }
      const r = await ExecutiveCognitiveController.handleTurn(
        seed, input,
        { messages: messages.map(m => ({ role: m.role, content: m.content })), now: new Date() },
        tools,
      )
      state = r.state
      messages.push({ id: `${++id}`, role: 'assistant', content: r.display, timestamp: Date.now() })
      log.push({
        n: log.length + 1, input, intent: r.intent, source: r.source,
        sideEffect: r.sideEffect, createPhase: r.state.createState.phase, display: r.display,
      })
    }

    await say('שלום')                                    // 1  greeting
    await say('תקבעי לי פגישה מחר בשלוש עם מוטי')          // 2  create draft
    await say('מי זאת מור?')                              // 3  family interruption
    await say('ספרי לי עליה')                             // 4  pronoun follow-up → מור
    await say('כן תקבעי')                                 // 5  RESUME the draft (must NOT re-ask)
    await say('תשנה לארבע')                               // 6  edit time (post-save → focus layer)
    await say('בקפה אסתר')                                // 7  edit location (post-save → focus layer)
    await say('מה קבעתי מחר?')                            // 8  read back
    await say('מה מזג האוויר בכפר סבא?')                  // 9  online weather
    await say('ומחר?')                                    // 10 weather follow-up (focus layer)
    await say('לא, בשבוע הבא')                            // 11 correction
    await say('תודה')                                     // 12 ack
    await say('מי זאת אנבל?')                             // 13 family (variant spelling)
    await say('וכמה ילדים יש לה?')                        // 14 pronoun follow-up → אנבל
    await say('עזוב')                                     // 15 exit
    await say('מה דיברנו קודם?')                          // 16 recall
    await say('תקבעי תור לרופא ביום ראשון בעשר')          // 17 new create
    await say('לא משנה')                                  // 18 abandon mid-create (focus layer)
    await say('מה השעה עכשיו?')                           // 19 time
    await say('תודה רבה, ביי')                            // 20 closing
  })

  // ── Anchors (were already correct) ──
  it('T2: create opens a confirming draft', () => {
    expect(T(2).createPhase).toBe('confirming')
  })
  it('T5: "כן תקבעי" after a 2-turn interruption saves the SAME draft', () => {
    expect(T(5).sideEffect).toBe('saved_appointment')
  })
  it('T9: weather goes online, not local', () => {
    expect(T(9).source).toBe('online')
  })

  // ── Tier-1 fixes (this change) ──
  it('T8 [FIX]: past-tense read-back "מה קבעתי מחר?" routes to calendar_read, not the LLM', () => {
    expect(T(8).intent).toBe('calendar_read')
    expect(T(8).source).not.toBe('llm')
  })
  it('T16 [FIX]: "מה דיברנו קודם?" never recalls a trivial closer as the topic', () => {
    expect(T(16).display).not.toMatch(/דיברנו על (?:עזוב|תודה|ביי|שלום|לא משנה)/)
  })

  // ── Conversation-Object focus layer (this change) ──
  it('T10 [FIX]: weather follow-up "ומחר?" stays online, never flips to the calendar on the מחר token', () => {
    expect(T(10).intent).not.toBe('calendar_read')
    expect(T(10).display).not.toMatch(/פגיש|יומן|קבע/)
    expect(T(10).source).toBe('online')
  })
  it('T18 [FIX]: an exit ("לא משנה") closes the open draft — no pending-draft pollution', () => {
    expect(T(18).createPhase).toBe('idle')
    expect(T(19).createPhase).toBe('idle')
    expect(T(20).createPhase).toBe('idle')
  })

  // ── Documented NEXT slice (deliberately NOT shipped: stored-event mutation is a
  //    data-loss risk that cannot be verified without a device) ──
  it.todo('T6/T7: edits AFTER save ("תשנה לארבע"/"בקפה אסתר") mutate the stored event (needs safe stored-event update flow)')
  it.todo('T13: spelling variant "אנבל" resolves deterministically like canonical "אנאבל"')
})
