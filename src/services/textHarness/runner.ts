/*
 * textHarness/runner.ts — drive ONE scenario through the live path's reasoning loop.
 * ════════════════════════════════════════════════════════════════════════════
 * The turn loop mirrors liveSession.ts exactly, minus audio:
 *   • the session is buildHarnessSession(now) — the SAME instructions + tools the
 *     voice path sends;
 *   • tool calls are routed through the SAME executor (LiveTools) and the SAME
 *     wait_for_user no-op rule as LiveSession.handleToolCall;
 *   • turn end is decided by the SAME lifecycle predicate (isEndOfTurn), so a
 *     `commentary` step keeps the turn open exactly as in the voice path.
 * The only substitution is the model DRIVER (typed text in, no acoustic clock).
 */
import { LiveTools } from '../liveTools'
import { isEndOfTurn } from '../liveSession'
import { safeParseArgs, type ParsedFunctionCall } from '../../screens/AbuAI/realtime/realtimeFunctionBridge'
import { __setContactData } from '../liveContacts'
import { buildHarnessSession } from './session'
import { inMemoryCalendarStore } from './store'
import { runAssertions } from './assertions'
import type {
  ModelDriver, Scenario, ScenarioResult, ToolCallRecord, TranscriptEntry, Violation,
} from './types'

/** Hard cap on model steps per turn so a misbehaving driver cannot loop forever. */
const MAX_STEPS_PER_TURN = 12

export interface RunnerDeps {
  /** Wall clock, used only when a scenario does not pin fakes.nowMs. */
  now: () => number
}

const defaultDeps: RunnerDeps = { now: () => Date.now() }

/** Run a single scenario end-to-end and return its full result (transcript, every
 *  tool call with args + results, violations, persisted state). Never throws — a
 *  driver/plumbing error becomes a RUN_ERROR violation so it stays visible. */
export async function runScenario(
  scenario: Scenario,
  driver: ModelDriver,
  deps: RunnerDeps = defaultDeps,
): Promise<ScenarioResult> {
  const now = scenario.fakes?.nowMs ?? deps.now()
  const transcript: TranscriptEntry[] = []
  const toolCalls: ToolCallRecord[] = []
  const violations: Violation[] = []
  let seq = 0

  // Inject the fake family graph for this scenario (if any); always restore after.
  const hasFamilyOverride = !!scenario.fakes?.familyData
  if (hasFamilyOverride) __setContactData(scenario.fakes!.familyData!)

  // The in-memory calendar store (seeded with the scenario's fake events).
  const store = inMemoryCalendarStore(scenario.fakes?.calendar ?? [])

  // Capture the function_call_output LiveTools emits (same events the voice path
  // would send over the wire) so we can record results and feed them back.
  const outputs = new Map<string, string>()
  const send = (event: Record<string, unknown>) => {
    if (event.type === 'conversation.item.create') {
      const item = event.item as { type?: string; call_id?: string; output?: string } | undefined
      if (item?.type === 'function_call_output' && item.call_id) outputs.set(item.call_id, item.output ?? '{}')
    }
  }
  const liveTools = new LiveTools(send, store)

  const finish = (): ScenarioResult => {
    const persisted = store.list()
    violations.push(...runAssertions(scenario, transcript, toolCalls, persisted))
    if (hasFamilyOverride) __setContactData(null) // restore bundled data
    return {
      id: scenario.id,
      title: scenario.title,
      status: violations.length ? 'FAIL' : 'PASS',
      blockedReason: null,
      transcript,
      toolCalls,
      violations,
      persistedCalendar: persisted,
      pendingDraft: liveTools.viewCalendarDraft(),
    }
  }

  if (!driver.available) {
    if (hasFamilyOverride) __setContactData(null)
    return {
      id: scenario.id, title: scenario.title, status: 'BLOCKED',
      blockedReason: driver.label, transcript: [], toolCalls: [], violations: [],
      persistedCalendar: store.list(), pendingDraft: null,
    }
  }

  try {
    await driver.begin(buildHarnessSession(now))

    for (let turn = 0; turn < scenario.turns.length; turn++) {
      const userText = scenario.turns[turn]!.user
      driver.userSays(userText)
      transcript.push({ role: 'user', text: userText, turn, seq: seq++ })

      let steps = 0
      // Drive the model until this turn ends (final answer / phaseless done), exactly
      // like the voice path treats response.done phases.
      for (;;) {
        if (++steps > MAX_STEPS_PER_TURN) {
          violations.push({ code: 'RUN_ERROR', turn, detail: `turn exceeded ${MAX_STEPS_PER_TURN} model steps (possible tool/speech loop)` })
          break
        }
        const step = await driver.next()

        if (step.kind === 'speech') {
          transcript.push({ role: 'abu', text: step.text, phase: step.phase ?? null, turn, seq: seq++ })
          // Same predicate the live path uses: a commentary step is mid-turn.
          if (isEndOfTurn({ response: { phase: step.phase ?? undefined } })) break
          continue
        }

        // step.kind === 'tool_calls' — route through the SAME path liveSession uses.
        for (const call of step.calls) {
          const fc: ParsedFunctionCall = { name: call.name, callId: call.callId, argsJson: call.argsJson }
          const thisSeq = seq++

          if (fc.name === 'wait_for_user') {
            // The no-op turn-taking tool: acknowledge, stay silent (no reply speech).
            const out = '{"status":"waiting"}'
            driver.toolResult(fc.callId, out)
            toolCalls.push({ turn, name: fc.name, callId: fc.callId, args: safeParseArgs(fc.argsJson), result: { status: 'waiting' }, seq: thisSeq })
            continue
          }
          if (!LiveTools.owns(fc.name)) {
            const out = JSON.stringify({ error: 'unknown_tool', name: fc.name })
            driver.toolResult(fc.callId, out)
            toolCalls.push({ turn, name: fc.name, callId: fc.callId, args: safeParseArgs(fc.argsJson), result: { error: 'unknown_tool' }, seq: thisSeq })
            continue
          }
          // The real executor: produces the safe function_call_output (captured by `send`).
          liveTools.handleFunctionCall(fc)
          const outJson = outputs.get(fc.callId) ?? '{}'
          driver.toolResult(fc.callId, outJson)
          toolCalls.push({
            turn, name: fc.name, callId: fc.callId,
            args: safeParseArgs(fc.argsJson),
            result: parseResult(outJson),
            seq: thisSeq,
          })
        }
        // Loop again: the model now speaks the grounded result (or calls another tool).
      }
    }
  } catch (err) {
    violations.push({ code: 'RUN_ERROR', turn: -1, detail: `driver error: ${(err as Error)?.message ?? String(err)}` })
  }

  return finish()
}

function parseResult(json: string): Record<string, unknown> | null {
  try { const v = JSON.parse(json); return v && typeof v === 'object' ? v as Record<string, unknown> : null }
  catch { return null }
}

/** Run many scenarios sequentially (deterministic order). */
export async function runScenarios(
  scenarios: Scenario[], driver: ModelDriver, deps: RunnerDeps = defaultDeps,
): Promise<ScenarioResult[]> {
  const out: ScenarioResult[] = []
  for (const s of scenarios) out.push(await runScenario(s, driver, deps))
  return out
}
