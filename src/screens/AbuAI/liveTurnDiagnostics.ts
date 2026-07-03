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
