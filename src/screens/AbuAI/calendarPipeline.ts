/*
 * Calendar Understanding Pipeline
 * ───────────────────────────────
 * One deterministic path from a raw (often messy, voice-transcribed) utterance
 * to a clean, structured calendar event — BEFORE anything is saved.
 *
 *   RAW_TRANSCRIPT
 *     → cleanTranscript()      Hebrew / STT normalization + filler removal
 *     → isCreateIntent()       intent detection
 *     → parseCreateIntent()    structured extraction (who/when/where/subject/notes)
 *     → scoreConfidence()      0..1 completeness/certainty
 *     → needsClarification     true when a critical field is missing/ambiguous
 *     → (caller) confirmation card → save structured event
 *
 * Rules honoured here:
 *  - Location/subject/notes are OPTIONAL — never invented (the extractor returns
 *    null when nothing was said; this layer never fills them in).
 *  - Notes carry the CLEAN action phrase, not raw STT garbage.
 *  - If a critical field (title, date, time) is missing or the time is
 *    AM/PM-ambiguous, needsClarification is true so the UI asks ONE short
 *    question instead of silently saving a bad event.
 *
 * Pure + deterministic. No LLM, no network. The cleanup + scoring primitives
 * live in calendarCreate.ts (so startCreate shares the exact same path); this
 * module is the named, single-call orchestrator the UI/voice flow can use.
 */
import {
  isCreateIntent,
  parseCreateIntent,
  cleanTranscript,
  scoreConfidence,
  type CreateDraft,
} from './calendarCreate'

export { cleanTranscript, scoreConfidence }

export interface PipelineResult {
  isCreate: boolean
  draft: CreateDraft
  missing: Array<'title' | 'date' | 'time'>
  confidence: number
  needsClarification: boolean
  rawTranscript: string
  cleanedTranscript: string
}

/**
 * Run the full understanding pipeline on a raw utterance. Returns a structured
 * draft annotated with rawTranscript / cleanedTranscript / confidence and a
 * needsClarification flag. Never throws.
 */
export function runCalendarPipeline(raw: string): PipelineResult {
  const rawTranscript = raw ?? ''
  const cleanedTranscript = cleanTranscript(rawTranscript)

  const empty: PipelineResult = {
    isCreate: false,
    draft: { title: null, date: null, time: null, emoji: '📅', rawTranscript, cleanedTranscript, confidence: 0 },
    missing: [],
    confidence: 0,
    needsClarification: false,
    rawTranscript,
    cleanedTranscript,
  }

  if (!isCreateIntent(cleanedTranscript)) return empty

  const parsed = parseCreateIntent(cleanedTranscript)
  if (!parsed) return empty

  const confidence = scoreConfidence(parsed.draft, parsed.missing)
  const draft: CreateDraft = { ...parsed.draft, rawTranscript, cleanedTranscript, confidence }

  return {
    isCreate: true,
    draft,
    missing: parsed.missing,
    confidence,
    needsClarification: parsed.missing.length > 0,
    rawTranscript,
    cleanedTranscript,
  }
}
