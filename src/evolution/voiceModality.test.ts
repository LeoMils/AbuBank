import { describe, it, expect } from 'vitest'
import { buildEnvelope, inputModalityToCoarse, TRACE_SCHEMA_VERSION, type TurnFacts } from './traceEnvelope'

function facts(over: Partial<TurnFacts> = {}): TurnFacts {
  return { ts: 1_700_000_000_000, sessionId: 's', turnId: 't', input: 'מה שלומך',
    intent: 'general', source: 'deterministic', finalAnswer: 'טוב, ואת?', ...over }
}

describe('§7/§9-20 — Evolution trace records the REAL modality + language chain', () => {
  it('a realtime voice turn is coarse "voice", not the old hard-coded "text"', () => {
    const e = buildEnvelope(facts({
      inputModality: 'realtime_voice',
      language: {
        preferredLanguage: 'es', detectedUtteranceLanguage: 'he',
        sttConfiguredLanguage: null, responseLanguage: 'he', ttsLanguage: 'he',
        voicePath: 'realtime_voice', transcriptProduced: true,
      },
    }))
    expect(e.inputModality).toBe('realtime_voice')
    expect(e.modality).toBe('voice')
    // The full chain is preserved: Spanish preference, Hebrew utterance → Hebrew response.
    expect(e.language?.detectedUtteranceLanguage).toBe('he')
    expect(e.language?.preferredLanguage).toBe('es')
    expect(e.language?.responseLanguage).toBe('he')
    expect(e.language?.sttConfiguredLanguage).toBeNull() // auto-detect
    expect(e.schemaVersion).toBe(TRACE_SCHEMA_VERSION)
  })
  it('pipeline microphone maps to voice; typed maps to text', () => {
    expect(inputModalityToCoarse('pipeline_microphone')).toBe('voice')
    expect(inputModalityToCoarse('typed')).toBe('text')
    expect(inputModalityToCoarse(undefined)).toBe('text')
    expect(buildEnvelope(facts({ inputModality: 'pipeline_microphone' })).modality).toBe('voice')
  })
  it('a turn with no modality info still defaults safely to text (backward compatible)', () => {
    expect(buildEnvelope(facts()).modality).toBe('text')
  })
})
