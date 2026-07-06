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
}

import { createMemoryEngine } from './memoryEngineV2'

const MAX = 20
const BUFFER: LiveTurnRecord[] = []
// Memory Engine v2 is the EXECUTED session-memory store behind the diagnostics: every
// production turn (the Executive Controller calls recordTurn) writes here, and Copy Last
// 20 reads its canonical turn history + last tool result.
let memory = createMemoryEngine('diagnostics')

export function recordTurn(r: LiveTurnRecord): void {
  BUFFER.push(r)
  while (BUFFER.length > MAX) BUFFER.shift()
  memory.rememberTurn(r.input, r.finalAnswer, {
    intent: r.intent, display: r.finalAnswer, source: r.source,
    ...(r.speechChunks ? { chunks: r.speechChunks } : {}),
    state: { createState: { phase: 'idle' }, lastFamilyPair: null },
  })
  if (r.toolResult) memory.rememberToolResult(r.source, r.toolResult)
}

export function lastTurns(n = MAX): LiveTurnRecord[] {
  return BUFFER.slice(-n)
}

/** The canonical Memory Engine v2 turn history behind Copy Last 20 (executed in prod). */
export function memoryTurns(n = MAX): ReturnType<typeof memory.exportLastTurns> { return memory.exportLastTurns(n) }
export function memoryLastTool(): ReturnType<typeof memory.getLastToolResult> { return memory.getLastToolResult() }

export function clearTurns(): void { BUFFER.length = 0; memory = createMemoryEngine('diagnostics') }

/** JSON dump for the hidden "Copy Last 20 AbuAI Turns" debug action — includes the
 *  Memory Engine v2 canonical turns + last tool result so traces are consistent. */
export function dumpTurns(): string {
  return JSON.stringify({ count: BUFFER.length, turns: lastTurns(), memoryTurns: memoryTurns(), lastTool: memoryLastTool() }, null, 2)
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
