/*
 * Autonomous QA gauntlet — runs all 30 RC expectations through the
 * production text pipeline AND the expectation matcher. Every test
 * proves that the pipeline output matches the declared expectation.
 *
 * Also runs 120+ mutation variants (filler, reorder, self-correction,
 * noisy elder speech) to catch regressions the clean expectations miss.
 */

import { describe, it, expect } from 'vitest'
import { runVoicePipelineDiagnostic, type DiagnosticRow } from './voicePipelineHarness'
import { compareQaRunToExpectation } from './qaExpectationMatcher'
import { RELEASE_CANDIDATE_EXPECTATIONS } from './releaseCandidateExpectations'
import type { QaRun } from './qaRunTypes'

const TODAY = '2026-05-29' // Friday — same pin as golden tests

/** Convert a DiagnosticRow to a QaRun for the matcher. */
function diagToQaRun(row: DiagnosticRow): QaRun {
  const routeMap: Record<string, string> = {
    appointment: 'appointment_create',
    reminder: 'reminder_create',
    schedule_query: 'calendar_query',
    family_query: 'family_query',
    unknown: 'unknown',
  }
  return {
    id: 'auto', timestamp: new Date().toISOString(), appVersion: 'test',
    rawTranscript: row.rawTranscript,
    normalizedTranscript: row.normalizedTranscript,
    semanticRoute: routeMap[row.intent] ?? row.intent,
    intent: row.intent,
    date: row.dateParse.date,
    time: row.timeParse.time,
    relationPhrase: row.relationPhrase,
    resolvedPersonName: row.resolvedPerson.name,
    resolvedPersonStatus: row.resolvedPerson.status,
    finalTitle: null, confirmationText: row.finalConfirmationText,
    saveAllowed: row.saveAllowed.allowed,
    saveBlockReason: row.saveAllowed.reason === 'ok' ? null : row.saveAllowed.reason,
    cardState: null, cardTitle: null, cardMainText: null, cardSecondaryText: null, cardActions: null,
    audioDurationMs: null, blobSize: null, chunksCount: null, mimeType: null,
    stopReason: null, sttStatus: null, transcriptLength: row.normalizedTranscript.length,
    normalizedLength: row.normalizedTranscript.length,
    noSpeechProb: null, avgLogprob: null, compressionRatio: null, errorStep: null,
  }
}

// ── Phase 6a: All 30 RC expectations through matcher ────────────────────
describe('autonomous gauntlet — 30 RC expectations via matcher', () => {
  for (const exp of RELEASE_CANDIDATE_EXPECTATIONS) {
    it(`${exp.id}: "${exp.utterance.slice(0, 40)}..." → ${exp.expectedRoute}`, () => {
      const row = runVoicePipelineDiagnostic(exp.utterance, TODAY)
      const run = diagToQaRun(row)
      const result = compareQaRunToExpectation(run, exp)
      if (!result.pass) {
        // Show diagnostic on failure
        console.error(`FAIL ${exp.id}: ${result.explanation}`)
        console.error(`  actual route=${run.semanticRoute} time=${run.time} save=${run.saveAllowed}`)
        console.error(`  person=${run.resolvedPersonName} status=${run.resolvedPersonStatus}`)
      }
      expect(result.pass, `${exp.id}: ${result.explanation}`).toBe(true)
    })
  }
})

// ── Phase 6b: Mutation variants ─────────────────────────────────────────
// These test robustness — the same intent expressed with filler, reorder,
// repetition, self-correction, and noisy elder speech patterns.

interface MutationCase {
  label: string
  text: string
  expectIntent: string
  /** If set, assert this exact time. */
  expectTime?: string
  /** If set, assert save gate. */
  expectSave?: boolean
}

