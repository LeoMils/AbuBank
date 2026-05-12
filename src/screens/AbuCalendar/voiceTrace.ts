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

export interface VoiceTrace {
  version: string
  startedAt: string | null
  stopPressedAt: string | null
  recorderStateBeforeStop: string | null
  recorderStateAfterStop: string | null
  onstopFired: boolean
  chunksCount: number | null
  blobSize: number | null
  mimeType: string | null
  transcribeStarted: string | null
  transcribeFinished: string | null
  transcript: string | null
  transcriptLength: number | null
  parseDecision: string | null
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
    mimeType: null,
    transcribeStarted: null,
    transcribeFinished: null,
    transcript: null,
    transcriptLength: null,
    parseDecision: null,
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
