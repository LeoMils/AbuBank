/*
 * toolSequencingOracle.ts — RAW-EVENT-ORDERING acceptance for tool-backed turns. (§16 add-2)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * The single most-reported device defect: Abu speaks filler around a lookup — "רגע, אני בודקת"
 * before every tool call (9/9 in one session) — and sometimes claims a result is still pending
 * after it already returned. The AbuAI interaction contract for a tool-backed answer is:
 *
 *     tool_call → (silence: no assistant semantic output) → tool_result → final grounded answer
 *
 * This oracle grades that contract from the RAW event stream (FlightRecorder entries + preamble
 * gaps), NOT from transcript interpretation. It is pure and deterministic so it runs in a test AND
 * over a real downloaded device/golden trace (same shape). Violations:
 *   • INTERLEAVE_SEMANTIC   — assistant speech emitted while a tool_call is open (before its result)
 *   • SPOKEN_PREAMBLE       — assistant spoke a filler/"checking" line in a tool turn (preamble gap>0
 *                             OR a pending-marker utterance before the tool_call)
 *   • PENDING_AFTER_RESULT  — assistant claims the result is still pending AFTER it returned
 *   • REPEATED_SENTENCE     — the same spoken sentence appears twice in the session
 *   • MASKED_FALLBACK       — watchdog/fallback fired on the clean happy path (primary path failed
 *                             and something masked it) — counted and surfaced to investigate
 */

export type SeqKind = 'user_speech' | 'abu_speech' | 'tool_call' | 'tool_result' | 'note'
export interface SeqEvent { seq: number; kind: SeqKind; text?: string; tool?: string }

export interface ToolSequencingInput {
  /** Ordered raw events (FlightRecorder TraceExport.entries — already seq-ordered). */
  entries: SeqEvent[]
  /** Per-response preamble gaps (ms) the recorder measured: audio spoken BEFORE the function_call in
   *  the SAME response. Any nonzero value is a spoken preamble → a tool turn that spoke filler first. */
  preambleGaps?: number[]
  /** Recoverable-error and non-returning-tool counts from the recorder (masking signals). */
  recoverableCount?: number
  toolIssueCount?: number
}

export type ToolSeqViolationType =
  | 'INTERLEAVE_SEMANTIC' | 'SPOKEN_PREAMBLE' | 'PENDING_AFTER_RESULT' | 'REPEATED_SENTENCE' | 'MASKED_FALLBACK'

export interface ToolSeqViolation { type: ToolSeqViolationType; detail: string; atSeq?: number }
export interface ToolSequencingResult {
  /** True only when there are ZERO hard violations AND zero masked-fallback activations (clean path). */
  pass: boolean
  violations: ToolSeqViolation[]
  watchdogFallbackCount: number
  repeatedSentences: string[]
  toolTurns: number
}

// "I'm checking / one moment / pending" fillers a tool-backed answer must NOT speak (HE/ES/EN).
const PENDING_RE = /רגע|שני[יה]|תכף|אני\s*בודקת|בודקת\b|אחכה|תני\s*לי\s*רגע|un\s*momento|esper[aá]|d[eé]jame\s*(?:ver|revisar)|one\s*moment|hold\s*on|let\s*me\s*check|checking\b|just\s*a\s*sec/i
// Notes that mean a fallback/watchdog masked a primary-path failure.
const MASK_RE = /watchdog|fallback|REALTIME_AUDIO_TIMEOUT|recovered|tap-to-hear|recovery/i

function normalize(text: string): string {
  return (text || '').replace(/\s+/g, ' ').replace(/[.!?…،,]+$/g, '').trim()
}

