/*
 * FLIGHT RECORDER — importer → standing regression replay (Priority 1).
 * ════════════════════════════════════════════════════════════════════
 * The Flight Recorder captures every real turn as a redacted, text-only trace
 * envelope (src/evolution/observer.ts → buildEnvelope → durable IndexedDB queue).
 * This suite proves the IMPORTER: an exported transcript (redacted envelopes OR a
 * curated real-device record) converts into a STANDING regression replay that runs
 * every recorded turn back through the SAME app entry (ExecutiveCognitiveController)
 * and asserts the recorded truth still holds. Every real-world failure that gets
 * exported becomes a permanent test.
 *
 * Evidence class: CODE (real controller + real preprocessing, mocked llm/online).
 * The live capture path is CODE too; PREVIEW/PHYSICAL is a deployed-app claim, not made here.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  FLIGHT_RECORDER_EXPORT_VERSION,
  envelopesToExport, serializeExport, parseExport, importLeoRepro, replayExport,
  type FlightRecorderExport,
} from './flightRecorderImport'
import { buildEnvelope } from '../evolution/traceEnvelope'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday — "מחר" is deterministic
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
})

const LEO_JSON = path.resolve(__dirname, '../../docs/eval/LEO_DEVICE_FAILURES_REPRO.json')

describe('Flight Recorder — envelope → export mapping (text-only, redaction-safe)', () => {
  it('maps redacted envelopes into an ordered, text-only export with no audio', () => {
    const env1 = buildEnvelope({ ts: 1, sessionId: 's1', turnId: 't1', input: 'מי גלעד עבור רפי', intent: 'family_relation', source: 'deterministic', finalAnswer: 'גלעד החתן של רפי.' })
    const env2 = buildEnvelope({ ts: 2, sessionId: 's1', turnId: 't2', input: 'תבטלי אותה', intent: 'calendar_delete', source: 'deterministic', finalAnswer: 'מחקתי.', committedStateChanges: ['deleted'] })
    const exp = envelopesToExport([env2, env1]) // deliberately out of order
    expect(exp.version).toBe(FLIGHT_RECORDER_EXPORT_VERSION)
    expect(exp.sessions).toHaveLength(1)
    expect(exp.sessions[0]!.turns.map((t) => t.input)).toEqual(['מי גלעד עבור רפי', 'תבטלי אותה']) // ordered by time
    expect(exp.sessions[0]!.turns[1]!.expectSide).toBe('deleted')
    // Text-only: the serialized form carries no audio/blob field.
    const json = serializeExport(exp)
    expect(json).not.toMatch(/audio|blob|base64|wav|mp3|pcm/i)
    // Round-trips.
    expect(parseExport(json).sessions[0]!.turns[0]!.input).toBe('מי גלעד עבור רפי')
  })
})

describe('Flight Recorder — Leo real device transcripts as a STANDING replay', () => {
  it('imports LEO_DEVICE_FAILURES_REPRO and replays every recorded truth green', async () => {
    const raw = fs.readFileSync(LEO_JSON, 'utf8')
    const exp = importLeoRepro(raw)
    expect(exp.sessions.length).toBeGreaterThanOrEqual(3)
    const res = await replayExport(exp)
    // Print the replay for triage.
    // eslint-disable-next-line no-console
    console.log('\n[FLIGHT RECORDER — Leo replay]')
    for (const t of res.turns) {
      // eslint-disable-next-line no-console
      console.log(`  ${t.pass ? 'PASS' : 'FAIL'} [${t.session}] «${t.input.slice(0, 40)}» → "${t.reply.slice(0, 60)}"${t.fails.length ? ' :: ' + t.fails.join(',') : ''}`)
    }
    expect(res.turns.length).toBeGreaterThanOrEqual(3)
    // Every recorded Leo truth must still hold (regression floor).
    expect(res.failures).toEqual([])
  })
})

describe('Flight Recorder — the importer CATCHES a divergence (not just green-washes)', () => {
  it('flags a turn whose recorded truth no longer holds', async () => {
    // A hand-authored export asserting a FALSE expectation: the rambling create must
    // NOT resolve to גלעד. The live app DOES resolve to גלעד, so this expectAbsent is
    // violated → the importer must report it as a failure (proving it can catch regressions).
    const exp: FlightRecorderExport = {
      version: FLIGHT_RECORDER_EXPORT_VERSION,
      sessions: [{ id: 'divergence-probe', turns: [
        { input: 'תקבעי פגישה עם החתן של רפי מחר בשלוש', lang: 'he', expectAbsent: ['גלעד'] },
      ] }],
    }
    const res = await replayExport(exp)
    expect(res.failures.length).toBe(1)
    expect(res.failures[0]!.fails).toContain('expectAbsent:גלעד')
  })
})
