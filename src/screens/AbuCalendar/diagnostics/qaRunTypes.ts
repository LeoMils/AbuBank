/*
 * QA Run data model — stable shape for recording, comparing, and exporting
 * voice pipeline QA results. Used by the QA recorder panel, the expectation
 * matcher, the failure classifier, and the JSON export.
 *
 * Pure types — no React, no I/O.
 */

export interface QaRun {
  id: string
  timestamp: string
  appVersion: string
  expectedId?: string
  expectedUtterance?: string

  // Transcript
  rawTranscript: string | null
  normalizedTranscript: string | null

  // Semantic
  semanticRoute: string | null
  intent: string | null
  date: string | null
  time: string | null
  relationPhrase: string | null
  resolvedPersonName: string | null
  resolvedPersonStatus: string | null
  finalTitle: string | null
  confirmationText: string | null
  saveAllowed: boolean
  saveBlockReason: string | null

  // Card state
  cardState: string | null
  cardTitle: string | null
  cardMainText: string | null
  cardSecondaryText: string | null
  cardActions: string[] | null

  // Mic diagnostics
  audioDurationMs: number | null
  blobSize: number | null
  chunksCount: number | null
  mimeType: string | null
  stopReason: string | null
  sttStatus: string | null
  transcriptLength: number | null
  normalizedLength: number | null
  noSpeechProb: number | null
  avgLogprob: number | null
  compressionRatio: number | null
  errorStep: string | null

  // QA result (set by operator or matcher)
  comparisonResult?: 'pass' | 'fail' | 'pending'
  failedFields?: string[]
  suspectedLayer?: FailureLayer
  severity?: 'P0' | 'P1' | 'P2'
}

export type FailureLayer =
  | 'MIC_CAPTURE'
  | 'STT'
  | 'NORMALIZATION'
  | 'ROUTING'
  | 'TIME_PARSE'
  | 'FAMILY_RESOLVE'
  | 'CARD_RENDER'
  | 'SAVE_GATE'
  | 'REMINDER_DUE'
  | 'UNKNOWN'

export interface QaExpectation {
  id: string
  utterance: string
  expectedRoute: string
  expectedDatePolicy: string // 'tomorrow' | 'today' | 'next_sunday' | 'any' | 'none'
  expectedTime: string | null // '00:00' | '21:30' | null (any)
  expectedRelationPolicy: string // 'none' | 'present' | specific phrase
  expectedPersonPolicy: string // 'none' | 'resolved:<name>' | 'ambiguous' | 'missing'
  expectedSaveAllowed: boolean | null // null = don't check
  expectedCardPolicy: string // 'confirm' | 'blocked' | 'query_no_card' | 'any'
  criticality: 'P0' | 'P1' | 'P2'
}

export interface ComparisonResult {
  pass: boolean
  failedFields: string[]
  suspectedLayer: FailureLayer
  severity: 'P0' | 'P1' | 'P2'
  explanation: string
}