const MUTATIONS: MutationCase[] = [
  // ── Filler words ──────────────────────────────────────────────────
  { label: 'filler: אממ before command', text: 'אממ תקבעי לי פגישה מחר בעשר בבוקר', expectIntent: 'appointment', expectTime: '10:00' },
  { label: 'filler: אני רוצה ש prefix', text: 'אני רוצה שתקבעי לי פגישה מחר בעשר', expectIntent: 'appointment', expectTime: '10:00' },
  { label: 'filler: בבקשה suffix', text: 'תזכירי לי בעוד חמש דקות לקחת כדור בבקשה', expectIntent: 'reminder' },
  { label: 'filler: אה between words', text: 'מחר אה בעשר אה רופא', expectIntent: 'appointment' },

  // ── Word order changes ────────────────────────────────────────────
  { label: 'reorder: time before date', text: 'בעשר בבוקר מחר יש לי רופא', expectIntent: 'appointment', expectTime: '10:00' },
  { label: 'reorder: person first', text: 'עם גלעד מחר בתשע בערב פגישה', expectIntent: 'appointment', expectTime: '21:00' },
  { label: 'reorder: reminder verb at end', text: 'לקחת כדור בעוד חמש דקות תזכירי לי', expectIntent: 'reminder' },

  // ── Self-corrections ──────────────────────────────────────────────
  { label: 'self-correct: time correction', text: 'מחר בתשע לא בעשר פגישה', expectIntent: 'appointment' },
  { label: 'self-correct: person correction', text: 'פגישה עם גלעד לא עם אופיר מחר בעשר', expectIntent: 'appointment' },
  { label: 'self-correct: סליחה date', text: 'היום סליחה מחר בעשר רופא', expectIntent: 'appointment' },

  // ── Family variants ───────────────────────────────────────────────
  { label: 'family: בעלה של אופיר', text: 'פגישה עם בעלה של אופיר מחר בעשר', expectIntent: 'appointment', expectTime: '10:00' },
  { label: 'family: בן הזוג של אופיר', text: 'פגישה עם בן הזוג של אופיר מחר בעשר בבוקר', expectIntent: 'appointment' },
  { label: 'family: אשתו של עילי', text: 'פגישה עם אשתו של עילי מחר בעשר', expectIntent: 'appointment' },
  { label: 'family: הנכד של מור', text: 'פגישה עם הנכד של מור מחר בעשר', expectIntent: 'appointment' },
  { label: 'family: סבתא של ארי', text: 'פגישה עם סבתא של ארי מחר בעשר', expectIntent: 'appointment' },
  { label: 'family: סבא של אנאבל', text: 'פגישה עם סבא של אנאבל מחר בעשר', expectIntent: 'appointment' },

  // ── Missing time ──────────────────────────────────────────────────
  { label: 'missing time: just date', text: 'מחר פגישה עם גלעד', expectIntent: 'appointment', expectSave: false },
  { label: 'missing time: just person', text: 'פגישה עם אופיר', expectIntent: 'appointment', expectSave: false },
  { label: 'missing time: reminder no when', text: 'תזכירי לי לשתות מים', expectIntent: 'reminder', expectSave: false },

  // ── Ambiguous time ────────────────────────────────────────────────
  { label: 'ambiguous: בשלוש alone', text: 'מחר בשלוש פגישה', expectIntent: 'appointment', expectSave: false },
  { label: 'ambiguous: באחת alone', text: 'מחר באחת פגישה', expectIntent: 'appointment', expectSave: false },
  { label: 'unambiguous: בשבע (>=7 morning)', text: 'מחר בשבע פגישה', expectIntent: 'appointment', expectTime: '07:00', expectSave: true },

  // ── Midnight variants ─────────────────────────────────────────────
  { label: 'midnight: חצות bare (no date/verb → unknown)', text: 'חצות פגישה', expectIntent: 'unknown', expectTime: '00:00' },
  { label: 'midnight: 12 בלילה', text: 'מחר בשעה 12 בלילה פגישה', expectIntent: 'appointment', expectTime: '00:00' },
  { label: 'midnight: שתים עשרה בלילה', text: 'מחר שתים עשרה בלילה פגישה', expectIntent: 'appointment', expectTime: '00:00' },
  { label: 'midnight fraction: חצות ורבע', text: 'מחר חצות ורבע פגישה', expectIntent: 'appointment', expectTime: '00:15' },

  // ── Relative time variants ────────────────────────────────────────
  { label: 'relative: בעוד 5 דקות', text: 'תזכירי לי בעוד 5 דקות לקחת כדור', expectIntent: 'reminder' },
  { label: 'relative: בעוד שעתיים', text: 'תזכירי לי בעוד שעתיים לבדוק', expectIntent: 'reminder' },
  { label: 'relative: עוד חצי שעה', text: 'תזכירי לי עוד חצי שעה לשתות', expectIntent: 'reminder' },
  { label: 'relative: בעוד שעה ו10 דקות', text: 'תזכירי לי בעוד שעה ו10 דקות להתקשר', expectIntent: 'reminder' },
  { label: 'relative: בעוד שעה וחמש דקות', text: 'תזכירי לי בעוד שעה וחמש דקות', expectIntent: 'reminder' },

  // ── Query variants ────────────────────────────────────────────────
  { label: 'query: מה יש לי היום', text: 'מה יש לי היום', expectIntent: 'schedule_query', expectSave: false },
  { label: 'query: מה קורה לי מחר', text: 'מה קורה לי מחר', expectIntent: 'schedule_query', expectSave: false },
  { label: 'query: מתי יש לי רופא', text: 'מתי יש לי רופא', expectIntent: 'schedule_query', expectSave: false },
  { label: 'family query: מי הילדים של מור', text: 'מי הילדים של מור', expectIntent: 'family_query', expectSave: false },
  { label: 'family query: מי האחות של ארי', text: 'מי האחות של ארי', expectIntent: 'family_query', expectSave: false },

  // ── Cancel/confirm outside flow ───────────────────────────────────
  { label: 'bare: כן alone', text: 'כן', expectIntent: 'unknown', expectSave: false },
  { label: 'bare: לא alone', text: 'לא', expectIntent: 'unknown', expectSave: false },
  { label: 'bare: ביטול alone', text: 'ביטול', expectIntent: 'unknown', expectSave: false },
  { label: 'bare: שלום alone', text: 'שלום', expectIntent: 'unknown', expectSave: false },

  // ── Noisy elder speech (stutters, repeats) ────────────────────────
  { label: 'stutter: מחר מחר בעשר', text: 'מחר מחר בעשר רופא', expectIntent: 'appointment', expectTime: '10:00' },
  { label: 'repeat: בשעה 10:32 בשעה 10:32', text: 'בשעה 10:32 בשעה 10:32 רופא מחר', expectIntent: 'appointment', expectTime: '10:32' },
  { label: 'noisy: trailing dots', text: 'מחר בעשר רופא...', expectIntent: 'appointment', expectTime: '10:00' },

  // ── Reminder vs appointment ambiguity ─────────────────────────────
  { label: 'ambig: תזכירי + פגישה עם = appointment', text: 'תזכירי לי שיש לי פגישה עם גלעד מחר', expectIntent: 'appointment' },
  { label: 'ambig: יש לי תור = appointment', text: 'יש לי תור לדנטיסט מחר בעשר', expectIntent: 'appointment', expectTime: '10:00' },
  { label: 'ambig: bare כדור = reminder', text: 'תזכירי לי לקחת כדור בעוד שעה', expectIntent: 'reminder' },

  // ── Quarter-to variants ───────────────────────────────────────────
  { label: 'quarter: רבע לעשר בערב', text: 'מחר רבע לעשר בערב פגישה', expectIntent: 'appointment', expectTime: '21:45' },
  { label: 'quarter: רבע לשבע (no PM hint → 06:45 ambiguous)', text: 'מחר רבע לשבע פגישה', expectIntent: 'appointment', expectTime: '06:45' },

  // ── Recurring ─────────────────────────────────────────────────────
  { label: 'recurring: כל ערב', text: 'כל ערב בשמונה לקחת תרופה', expectIntent: 'reminder' },
  { label: 'recurring: כל בוקר', text: 'כל בוקר בתשע לקחת ויטמין', expectIntent: 'reminder' },

  // ── Location ──────────────────────────────────────────────────────
  { label: 'location: ברחוב הרצל', text: 'מחר בעשר פגישה ברחוב הרצל 22 בהרצליה', expectIntent: 'appointment', expectTime: '10:00' },
  { label: 'location: בכפר סבא', text: 'יש לי תור מחר בעשר בכפר סבא', expectIntent: 'appointment', expectTime: '10:00' },
]

describe('autonomous gauntlet — mutation variants', () => {
  for (const m of MUTATIONS) {
    it(`${m.label}: "${m.text.slice(0, 35)}..."`, () => {
      const row = runVoicePipelineDiagnostic(m.text, TODAY)
      expect(row.intent).toBe(m.expectIntent)
      if (m.expectTime !== undefined) {
        expect(row.timeParse.time).toBe(m.expectTime)
      }
      if (m.expectSave !== undefined) {
        expect(row.saveAllowed.allowed).toBe(m.expectSave)
      }
    })
  }
})
