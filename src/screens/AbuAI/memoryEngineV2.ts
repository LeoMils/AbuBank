/*
 * Memory Engine v2
 * ════════════════
 * ONE deterministic owner of live conversation memory, replacing the scattered fields
 * (runtime state / conversationOS / delivery engine / pending draft / diagnostics).
 * INSTANCE-BASED: `createMemoryEngine()` returns a fresh engine per session — there is
 * NO module-global mutable state, so nothing leaks across tests (hard rule 10).
 *
 * It is fed each turn's decision (`rememberTurn`) and exposes a clean API to
 * Conversation Engine v2, Calendar v2, Semantic v2, Online v2, and Speech Delivery.
 * Deterministic: timestamps come from an injectable monotonic counter, never Date.now.
 */
import { planDelivery } from './conversationDeliveryEngine'

export interface TurnRecord { seq: number; user: string; assistant: string; intent: string }
export interface PendingAction { kind: string; phase: string; label: string | null }
export interface Goal { kind: string; label: string | null }
export interface ToolResult { tool: string; result: string }

/** The minimal decision shape the engine reads (a subset of the runtime result). */
export interface TurnDecision {
  intent: string
  display: string
  chunks?: string[]
  source?: string
  state: { createState: { phase: string; draft?: { title?: string | null } }; lastFamilyPair?: { a: string; b: string } | null }
}

const NON_CANCEL_REASONS = new Set(['frustration', 'audio_complaint', 'side_question'])
const SIDE_INTENTS = new Set(['family', 'online', 'general', 'date', 'calendar_search', 'calendar_read'])

export class MemoryEngineV2 {
  readonly sessionId: string
  private seq = 0
  private turns: TurnRecord[] = []
  private greeted = false
  private goal: Goal | null = null
  private pending: PendingAction | null = null
  private lastAnswer: string | null = null
  private chunks: string[] = []
  private cursor = -1
  private toolResult: ToolResult | null = null
  private familyPair: { a: string; b: string } | null = null
  private correction: string | null = null
  private frustration = 0
  private sideStack: string[] = []
  private topicStack: string[] = []
  private topic: string | null = null

  constructor(sessionId = 'session') { this.sessionId = sessionId }

  // ── ingest ──
  rememberTurn(userInput: string, assistantOutput: string, decision: TurnDecision): void {
    this.turns.push({ seq: this.seq++, user: userInput, assistant: assistantOutput, intent: decision.intent })
    while (this.turns.length > 20) this.turns.shift()

    // pending action / active goal — a pending calendar draft is the active goal.
    const phase = decision.state.createState.phase
    if (phase !== 'idle') {
      this.pending = { kind: 'calendar_create', phase, label: decision.state.createState.draft?.title ?? null }
      this.goal = { kind: 'calendar_create', label: this.pending.label }
    } else if (decision.intent === 'confirmation' || decision.intent === 'calendar_delete') {
      this.pending = null; this.goal = null                     // executed / cancelled
    }

    // side questions never erase the active goal (hard rule 5); they stack.
    if (this.pending && SIDE_INTENTS.has(decision.intent)) this.sideStack.push(userInput)
    // frustration / audio never clear the pending action (hard rules 6, 7).
    if (decision.intent === 'frustration') this.frustration++

    // last answer + spoken chunks (for "תמשיכי" / "לא שמעתי").
    if (assistantOutput && decision.intent !== 'continuation') {
      this.lastAnswer = assistantOutput
      this.chunks = decision.chunks?.length ? decision.chunks : planDelivery(assistantOutput).chunks
      this.cursor = -1
    }
    if (decision.source === 'online') this.toolResult = { tool: 'online', result: assistantOutput }
    if (decision.state.lastFamilyPair) this.familyPair = decision.state.lastFamilyPair

    // topic memory (recall): "ספרי לי על X" → topic X.
    const topicM = userInput.match(/(?:ספרי\s+לי\s+על|על\s+מה|מה\s+זה)\s+(.+)/u)
    if (topicM?.[1]) { if (this.topic) this.topicStack.push(this.topic); this.topic = topicM[1].trim() }
  }

  // ── goal / pending ──
  getActiveGoal(): Goal | null { return this.goal }
  setActiveGoal(goal: Goal | null): void { this.goal = goal }
  getPendingAction(): PendingAction | null { return this.pending }
  setPendingAction(action: PendingAction | null): void { this.pending = action; if (action) this.goal = { kind: action.kind, label: action.label } }
  /** Clears ONLY on an explicit reason — never on frustration / audio / side question. */
  clearPendingAction(reason: string): boolean {
    if (NON_CANCEL_REASONS.has(reason)) return false
    this.pending = null; this.goal = null; return true
  }

  // ── answer / continuation ──
  rememberAssistantAnswer(answer: string, speechChunks?: string[]): void {
    this.lastAnswer = answer
    this.chunks = speechChunks?.length ? speechChunks : planDelivery(answer).chunks
    this.cursor = -1
  }
  /** "תמשיכי" → next chunk; "לא שמעתי" → repeat the last delivered chunk. */
  resumeLastAnswer(mode: 'continue' | 'repeat'): { chunk: string | null; done: boolean } {
    if (!this.chunks.length) return { chunk: null, done: true }
    if (mode === 'repeat') { const i = this.cursor < 0 ? 0 : this.cursor; this.cursor = i; return { chunk: this.chunks[i] ?? null, done: i >= this.chunks.length - 1 } }
    const next = this.cursor + 1
    if (next >= this.chunks.length) return { chunk: null, done: true }
    this.cursor = next
    return { chunk: this.chunks[next]!, done: next >= this.chunks.length - 1 }
  }

  // ── tools / topic / family ──
  rememberToolResult(tool: string, result: string): void { this.toolResult = { tool, result } }
  getLastToolResult(): ToolResult | null { return this.toolResult }
  recallTopic(): string | null { return this.topic }
  getLastFamilyPair(): { a: string; b: string } | null { return this.familyPair }

  // ── correction / side questions ──
  handleCorrection(input: string): string { this.correction = input; return input }
  getLastCorrection(): string | null { return this.correction }
  handleSideQuestion(input: string): void { this.sideStack.push(input) } // goal preserved
  getSideStack(): string[] { return [...this.sideStack] }

  // ── greeting (once per real session) ──
  shouldGreet(): boolean { return !this.greeted }
  markGreeted(): void { this.greeted = true }

  // ── diagnostics ──
  exportLastTurns(count = 20): TurnRecord[] { return this.turns.slice(-count) }
}

/** Fresh, isolated engine per session (no module-global state → no cross-test leak). */
export function createMemoryEngine(sessionId = 'session'): MemoryEngineV2 { return new MemoryEngineV2(sessionId) }
