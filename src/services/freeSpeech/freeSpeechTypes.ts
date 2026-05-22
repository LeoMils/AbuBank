/**
 * Free Speech Types — AbuBank shared speech intent classification.
 *
 * These types define the output of the first-pass domain router that sits
 * between raw transcription and screen-specific deep parsing. The router
 * is pure (no API calls, no side effects) and deterministic.
 */

/** Broad domain the utterance belongs to. */
export type FreeSpeechDomain =
  | 'calendar'
  | 'abuai'
  | 'whatsapp'
  | 'navigation'
  | 'general'
  | 'unclear'

/** High-level action intent. */
export type FreeSpeechAction =
  | 'create'
  | 'query'
  | 'send_message'
  | 'answer'
  | 'navigate'
  | 'clarify'
  | 'none'

/** Safety classification for downstream handlers. */
export type FreeSpeechSafety =
  | 'read_only'
  | 'requires_confirmation'
  | 'clarify'

/** Confidence in the classification. */
export type FreeSpeechConfidence = 'high' | 'medium' | 'low'

/** Detected language of the utterance. */
export type FreeSpeechLanguage = 'he' | 'es' | 'en' | 'mixed' | 'unknown'

/** Output of the free speech domain router. */
export interface FreeSpeechRoute {
  domain: FreeSpeechDomain
  action: FreeSpeechAction
  confidence: FreeSpeechConfidence
  safety: FreeSpeechSafety
  language: FreeSpeechLanguage
  reasons: string[]
  normalizedText: string
}
