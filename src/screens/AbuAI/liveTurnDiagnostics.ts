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

const MAX = 20
const BUFFER: LiveTurnRecord[] = []

export function recordTurn(r: LiveTurnRecord): void {
  BUFFER.push(r)
  while (BUFFER.length > MAX) BUFFER.shift()
}

export function lastTurns(n = MAX): LiveTurnRecord[] {
  return BUFFER.slice(-n)
}

export function clearTurns(): void { BUFFER.length = 0 }

/** JSON dump for the hidden "Copy Last 20 AbuAI Turns" debug action. */
export function dumpTurns(): string {
  return JSON.stringify({ count: BUFFER.length, turns: lastTurns() }, null, 2)
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
