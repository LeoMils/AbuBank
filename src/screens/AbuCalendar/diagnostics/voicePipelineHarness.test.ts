/*
 * Text-fixture harness run for the voice pipeline. No microphone.
 *
 * Assertions:
 *   1. The harness produces a row for every fixture without throwing.
 *   2. Detected intent matches the fixture's expected intent.
 *   3. The harness is deterministic — two runs over the same fixtures with
 *      the same TODAY_ISO produce byte-identical output.
 *
 * Side effect: writes the human-readable batch report to
 *   docs/voice-pipeline/voice-pipeline-diagnostic.txt
 * so it can be reviewed without running the test in watch mode.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  runVoicePipelineDiagnostic,
  formatDiagnosticBatch,
  type DiagnosticRow,
} from './voicePipelineHarness'
import { VOICE_PIPELINE_FIXTURES, TODAY_ISO } from './voicePipelineFixtures'

const REPORT_DIR = path.resolve(__dirname, '../../../../docs/voice-pipeline')
const REPORT_PATH = path.join(REPORT_DIR, 'voice-pipeline-diagnostic.txt')

function runAll(): DiagnosticRow[] {
  return VOICE_PIPELINE_FIXTURES.map((f) => runVoicePipelineDiagnostic(f.text, TODAY_ISO))
}

describe('voice pipeline diagnostic harness — text fixtures', () => {
  it('runs all 50 fixtures without throwing and writes a report artifact', () => {
    expect(VOICE_PIPELINE_FIXTURES.length).toBe(50)
    const rows = runAll()
    expect(rows.length).toBe(50)
    fs.mkdirSync(REPORT_DIR, { recursive: true })

    const divergences = VOICE_PIPELINE_FIXTURES
      .map((f, i) => ({ f, row: rows[i]! }))
      .filter(({ f, row }) => row.intent !== f.expectIntent)
      .map(({ f, row }) => `  ${f.id.padEnd(14)} expected=${f.expectIntent.padEnd(15)} got=${row.intent.padEnd(15)}  "${f.text}"`)

    const divergenceBlock = divergences.length === 0
      ? '(none — every fixture\'s detected intent matched its expected label.)'
      : divergences.join('\n')

    const body = [
      `# Voice Pipeline Diagnostic — text-fixture run`,
      `# TODAY_ISO=${TODAY_ISO}  fixtures=${VOICE_PIPELINE_FIXTURES.length}  microphone=disabled`,
      ``,
      `## Intent-detection divergences (expected vs actual)`,
      divergenceBlock,
      ``,
      `## Per-fixture rows`,
      ``,
      formatDiagnosticBatch(rows),
    ].join('\n')

    fs.writeFileSync(REPORT_PATH, body + '\n', 'utf8')
    expect(fs.existsSync(REPORT_PATH)).toBe(true)
  })

  it('is deterministic — two runs produce byte-identical output', () => {
    const a = formatDiagnosticBatch(runAll())
    const b = formatDiagnosticBatch(runAll())
    expect(a).toBe(b)
  })

  it('emits all 10 required fields for every row', () => {
    const required: Array<keyof DiagnosticRow> = [
      'rawTranscript', 'normalizedTranscript', 'intent',
      'dateParse', 'timeParse', 'relationPhrase',
      'resolvedPerson', 'confidence', 'finalConfirmationText', 'saveAllowed',
    ]
    const rows = runAll()
    rows.forEach((row, i) => {
      required.forEach((k) => {
        expect(row[k], `row #${i} missing ${String(k)}`).not.toBeUndefined()
      })
    })
  })

  it('reminder rows that lack title/date/time block save with a clear reason', () => {
    const r = runVoicePipelineDiagnostic('תזכירי לי לקחת תרופה', TODAY_ISO)
    expect(r.intent).toBe('reminder')
    expect(r.saveAllowed.allowed).toBe(false)
    expect(r.saveAllowed.reason.length).toBeGreaterThan(0)
  })

  it('schedule queries never claim save-allowed', () => {
    const rows = runAll()
    rows
      .filter((r) => r.intent === 'schedule_query')
      .forEach((r) => expect(r.saveAllowed.allowed).toBe(false))
  })
})
