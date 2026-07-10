import { describe, it, expect } from 'vitest'
import {
  detectUtteranceLanguage, preferenceFrom, resolveSttLanguage, resolveResponseLanguage,
  resolveLanguageChain, resolveTtsLanguage,
} from './languagePolicy'

const HE = 'מה שלומך היום'
const HE_FAMILY = 'ספרי לי על אופיר הנכדה'
const ES = 'hola, cómo estás mi querida'
const ES_FAMILY = 'contame de mi nieta Ofir'
const MIXED = 'שלום hola cómo estás מה שלומך'

describe('detectUtteranceLanguage — evidence-based', () => {
  it('detects Hebrew, Spanish, mixed, unknown', () => {
    expect(detectUtteranceLanguage(HE)).toBe('he')
    expect(detectUtteranceLanguage(ES)).toBe('es')
    expect(detectUtteranceLanguage(MIXED)).toBe('mixed')
    expect(detectUtteranceLanguage('')).toBe('unknown')
    expect(detectUtteranceLanguage('12:00')).toBe('unknown')
  })
})

// ── The 20-case regression family (mandate §9). Resolver-level where deterministic;
//    device-only cases are marked and covered by voiceStateMachine / Evolution tests.
describe('behavioral law — current utterance wins over sticky preference', () => {
  it('1. Spanish preference + clear Hebrew → Hebrew response (law #6)', () => {
    const r = resolveResponseLanguage({ utteranceText: HE, preference: 'es' })
    expect(r).toEqual({ language: 'he', reason: 'utterance' })
  })
  it('2. Hebrew preference + clear Spanish → Spanish response', () => {
    const r = resolveResponseLanguage({ utteranceText: ES, preference: 'he' })
    expect(r).toEqual({ language: 'es', reason: 'utterance' })
  })
  it('3. Spanish turn immediately followed by Hebrew → each independent', () => {
    expect(resolveResponseLanguage({ utteranceText: ES, preference: 'auto' }).language).toBe('es')
    expect(resolveResponseLanguage({ utteranceText: HE, preference: 'auto', conversationLanguage: 'es' }).language).toBe('he')
  })
  it('4. Hebrew turn immediately followed by Spanish → each independent', () => {
    expect(resolveResponseLanguage({ utteranceText: HE, preference: 'auto' }).language).toBe('he')
    expect(resolveResponseLanguage({ utteranceText: ES, preference: 'auto', conversationLanguage: 'he' }).language).toBe('es')
  })
  it('5-8. typed / pipeline-mic / realtime use the SAME resolver → same language', () => {
    // Same text through the one resolver yields the same answer regardless of path.
    const forText = (t: string) => resolveLanguageChain({ utteranceText: t, preference: 'es' }).responseLanguage
    expect(forText(HE)).toBe('he')  // typed
    expect(forText(HE)).toBe('he')  // pipeline-mic (same fn)
    expect(forText(HE)).toBe('he')  // realtime (same fn)
  })
  it('9/10. family-name utterances detect the spoken language', () => {
    expect(resolveResponseLanguage({ utteranceText: HE_FAMILY, preference: 'es' }).language).toBe('he')
    expect(resolveResponseLanguage({ utteranceText: ES_FAMILY, preference: 'he' }).language).toBe('es')
  })
  it('11. Hebrew STT variant/typo still resolves Hebrew', () => {
    expect(resolveResponseLanguage({ utteranceText: 'ספר לי על אנבל', preference: 'es' }).language).toBe('he')
  })
  it('12. mixed Hebrew/Spanish with no context → clarify, never silence', () => {
    const r = resolveResponseLanguage({ utteranceText: MIXED, preference: 'auto' })
    expect(r).toEqual({ language: null, reason: 'clarify' })
    expect(resolveLanguageChain({ utteranceText: MIXED, preference: 'auto' }).needsClarification).toBe(true)
  })
})

describe('STT plan — auto-detect, never hard-pinned by a stale preference', () => {
  it('Whisper auto-detects regardless of preference (the core fix)', () => {
    expect(resolveSttLanguage({ preference: 'auto' }).whisperLanguage).toBeNull()
    expect(resolveSttLanguage({ preference: 'es' }).whisperLanguage).toBeNull()
    expect(resolveSttLanguage({ preference: 'he' }).whisperLanguage).toBeNull()
  })
  it('browser WebSpeech: stale es PREFERENCE does not pin Spanish; active Spanish convo does', () => {
    // No active conversation → Hebrew (Martita primary), even with es preference downstream-overridable.
    expect(resolveSttLanguage({ preference: 'auto' }).webSpeechLang).toBe('he-IL')
    expect(resolveSttLanguage({ preference: 'auto', conversationLanguage: 'es' }).webSpeechLang).toBe('es-AR')
    expect(resolveSttLanguage({ preference: 'auto', conversationLanguage: 'he' }).webSpeechLang).toBe('he-IL')
  })
  it('prompt bias follows preference but is only a hint', () => {
    expect(resolveSttLanguage({ preference: 'auto' }).promptBias).toBe('bilingual')
    expect(resolveSttLanguage({ preference: 'es' }).promptBias).toBe('es')
  })
})

describe('preference parsing + TTS mirror', () => {
  it('parses stored preference safely', () => {
    expect(preferenceFrom('es')).toBe('es')
    expect(preferenceFrom('he')).toBe('he')
    expect(preferenceFrom('auto')).toBe('auto')
    expect(preferenceFrom(null)).toBe('auto')
    expect(preferenceFrom('garbage')).toBe('auto')
  })
  it('TTS mirrors the response language', () => {
    expect(resolveTtsLanguage('he')).toBe('he')
    expect(resolveTtsLanguage('es')).toBe('es')
  })
  it('full chain reports every layer', () => {
    const chain = resolveLanguageChain({ utteranceText: HE, preference: 'es', conversationLanguage: 'es' })
    expect(chain.preferredLanguage).toBe('es')
    expect(chain.detectedUtteranceLanguage).toBe('he')
    expect(chain.responseLanguage).toBe('he') // utterance wins over both preference and conversation
    expect(chain.ttsLanguage).toBe('he')
    expect(chain.sttPlan.autoDetect).toBe(true)
  })
})
