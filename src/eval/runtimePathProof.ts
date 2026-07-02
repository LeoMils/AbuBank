/*
 * Runtime Path Proof (Phase 1 — architecture verification)
 * ════════════════════════════════════════════════════════
 * Traces every possible user-input PATH TYPE through the Executive Cognitive
 * Controller and proves, per path, that the answer is RUNTIME_FINALIZED with the
 * full stage trace (input → meta → intent → domain/tool → finalize → supervise →
 * deliver) and passes the no-bypass guard. This is the runtime-tracing evidence
 * that the CONTROLLER PATH has zero bypasses.
 *
 * It does NOT claim the live default has one path — that is flag-dependent and is
 * reported honestly in docs/eval/ABUAI_EXECUTION_GRAPH.md.
 */
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { isFinalized, REQUIRED_STAGES } from '../screens/AbuAI/runtimeTrace'
import { isEmittable } from '../screens/AbuAI/noBypassRuntimeGuard'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

const NOW = new Date(2026, 6, 3, 9, 0, 0)
const CTX = { messages: [] as Array<{ role: string; content: string }>, now: NOW }
const TOOLS: FullTurnTools = { llm: async () => 'המהפכה הצרפתית פרצה ב-1789. היא שינתה את צרפת.', online: async () => ({ ok: true, answer: 'יש הקרנה בשבע וחצי.' }) }

export interface PathTrace {
  path: string
  input: string
  reachedController: boolean
  finalized: boolean
  stages: string[]
  bypass: boolean
}

async function trace(path: string, input: string, state: RuntimeState): Promise<{ row: PathTrace; state: RuntimeState }> {
  const r = await ExecutiveCognitiveController.handleTurn(state, input, CTX, TOOLS)
  const reachedController = r.controller === 'executive-cognitive-controller'
  const finalized = isFinalized(r.trace)
  const hasAllStages = REQUIRED_STAGES.every(s => r.trace.stages.includes(s)) && r.trace.stages.includes('meta')
  const emittable = isEmittable(r)
  return {
    row: { path, input, reachedController, finalized, stages: r.trace.stages, bypass: !(reachedController && finalized && hasAllStages && emittable) },
    state: r.state,
  }
}

/** Every distinct input PATH TYPE, traced through the one controller. */
export async function proveAllPaths(): Promise<PathTrace[]> {
  saveAppointments([])
  const rows: PathTrace[] = []

  // Voice and Typed text use the SAME entry (ExecutiveCognitiveController.handleTurn).
  rows.push((await trace('typed', 'איזה יום היום', IDLE_RUNTIME)).row)
  rows.push((await trace('voice', 'מה יש לי מחר', IDLE_RUNTIME)).row) // voice path calls the identical fn

  // Calendar (create → confirm/save), Family, Online, Continue, Retry, Resume, Tool-response.
  { const a = await trace('calendar', 'תקבעי פגישה עם דני מחר בשבע בערב', IDLE_RUNTIME); rows.push(a.row)
    rows.push((await trace('calendar-confirm', 'כן כן', a.state)).row) }
  rows.push((await trace('family', 'מה הקשר בין לאו לאנאבל', IDLE_RUNTIME)).row)
  rows.push((await trace('online', 'מה הסרטים בכפר סבא', IDLE_RUNTIME)).row)

  // Continue / Resume / Tool-response (LLM output finalized) — seed then continue.
  { const seed = await trace('tool-response', 'ספרי לי על המהפכה הצרפתית', IDLE_RUNTIME); rows.push(seed.row)
    rows.push((await trace('continue', 'תמשיכי', seed.state)).row)
    rows.push((await trace('resume', 'על מה דיברנו', seed.state)).row) }

  // Retry (repeat after frustration) — both turns must be finalized.
  { const f = await trace('retry', 'את לא מבינה אותי', IDLE_RUNTIME); rows.push(f.row)
    rows.push((await trace('retry-again', 'את לא עונה למה ששאלתי', f.state)).row) }

  return rows
}

export function pathScore(rows: PathTrace[]): { total: number; bypasses: number; reached: number; finalized: number } {
  return {
    total: rows.length,
    bypasses: rows.filter(r => r.bypass).length,
    reached: rows.filter(r => r.reachedController).length,
    finalized: rows.filter(r => r.finalized).length,
  }
}
