/*
 * Domain Plugin interface
 * ═══════════════════════
 * Every AbuAI domain (calendar, family, online, knowledge, reminders, recurring,
 * delete, modify, search, update, …) is a plugin implementing THIS interface. A
 * plugin NEVER emits user-visible text and never touches the UI — it only reasons
 * and returns a structured `PluginResult`. The Executive Cognitive Controller (via
 * the Domain Planner) decides which plugins participate in a turn, runs them, and
 * is the ONLY component that turns a result into a final, finalized answer.
 *
 * Adding a future domain = register a new plugin. The controller/planner never
 * changes.
 */
import type { RuntimeState } from './cognitiveRuntime'

export interface PluginContext {
  /** normalized user input for this turn. */
  input: string
  now: Date
  messages: Array<{ role: string; content: string }>
  /** the current runtime state (read-only to the plugin). */
  state: RuntimeState
}

export type PluginSideEffect =
  | 'saved_appointment' | 'saved_reminder' | 'saved_recurring'
  | 'deleted' | 'updated' | 'save_failed' | null

export interface PluginResult {
  /** did this plugin produce a terminal answer candidate for the turn? */
  handled: boolean
  /** the candidate answer TEXT — structured data, NOT emitted. The controller
   *  finalizes it (naturalize → supervise → deliver). Absent when not handled. */
  answer?: string
  /** a real side-effect the plugin performed via its tools (save/delete/update). */
  sideEffect?: PluginSideEffect
  /** partial state the controller should merge (e.g. a pending reminder draft). */
  statePatch?: Partial<RuntimeState>
  /** 0..1 — the planner uses this to pick the primary among participants. */
  confidence: number
}

export interface DomainPlugin {
  /** unique plugin name (also its trace label). */
  readonly name: string
  /** domain labels this plugin serves (for diagnostics). */
  readonly domains: readonly string[]
  /**
   * 0 = does not participate this turn; >0 = participates, value is priority.
   * Must be cheap and side-effect-free.
   */
  match(ctx: PluginContext): number
  /** produce the structured reasoning result. MUST NOT emit or touch the UI. */
  reason(ctx: PluginContext): PluginResult
}
