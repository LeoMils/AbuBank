/*
 * AbuCalendar P0.6 — voice trace state.
 *
 * After phone QA reported "tap red Stop → nothing", we found that
 * `voiceError` was only rendered inside <VoiceCard>, which itself
 * mounts only when `voiceParsed` is set. Any failure BEFORE the parse
 * step (empty audio, transcription failure, missing Groq key) set
 * `voiceError` to a string that was never displayed.
 *
 * This module owns a normalized, always-visible voice trace shape so
 * the runtime can mark every step of the Record → Stop → Blob →
 * Transcribe → Parse → Create pipeline. The trace renders in a small
 * card directly under the mic button. A "Copy voice diagnostic" button
 * serialises the trace to JSON for operator paste-back.
 *
 * Pure module — no React. The hook `useVoiceTrace` lives in the panel
 * file. No secrets are read or serialised.
 */

export type VoiceStage =
  | 'idle'
  | 'recording'
  | 'stopping'
  | 'processing'
  | 'transcribing'
  | 'parsing'
  | 'creating'
  | 'success'
  | 'error'

/**
 * Canonical semantic route — what the user is trying to do, independent
 * of any UI control-flow state. The voice flow must always set one of
 * these so the QA panel never has to fall back to a UI action name.
 */
export type SemanticRoute =
  | 'appointment_create'
  | 'reminder_create'
  | 'calendar_query'
  | 'family_query'
  | 'correction'
  | 'cancel'
  | 'unknown'

export interface VoiceTrace {
  version: string
  startedAt: string | null
  stopPressedAt: string | null
  recorderStateBeforeStop: string | null
  recorderStateAfterStop: string | null
  onstopFired: boolean
  chunksCount: number | null
  blobSize: number | null
  /** Estimated recording duration in ms (stopPressedAt - startedAt). */
  audioDurationMs: number | null
  mimeType: string | null
  /** STT outcome: 'ok' | 'empty' | 'error' | 'timeout'. */
  sttStatus: 'ok' | 'empty' | 'error' | 'timeout' | null
  /** Why recording stopped. */
  stopReason: 'manual' | 'silence_after_speech' | 'max_duration' | 'min_duration_delay' | 'no_audio' | 'error' | null
  transcribeStarted: string | null
  transcribeFinished: string | null
  transcript: string | null
  transcriptLength: number | null
  // P0.7 — ASR quality metadata + raw/corrected split.
  rawTranscript: string | null
  correctedTranscript: string | null
  asrModel: string | null
  asrFallbackUsed: boolean
  languageHint: string | null
  avgLogprob: number | null
  noSpeechProb: number | null
  compressionRatio: number | null
  correctionsApplied: Array<{ from: string; to: string; reason: string }>

  semanticIntent: string | null
  semanticSource: string | null
  extractionConfidence: number | null
  extractedTitle: string | null
  extractedDate: string | null
  extractedStartTime: string | null
  extractedEndTime: string | null
  extractedLocation: string | null
  extractedPeople: string[]
  extractedNotes: string | null
  missingFields: Array<'title' | 'date' | 'time'>
  clarificationQuestion: string | null
  llmFallbackUsed: boolean
  validationResult: string | null
  semanticRawInput: string | null
  semanticCorrectedInput: string | null
  parseDecision: string | null
  /** Canonical semantic route — never a UI action like "show_confirm_card". */
  semanticRoute: SemanticRoute | null
  /** Final title shown to the user on the confirmation card. */
  finalTitle: string | null
  /** Relation phrase ("הבעל של אופיר") extracted from the utterance. */
  relationPhrase: string | null
  /** Family resolver result for the relation phrase. */
  resolvedPersonStatus: 'resolved' | 'ambiguous' | 'missing' | 'none' | null
  resolvedPersonName: string | null
  /** Whether the confirmation card's primary save button is reachable. */
  saveAllowed: boolean
  saveBlockReason: string | null
  createResult: string | null
  error: string | null
  finalVoiceStage: VoiceStage
  /** Last visible Hebrew status text shown to Martita. Never null after
   *  the first stage transition. */
  visibleMessage: string
  /** Step-by-step breadcrumb list. */
  steps: string[]
}

export function createInitialTrace(version: string): VoiceTrace {
  return {
    version,
    startedAt: null,
    stopPressedAt: null,
    recorderStateBeforeStop: null,
    recorderStateAfterStop: null,
    onstopFired: false,
    chunksCount: null,
    blobSize: null,
    audioDurationMs: null,
    mimeType: null,
    sttStatus: null,
    stopReason: null,
    transcribeStarted: null,
    transcribeFinished: null,
    transcript: null,
    transcriptLength: null,
    rawTranscript: null,
    correctedTranscript: null,
    asrModel: null,
    asrFallbackUsed: false,
    languageHint: null,
    avgLogprob: null,
    noSpeechProb: null,
    compressionRatio: null,
    correctionsApplied: [],
    semanticIntent: null,
    semanticSource: null,
    extractionConfidence: null,
    extractedTitle: null,
    extractedDate: null,
    extractedStartTime: null,
    extractedEndTime: null,
    extractedLocation: null,
    extractedPeople: [],
    extractedNotes: null,
    missingFields: [],
    clarificationQuestion: null,
    llmFallbackUsed: false,
    validationResult: null,
    semanticRawInput: null,
    semanticCorrectedInput: null,
    parseDecision: null,
    semanticRoute: null,
    finalTitle: null,
    relationPhrase: null,
    resolvedPersonStatus: null,
    resolvedPersonName: null,
    saveAllowed: false,
    saveBlockReason: null,
    createResult: null,
    error: null,
    finalVoiceStage: 'idle',
    visibleMessage: '',
    steps: [],
  }
}

export function pushStep(trace: VoiceTrace, step: string): VoiceTrace {
  return { ...trace, steps: [...trace.steps, `${new Date().toISOString()} ${step}`] }
}

/** Human-readable Hebrew message for each stage. Senior-first copy. */
export function stageLabel(stage: VoiceStage): string {
  switch (stage) {
    case 'idle':         return 'מוכנה'
    case 'recording':    return 'מקליטה...'
    case 'stopping':     return 'עוצרת ומעבדת את ההקלטה...'
    case 'processing':   return 'מעבדת את ההקלטה...'
    case 'transcribing': return 'מתמללת את ההקלטה...'
    case 'parsing':      return 'מבינה את ההקלטה...'
    case 'creating':     return 'יוצרת את הפגישה...'
    case 'success':      return 'הפגישה נוצרה.'
    case 'error':        return ''
  }
}

export function serializeTrace(trace: VoiceTrace): string {
  return JSON.stringify(trace, null, 2)
}
