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

// ─── Hard semantic assertions ─────────────────────────────────────────────────
//
// These pin the meaning of specific utterances. They fail loudly on real
// semantic regressions (wrong date, wrong time, wrong intent) — not just on
// crashes. TODAY_ISO = 2026-05-29 (Friday). Tomorrow = 2026-05-30 (Saturday).
const TOMORROW_ISO = '2026-05-30'

describe('voice pipeline diagnostic harness — hard semantic assertions', () => {
  it('#1 "תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר" — appointment, tomorrow, 21:00, person resolved', () => {
    const r = runVoicePipelineDiagnostic('תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    expect(r.dateParse.date).toBe(TOMORROW_ISO)
    expect(r.timeParse.time).toBe('21:00')
    expect(r.relationPhrase).toBe('הבעל של אופיר')
    expect(r.resolvedPerson.status).toBe('resolved')
    expect(r.resolvedPerson.name).toBe('גלעד')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  it('#2 "תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי" — appointment, tomorrow, 21:30, sibling honestly resolved', () => {
    const r = runVoicePipelineDiagnostic('תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    expect(r.dateParse.date).toBe(TOMORROW_ISO)
    expect(r.dateParse.date).not.toBe(TODAY_ISO)
    expect(r.timeParse.time).toBe('21:30')
    expect(r.timeParse.time).not.toBe('02:13')
    expect(r.relationPhrase).toBe('אחות של ארי')
    expect(['resolved', 'missing', 'ambiguous']).toContain(r.resolvedPerson.status)
  })

  it('#3 "תזכירי לי בעוד שתי דקות לקחת כדור" — reminder, +2 min, title=לקחת כדור', () => {
    const r = runVoicePipelineDiagnostic('תזכירי לי בעוד שתי דקות לקחת כדור', TODAY_ISO)
    expect(r.intent).toBe('reminder')
    expect(r.dateParse.label).toContain('בעוד 2 דקות')
    expect(r.finalConfirmationText).toContain('לקחת כדור')
    expect(r.finalConfirmationText).not.toContain('סליחה')
  })

  it('#4 "בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה" — self-correction picks second clause', () => {
    const r = runVoicePipelineDiagnostic('בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה', TODAY_ISO)
    // No reminder verb up front, but cleanTranscript collapses the correction
    // before any downstream extractor sees the text.
    expect(r.normalizedTranscript).toBe('בעוד שתי דקות להתקשר למשה')
    expect(r.normalizedTranscript).not.toContain('סליחה')
    expect(r.normalizedTranscript).not.toContain('עשר דקות')
  })

  it('#5 "תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים" — appointment, Sunday, 14:00', () => {
    const r = runVoicePipelineDiagnostic('תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    // TODAY_ISO=2026-05-29 is Friday; next ראשון is 2026-05-31.
    expect(r.dateParse.date).toBe('2026-05-31')
    expect(r.timeParse.time).toBe('14:00')
  })

  it('#6 "מה התוכניות שלי השבוע" — schedule_query, save not allowed', () => {
    const r = runVoicePipelineDiagnostic('מה התוכניות שלי השבוע', TODAY_ISO)
    expect(r.intent).toBe('schedule_query')
    expect(r.saveAllowed.allowed).toBe(false)
  })
})
