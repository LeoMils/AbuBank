/*
 * sharedConstruction.test.ts — the anti-divergence proof.
 * ════════════════════════════════════════════════════════════════════════════
 * If the text harness and the live VOICE path could construct different
 * instructions, a different tool registry, or a different turn lifecycle, the
 * harness would be worthless (it would test something Martita never talks to). This
 * test asserts the two are built from the SAME source: buildSessionUpdate() (which
 * liveSession.ts sends over the wire) and the SAME lifecycle predicate.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSessionUpdate, isEndOfTurn as liveIsEndOfTurn, WAIT_FOR_USER_TOOL } from '../liveSession'
import { buildLiveInstructions } from '../liveInstructions'
import { LIVE_TOOL_SCHEMAS, LIVE_TOOL_NAMES } from '../liveTools'
import { buildHarnessSession } from './session'

const NOW = Date.parse('2026-08-10T09:00:00.000Z')
const HERE = dirname(fileURLToPath(import.meta.url))

describe('text harness shares construction with the live voice path', () => {
  it('uses the SAME instructions string as the voice session.update', () => {
    const voice = buildSessionUpdate(NOW) as { session: { instructions: string } }
    const harness = buildHarnessSession(NOW)
    expect(harness.instructions).toBe(voice.session.instructions)
    // …and that string really is the shared build-time instructions.
    expect(harness.instructions).toContain(buildLiveInstructions())
  })

  it('uses the SAME tool registry (liveTools + wait_for_user), not a re-authored one', () => {
    const voice = buildSessionUpdate(NOW) as { session: { tools: unknown[]; tool_choice: unknown } }
    const harness = buildHarnessSession(NOW)
    expect(harness.tools).toEqual(voice.session.tools)
    expect(harness.tools).toEqual([WAIT_FOR_USER_TOOL, ...LIVE_TOOL_SCHEMAS])
    expect(harness.toolChoice).toBe(voice.session.tool_choice)
    // Every registered live tool is present by name.
    const names = (harness.tools as Array<{ name: string }>).map((t) => t.name)
    for (const n of LIVE_TOOL_NAMES) expect(names).toContain(n)
    expect(names).toContain('wait_for_user')
  })

  it('the runner drives the SAME turn lifecycle predicate (isEndOfTurn)', () => {
    // Identity check: the runner imports isEndOfTurn straight from liveSession, so a
    // `commentary` step keeps the turn open and a final/phaseless step ends it — the
    // exact rule the voice path applies to response.done.
    const runnerSrc = readFileSync(resolve(HERE, 'runner.ts'), 'utf8')
    expect(runnerSrc).toContain("import { isEndOfTurn } from '../liveSession'")
    expect(liveIsEndOfTurn({ response: { phase: 'commentary' } })).toBe(false)
    expect(liveIsEndOfTurn({ response: { phase: 'final_answer' } })).toBe(true)
    expect(liveIsEndOfTurn({})).toBe(true)
  })

  it('session.ts derives from buildSessionUpdate and does NOT hard-code a tool list', () => {
    const sessionSrc = readFileSync(resolve(HERE, 'session.ts'), 'utf8')
    expect(sessionSrc).toContain('buildSessionUpdate')
    // Guard: the harness must not define its own copies of the tool names.
    expect(sessionSrc).not.toContain('resolve_contact')
    expect(sessionSrc).not.toContain('prepare_calendar_event')
  })

  it('routes tool calls through the SAME executor (LiveTools) as the voice path', () => {
    const runnerSrc = readFileSync(resolve(HERE, 'runner.ts'), 'utf8')
    expect(runnerSrc).toContain("import { LiveTools")
    expect(runnerSrc).toContain('liveTools.handleFunctionCall(fc)')
    expect(runnerSrc).toContain("fc.name === 'wait_for_user'")
  })
})
