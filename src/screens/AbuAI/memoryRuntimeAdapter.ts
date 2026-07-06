/*
 * Memory Runtime Adapter
 * ══════════════════════
 * The SINGLE canonical accessor for live conversation memory. The pure runtime keeps its
 * immutable `RuntimeState` carrier (deterministic backbone); this adapter projects the
 * Memory Engine v2 view from it, so every consumer (Conversation v2, Speech, Online,
 * Calendar, Family, Diagnostics) reads memory THROUGH here and never touches raw
 * RuntimeState fields — one source, nothing can drift.
 *
 * `SessionMemory` is the write-once-per-turn owner (wraps Memory Engine v2). The
 * stateful boundary (controller / UI) holds ONE per session and records each turn
 * exactly once — the durable session memory + Copy-Last-20 read from it (replacing the
 * module-global diagnostics buffer as the canonical turn store). Instance-based → no
 * module-global mutable live memory.
 */
import type { RuntimeState } from './cognitiveRuntime'
import { MemoryEngineV2, createMemoryEngine, type TurnDecision, type PendingAction, type Goal, type TurnRecord } from './memoryEngineV2'

export interface MemoryView {
  getPendingAction(): PendingAction | null
  getActiveGoal(): Goal | null
  getLastFamilyPair(): { a: string; b: string } | null
  hasPending(): boolean
  getPendingLabel(): string | null
}

/** Project the canonical Memory Engine v2 view from the runtime carrier. */
export function memoryFromState(state: RuntimeState): MemoryView {
  const phase = state.createState.phase
  const label = phase !== 'idle' ? (state.createState.draft?.title ?? null) : null
  const pending: PendingAction | null = phase !== 'idle' ? { kind: 'calendar_create', phase, label } : null
  return {
    getPendingAction: () => pending,
    getActiveGoal: () => (pending ? { kind: 'calendar_create', label } : null),
    getLastFamilyPair: () => state.lastFamilyPair ?? null,
    hasPending: () => phase !== 'idle',
    getPendingLabel: () => label,
  }
}

/** Write-once-per-turn session-memory owner (canonical durable memory + Copy-Last-20). */
export class SessionMemory {
  readonly engine: MemoryEngineV2
  private recorded = 0
  constructor(sessionId = 'session') { this.engine = createMemoryEngine(sessionId) }
  /** Record exactly ONE turn (hard rule 6). Returns the running write count. */
  record(userInput: string, decision: TurnDecision): number {
    this.engine.rememberTurn(userInput, decision.display, decision)
    return ++this.recorded
  }
  lastTurns(n = 20): TurnRecord[] { return this.engine.exportLastTurns(n) }
  writes(): number { return this.recorded }
  getPendingAction(): PendingAction | null { return this.engine.getPendingAction() }
  getActiveGoal(): Goal | null { return this.engine.getActiveGoal() }
  getLastFamilyPair(): { a: string; b: string } | null { return this.engine.getLastFamilyPair() }
  shouldGreet(): boolean { return this.engine.shouldGreet() }
  markGreeted(): void { this.engine.markGreeted() }
}
