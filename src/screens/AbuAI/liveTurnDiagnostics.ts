/*
 * Live Turn Diagnostics
 * ═════════════════════
 * A ring buffer of the last N AbuAI turns with everything needed to debug a real
 * iPhone failure: version, input, normalized text, intent, source/plugin, entities,
 * calendar draft fields, missing fields, tool calls/results, final answer, speech
 * chunks, and errors. The Executive Controller records one entry per turn.
 *
 * `dumpTurns()` returns a JSON string for a hidden "Copy Last 20 AbuAI Turns"
 * button / console dump so Leo can paste real runtime traces.
 */
export interface LiveTurnRecord {
  ts: number
  version: string
  input: string
  normalized?: string
  intent: string
  source: string
  entities?: Record<string, unknown>
  draftFields?: Record<string, unknown>
  missingFields?: string[]
  toolCalls?: string[]
  toolResult?: string | null
  finalAnswer: string
  speechChunks?: string[]
  error?: string | null
  /** provider trace (Online Runtime v2), finalizer stages + stamp — stored in memory. */
  onlineTrace?: unknown
  finalizerStages?: string[]
  finalizerStamp?: string
}

import { createMemoryEngine } from './memoryEngineV2'

const MAX = 20
// SINGLE canonical turn store: Memory Engine v2 owns every turn (rich diagnostic record +
// provider/speech/finalizer/error traces). There is NO separate ring buffer. The Executive
// Controller calls recordTurn each production turn; Copy Last 20 reads only from here.
let memory = createMemoryEngine('diagnostics')

export function recordTurn(r: LiveTurnRecord): void {
  memory.rememberTurn(r.input, r.finalAnswer, {
    intent: r.intent, display: r.finalAnswer, source: r.source,
    ...(r.speechChunks ? { chunks: r.speechChunks } : {}),
    state: { createState: { phase: 'idle' }, lastFamilyPair: null },
  }, r)                                              // the whole record is the turn's diag
  if (r.toolResult) memory.rememberToolResult(r.source, r.toolResult)
}

/** The last N turns — read ONLY from Memory Engine v2 (the single store). */
export function lastTurns(n = MAX): LiveTurnRecord[] { return memory.exportDiagnostics<LiveTurnRecord>(n) }

export function clearTurns(): void { memory = createMemoryEngine('diagnostics') }

/** JSON dump for the hidden "Copy Last 20 AbuAI Turns" debug action — sourced solely from
 *  Memory Engine v2 (turns carry provider/speech/finalizer/error traces + last tool). */
export function dumpTurns(): string {
  const turns = lastTurns()
  return JSON.stringify({ count: turns.length, turns, lastTool: memory.getLastToolResult() }, null, 2)
}

/** Copy the last 20 turns to the clipboard (falls back to a returned string). */
export async function copyLastTurns(): Promise<string> {
  const dump = dumpTurns()
  try {
    const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText(s: string): Promise<void> } } }).navigator
    if (nav?.clipboard?.writeText) await nav.clipboard.writeText(dump)
  } catch { /* clipboard unavailable — caller still gets the string */ }
  return dump
}

// Expose a console-accessible debug hook so Leo can run `__abuaiDumpTurns()` in
// Safari on the iPhone and paste the last 20 turns, even without a visible button.
try {
  const g = globalThis as unknown as { __abuaiDumpTurns?: () => string; __abuaiCopyTurns?: () => Promise<string> }
  g.__abuaiDumpTurns = dumpTurns
  g.__abuaiCopyTurns = copyLastTurns
} catch { /* non-browser */ }
