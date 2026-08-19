/*
 * FLIGHT RECORDER — importer: exported transcript → standing regression replay.
 * ════════════════════════════════════════════════════════════════════════════
 * The Flight Recorder CAPTURE side already exists and is reused, not rebuilt:
 *   • src/evolution/observer.ts  — the OBSERVE_ONLY serving-plane seam (observeTurn)
 *     is wired into ExecutiveCognitiveController, so EVERY typed + voice turn is
 *     captured (one runtime path) as a redacted, text-only AbuTraceEnvelope.
 *   • src/evolution/traceEnvelope.ts — buildEnvelope redacts + minimizes (no audio,
 *     PII stripped) and dedups by idempotency key.
 *   • src/evolution/evidenceQueue.ts — durable IndexedDB ring buffer (local storage).
 *   • OFF SWITCH: src/evolution/config.ts — VITE_EVOLUTION_KILL=1 (or EvolutionConfig
 *     .enabled=false) silences all capture instantly.
 *
 * THIS module is the missing link the mandate asks for: turn an EXPORTED transcript
 * into a STANDING regression replay so every real-world failure becomes a permanent
 * test. It:
 *   1. maps redacted envelopes → a stable, text-only export shape (envelopesToExport);
 *   2. serializes/parses that shape for the export button (serializeExport/parseExport);
 *   3. imports a curated real-device record (importLeoRepro) into the same shape, with
 *      per-turn expectations derived from STRUCTURED truth fields (not stale wording);
 *   4. replays every turn through the SAME app entry the marathon/scorecard use and
 *      asserts each recorded truth still holds (replayExport) — and CATCHES divergences.
 *
 * Evidence class: CODE (real controller + preprocessing, mocked llm/online).
 */
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
// The export shape + serializers live in the RUNTIME module (src/evolution) so the
// app bundle never pulls this eval/replay harness. Re-exported here so the shape has
// ONE source and existing importers of './flightRecorderImport' keep working.
import {
  FLIGHT_RECORDER_EXPORT_VERSION,
  envelopesToExport, serializeExport, parseExport,
  type FlightRecorderTurn, type FlightRecorderSession, type FlightRecorderExport,
} from '../evolution/recorderExport'

export {
  FLIGHT_RECORDER_EXPORT_VERSION,
  envelopesToExport, serializeExport, parseExport,
}
export type { FlightRecorderTurn, FlightRecorderSession, FlightRecorderExport }

const HE_RE = /[֐-׿]/
const inferLang = (s: string): 'he' | 'es' => (HE_RE.test(s) ? 'he' : 'es')

// ── Leo real-device record importer ──────────────────────────────────────────
interface LeoRec {
  id: string; input: string; answer?: string
  resolves?: boolean; deadEnd?: boolean
  resolvedToGilad?: boolean; literalPhrase?: boolean
  hasLocation?: boolean; dateTomorrow?: boolean; dateToday?: boolean; verbatimDump?: boolean
}

/**
 * Import docs/eval/LEO_DEVICE_FAILURES_REPRO.json → a standing transcript. The
 * per-turn expectations are derived from the STRUCTURED truth fields (resolvedToGilad,
 * hasLocation, dateTomorrow, verbatimDump …) — NOT the recorded `answer` wording,
 * which was captured before later phrasing fixes (e.g. the Cycle-43 subject-dedup).
 * This keeps the recorded TRUTH permanent while phrasing is free to improve.
 */
export function importLeoRepro(json: string): FlightRecorderExport {
  const data = JSON.parse(json) as { rec?: LeoRec[] }
  const sessions: FlightRecorderSession[] = (data.rec ?? []).map((r) => {
    const expectContains: string[] = []
    const expectAbsent: string[] = []
    // Relation resolution: "מי גלעד עבור רפי" resolves to a real relation, no dead-end.
    if (r.resolves) { expectContains.push('גלעד'); if (/רפי/.test(r.input)) expectContains.push('רפי') }
    // A relation-phrase create must schedule the RESOLVED person (גלעד), never the literal phrase.
    if (r.resolvedToGilad) expectContains.push('גלעד')
    if (r.literalPhrase === false) expectAbsent.push('החתן של רפי')
    // Place / date truths.
    if (r.hasLocation) expectContains.push('טולדנו')
    if (r.dateTomorrow) expectContains.push('מחר')
    // A rambling story must NOT be dumped verbatim into the confirmation.
    if (r.verbatimDump === false) { expectAbsent.push('ניו יורק'); expectAbsent.push('טס') }
    const turn: FlightRecorderTurn = {
      input: r.input, lang: inferLang(r.input),
      ...(r.answer ? { recordedReply: r.answer } : {}),
      ...(expectContains.length ? { expectContains: [...new Set(expectContains)] } : {}),
      ...(expectAbsent.length ? { expectAbsent: [...new Set(expectAbsent)] } : {}),
      note: `leo:${r.id}`,
    }
    return { id: `leo:${r.id}`, turns: [turn] }
  })
  return { version: FLIGHT_RECORDER_EXPORT_VERSION, appVersion: 'leo-device-repro', sessions }
}

// ── Replay ────────────────────────────────────────────────────────────────────
const REPLAY_TOOLS: FullTurnTools = {
  llm: async () => 'תשובה קצרה ונכונה.',
  online: async () => ({ ok: true, answer: 'תוצאה מאומתת מהרשת.', reason: null }),
}

export interface ReplayTurnResult { session: string; input: string; reply: string; pass: boolean; fails: string[] }
export interface ReplayResult { turns: ReplayTurnResult[]; failures: ReplayTurnResult[] }

/**
 * Replay an exported transcript through the SAME app entry the marathon/scorecard use.
 * Each session is independent (store reset); multi-turn state is preserved WITHIN a
 * session. A turn passes when the reply is non-empty and every recorded expectation
 * (contains / absent / side-effect) still holds. Returns the failing turns so a
 * divergence names a real regression — the importer catches drift, never green-washes.
 */
export async function replayExport(exp: FlightRecorderExport, opts: { now?: Date } = {}): Promise<ReplayResult> {
  const now = opts.now ?? new Date()
  const turns: ReplayTurnResult[] = []
  for (const s of exp.sessions) {
    saveAppointments([])
    let state: RuntimeState = IDLE_RUNTIME
    for (const t of s.turns) {
      const r = await ExecutiveCognitiveController.handleTurn(state, t.input, { messages: [], now }, REPLAY_TOOLS)
      state = r.state
      const reply = (r.display ?? '').replace(/\s+/g, ' ').trim()
      const fails: string[] = []
      if (!reply) fails.push('empty')
      for (const sub of t.expectContains ?? []) if (!reply.includes(sub)) fails.push(`expectContains:${sub}`)
      for (const sub of t.expectAbsent ?? []) if (reply.includes(sub)) fails.push(`expectAbsent:${sub}`)
      if (t.expectSide && (r.sideEffect ?? null) !== t.expectSide) fails.push(`expectSide:${t.expectSide}`)
      turns.push({ session: s.id, input: t.input, reply, pass: fails.length === 0, fails })
    }
  }
  return { turns, failures: turns.filter((t) => !t.pass) }
}