export function evaluateToolSequencing(input: ToolSequencingInput): ToolSequencingResult {
  const violations: ToolSeqViolation[] = []
  const entries = [...input.entries].sort((a, b) => a.seq - b.seq)

  // (1) INTERLEAVE — assistant speech while ≥1 tool_call is open (not yet matched by a tool_result).
  let openCalls = 0
  let sawResultSinceCall = false
  let toolTurns = 0
  let turnHasCall = false
  for (const e of entries) {
    if (e.kind === 'user_speech') { openCalls = 0; sawResultSinceCall = false; if (turnHasCall) {} turnHasCall = false }
    else if (e.kind === 'tool_call') { openCalls++; turnHasCall = true; sawResultSinceCall = false }
    else if (e.kind === 'tool_result') { if (openCalls > 0) openCalls--; sawResultSinceCall = true }
    else if (e.kind === 'abu_speech') {
      const t = normalize(e.text || '')
      if (openCalls > 0) violations.push({ type: 'INTERLEAVE_SEMANTIC', detail: `assistant spoke while a tool_call was open: "${t.slice(0, 40)}"`, atSeq: e.seq })
      // (3) PENDING_AFTER_RESULT — a "still checking" line AFTER the result already returned.
      if (sawResultSinceCall && openCalls === 0 && PENDING_RE.test(t)) {
        violations.push({ type: 'PENDING_AFTER_RESULT', detail: `assistant claimed pending after the tool result returned: "${t.slice(0, 40)}"`, atSeq: e.seq })
      }
    }
  }
  // Count tool turns (turns containing ≥1 tool_call) for context.
  {
    let inCallTurn = false
    for (const e of entries) {
      if (e.kind === 'user_speech') { if (inCallTurn) toolTurns++; inCallTurn = false }
      else if (e.kind === 'tool_call') inCallTurn = true
    }
    if (inCallTurn) toolTurns++
  }

  // (2) SPOKEN_PREAMBLE — the recorder measured audio spoken before the function_call in the same
  // response (a nonzero preamble gap), OR a pending-marker utterance immediately before a tool_call.
  for (const gap of input.preambleGaps ?? []) {
    if (gap > 0) violations.push({ type: 'SPOKEN_PREAMBLE', detail: `spoke ${Math.round(gap)}ms of preamble before a tool call (contract: silence before the tool result)` })
  }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!
    if (e.kind === 'abu_speech' && PENDING_RE.test(normalize(e.text || ''))) {
      // A pending filler line whose turn also makes a tool call = the "רגע אני בודקת before every lookup".
      const next = entries.slice(i + 1).find((x) => x.kind === 'tool_call' || x.kind === 'user_speech')
      if (next?.kind === 'tool_call' && !violations.some((v) => v.type === 'SPOKEN_PREAMBLE' && v.atSeq === e.seq)) {
        violations.push({ type: 'SPOKEN_PREAMBLE', detail: `spoke a "checking" filler before a tool call: "${normalize(e.text || '').slice(0, 40)}"`, atSeq: e.seq })
      }
    }
  }

  // (4) REPEATED_SENTENCE — the same spoken sentence twice in the session.
  const seen = new Map<string, number>()
  const repeatedSentences: string[] = []
  for (const e of entries) {
    if (e.kind !== 'abu_speech') continue
    const t = normalize(e.text || '')
    if (t.length < 8) continue // ignore trivial/short utterances ("כן", "בסדר")
    const prev = seen.get(t)
    if (prev !== undefined) {
      if (!repeatedSentences.includes(t)) repeatedSentences.push(t)
      violations.push({ type: 'REPEATED_SENTENCE', detail: `spoken sentence repeated in-session: "${t.slice(0, 40)}"`, atSeq: e.seq })
    }
    seen.set(t, e.seq)
  }

  // (5) MASKED_FALLBACK — watchdog/fallback on the clean happy path (a masked primary-path failure).
  let watchdogFallbackCount = (input.recoverableCount ?? 0) + (input.toolIssueCount ?? 0)
  for (const e of entries) if (e.kind === 'note' && MASK_RE.test(e.text || '')) watchdogFallbackCount++
  if (watchdogFallbackCount > 0) violations.push({ type: 'MASKED_FALLBACK', detail: `${watchdogFallbackCount} watchdog/fallback activation(s) on the clean path — primary path failed and was masked; investigate` })

  return {
    pass: violations.length === 0,
    violations,
    watchdogFallbackCount,
    repeatedSentences,
    toolTurns,
  }
}
