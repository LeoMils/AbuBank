/*
 * textHarness/types.ts — Abu AI TEXT-MODE conversation harness: shared vocabulary.
 * ════════════════════════════════════════════════════════════════════════════
 * Goal: exercise the FULL reasoning / tool / turn layer of the live path with
 * typed Hebrew input and NO audio, so Abu's behaviour can be tested at scale in CI
 * instead of on the phone.
 *
 * The harness reuses, verbatim, the live voice path's construction:
 *   • the SAME session instructions   (buildLiveInstructions via buildSessionUpdate)
 *   • the SAME tool registry           (liveTools.ts — LIVE_TOOL_SCHEMAS + LiveTools)
 *   • the SAME turn/response lifecycle  (parseResponsePhase / isEndOfTurn)
 * A model DRIVER (the only seam) supplies Abu's turns: the real driver calls the
 * same model over text; without a key the run is BLOCKED (never faked).
 */
import type { CalendarDraft } from '../../screens/AbuAI/realtime/calendarDraft'
import type { LiveEvent } from '../liveTools'

// ─── Scenario input ──────────────────────────────────────────────────────────

/** One typed Hebrew user turn, plus optional per-turn expectations. */
export interface ScenarioTurn {
  /** What Martita types/says, in Hebrew (or Spanish for the locale scenarios). */
  user: string
  /** This turn expresses an intent that REQUIRES a tool before any speech
   *  (calendar read/write, contact resolution, current-info). The harness asserts
   *  a tool call precedes Abu's first spoken words on this turn. */
  requiresTool?: boolean
}

/** Optional fakes a scenario may inject (all deterministic). */
export interface ScenarioFakes {
  /** Fixed "now" (epoch ms) so relative-date resolution ("מחר") is deterministic. */
  nowMs?: number
  /** Seed calendar events the fake store starts with. */
  calendar?: Array<Omit<LiveEvent, 'id'> & { id?: string }>
  /** A fake family_data.json ({ family: {...} }) swapped into contact resolution. */
  familyData?: { family: Record<string, unknown> }
}

export interface Scenario {
  id: string
  /** One-line human description of what this scenario probes. */
  title: string
  turns: ScenarioTurn[]
  fakes?: ScenarioFakes
  /** The name Martita is addressed by; the harness checks it appears naturally in
   *  long conversations. Defaults to 'מרטיטה'. */
  userName?: string
  /** ≥ this many user turns → treated as a "long conversation" for the name check. */
  longConversationTurns?: number
  /** Capabilities the scenario deliberately baits Abu to over-offer (e.g. email);
   *  the harness flags any offered capability that has no registered tool. */
  bait?: string[]
  /** If set, the harness asserts this location string survives to the persisted
   *  event (the exact device bug where a location is dropped on commit/update). */
  expectLocation?: string
}

// ─── Model driver (the ONE seam) ─────────────────────────────────────────────

/** The session the driver runs against — instructions + tools, taken verbatim from
 *  the live path's buildSessionUpdate (never re-authored here). */
export interface HarnessSession {
  instructions: string
  tools: unknown[]
  toolChoice: unknown
}

/** One completed function call the model requested (same shape as the live bridge). */
export interface DriverToolCall {
  name: string
  callId: string
  argsJson: string
}

/** One step of the model's turn: either spoken text (with the lifecycle phase) or a
 *  batch of tool calls. Mirrors the Realtime completion shapes the live path handles. */
export type ModelStep =
  | { kind: 'speech'; text: string; phase?: 'commentary' | 'final_answer' | null }
  | { kind: 'tool_calls'; calls: DriverToolCall[] }

/** The reasoning seam. The real implementation calls the same model over text; a
 *  scripted implementation drives the harness plumbing deterministically in tests. */
export interface ModelDriver {
  /** Whether this driver can actually run (e.g. an API key is present). When false
   *  the runner records every scenario as BLOCKED rather than faking a pass. */
  readonly available: boolean
  /** Human label + why (for the report / blocked reason). */
  readonly label: string
  /** Configure the driver with the shared session (instructions + tools). */
  begin(session: HarnessSession): void | Promise<void>
  /** Register a user turn. */
  userSays(textHe: string): void
  /** Produce the next model step given everything so far (incl. tool outputs). */
  next(): Promise<ModelStep>
  /** Feed a tool result back so the model can speak the grounded answer. */
  toolResult(callId: string, outputJson: string): void
}

// ─── Run output ──────────────────────────────────────────────────────────────

export type TranscriptRole = 'user' | 'abu'

export interface TranscriptEntry {
  role: TranscriptRole
  text: string
  /** For an abu entry: the lifecycle phase reported on this step. */
  phase?: 'commentary' | 'final_answer' | null
  /** Index of the user turn this entry belongs to. */
  turn: number
  /** Global monotonic ordinal (shared with ToolCallRecord.seq) so speech-vs-tool
   *  ordering can be compared for the tool-before-speech assertion. */
  seq: number
}

export interface ToolCallRecord {
  turn: number
  name: string
  callId: string
  args: Record<string, unknown>
  /** The function_call_output the live tool executor produced (parsed). */
  result: Record<string, unknown> | null
  /** Ordinal position within the whole run (to compare against speech ordering). */
  seq: number
}

export interface Violation {
  /** Stable machine code for the assertion family that fired. */
  code: ViolationCode
  turn: number
  detail: string
}

export type ViolationCode =
  | 'SPEECH_BEFORE_TOOL'        // spoke before calling a required tool
  | 'STALLING_PHRASE'           // "רגע" / "אני בודקת" / "תכף אחזור"
  | 'PERSISTED_STATE_MISMATCH'  // claimed a save the store does not contain
  | 'LOCATION_DROPPED'          // a location the user gave did not survive to the event
  | 'NAME_ABSENT_LONG_CONVO'    // never used Martita's name in a long conversation
  | 'CAPABILITY_WITHOUT_TOOL'   // offered a capability with no registered tool
  | 'NON_HEBREW_OUTPUT'         // Latin/English leakage where Hebrew is expected
  | 'MASCULINE_SELF_REFERENCE'  // Abu referred to herself in the masculine
  | 'RUN_ERROR'                 // driver/plumbing error (surfaced, not hidden)

export type ScenarioStatus = 'PASS' | 'FAIL' | 'BLOCKED'

export interface ScenarioResult {
  id: string
  title: string
  status: ScenarioStatus
  /** Non-null only when BLOCKED (e.g. no model driver). */
  blockedReason: string | null
  transcript: TranscriptEntry[]
  toolCalls: ToolCallRecord[]
  violations: Violation[]
  /** Final persisted calendar (what the store actually holds after the run). */
  persistedCalendar: LiveEvent[]
  /** Final pending draft, if any (diagnostic). */
  pendingDraft: CalendarDraft | null
}
