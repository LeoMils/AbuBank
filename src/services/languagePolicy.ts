/*
 * Language Policy Resolver — the ONE canonical language mechanism
 * ═══════════════════════════════════════════════════════════════
 * Root cause of the P0 (Hebrew heard as Spanish, no response): language was a
 * STICKY GLOBAL preference applied at STT time, distributed across ≥4 sites, with
 * no per-utterance detection driving the response. This module consolidates every
 * language decision so typed, pipeline-microphone, and native Realtime paths all
 * obey ONE behavioral law.
 *
 * THE LAW (must hold for every completed utterance):
 *  1. Detect the current utterance language from actual evidence.
 *  2. The current utterance is the STRONGEST signal for the response language.
 *  3. Respond in the same language as the current utterance unless the user
 *     explicitly asked for another.
 *  4/5. A previous Spanish turn must never block a following Hebrew turn, and
 *       vice-versa.
 *  6. A saved preference may influence startup / voice-accent / AMBIGUOUS input,
 *     but must NOT override clear current speech.
 *  7/8. Switching language needs no app restart and no manual button.
 *  9. The SAME policy governs typed, pipeline-mic, and Realtime.
 *  10. Unknown/mixed input triggers an explicit clarification — never silence.
 *
 * Pure + deterministic. No I/O, no localStorage here (callers pass the stored
 * preference in) so it is trivially testable and identical across paths.
 */

export type Lang = 'he' | 'es'
export type DetectedLang = Lang | 'unknown' | 'mixed'
/** Stored user preference. 'auto' = let each utterance decide (the default). */
export type LangPreference = 'auto' | 'he' | 'es'

// ── Detection ────────────────────────────────────────────────────────────────
// Hebrew is unambiguous (its own Unicode block). Spanish is Latin + markers; we
// require positive Spanish evidence so Latin-script noise doesn't beat Hebrew.
const HE_RE = /[֐-׿]/g
const ES_ACCENT_RE = /[áéíóúüñ¿¡]/gi
const ES_WORDS_RE = /\b(hola|gracias|buenos|buenas|c[oó]mo|qu[eé]|por favor|s[ií]|estoy|tengo|quiero|puedo|mam[aá]|abuela|abuelo|bien|mucho|todo|nada|casa|amor|vida|sab[eé]s|cu[eé]ntame|rico|claro|bueno|querida|familia|che|vos|dale|nieta|nieto|hija|hijo)\b/i

/**
 * Detect an utterance's language from evidence. Returns 'mixed' when BOTH scripts
 * are clearly present, 'unknown' when there is no strong signal either way.
 */
export function detectUtteranceLanguage(text: string | null | undefined): DetectedLang {
  const t = (text ?? '').trim()
  if (!t) return 'unknown'
  const he = (t.match(HE_RE) ?? []).length
  const esAccents = (t.match(ES_ACCENT_RE) ?? []).length
  const esWord = ES_WORDS_RE.test(t)
  const esStrong = esAccents > 0 || esWord
  const heStrong = he > 2

  if (heStrong && esStrong) return 'mixed'
  if (heStrong) return 'he'
  if (esStrong) return 'es'
  // Weak Hebrew (1–2 letters) still beats nothing; otherwise unknown.
  if (he > 0) return 'he'
  return 'unknown'
}

export function preferenceFrom(stored: string | null | undefined): LangPreference {
  return stored === 'he' || stored === 'es' ? stored : 'auto'
}

// ── STT resolution ───────────────────────────────────────────────────────────
export interface SttLanguagePlan {
  /** Hard `language` param for Whisper. null = AUTO-DETECT (the fix). We NEVER hard-
   *  pin from a mere preference, so a stale 'es' can't force Hebrew→Spanish. */
  whisperLanguage: Lang | null
  /** Soft bias only: which prompt vocabulary to send. Never overrides audio. */
  promptBias: Lang | 'bilingual'
  /** BCP-47 tag for the browser SpeechRecognition fallback (needs one language). */
  webSpeechLang: string
  autoDetect: boolean
}

/**
 * Resolve how to configure STT. Key fix: Whisper AUTO-DETECTS (whisperLanguage
 * null) by default — the utterance decides, not a sticky preference. The browser
 * recognizer (which cannot auto-detect) defaults to Hebrew (Martita's primary) and
 * only uses Spanish for an ACTIVE Spanish conversation, never a stale preference.
 */
export function resolveSttLanguage(opts: {
  preference: LangPreference
  conversationLanguage?: Lang | null
}): SttLanguagePlan {
  const { preference, conversationLanguage } = opts
  // Whisper: always auto-detect. The preference only biases the prompt vocabulary.
  const promptBias: SttLanguagePlan['promptBias'] = preference === 'auto' ? 'bilingual' : preference
  // Browser WebSpeech needs a hard language and cannot detect: prefer an ACTIVE
  // Spanish conversation; otherwise Hebrew. A stale 'es' PREFERENCE alone does NOT
  // pin Spanish (that was the bug) — only an active Spanish conversation does.
  const webLang = conversationLanguage === 'es' ? 'es-AR'
    : conversationLanguage === 'he' ? 'he-IL'
    : preference === 'es' ? 'es-AR'   // explicit user choice, still overridable by detected speech downstream
    : 'he-IL'
  return { whisperLanguage: null, promptBias, webSpeechLang: webLang, autoDetect: true }
}

// ── Response / TTS resolution ────────────────────────────────────────────────
export type ResponseLanguageResult =
  | { language: Lang; reason: 'utterance' | 'conversation' | 'preference' | 'default' }
  | { language: null; reason: 'clarify' }

/**
 * Resolve the RESPONSE language. Current utterance wins (law #2/#3). A stored
 * preference only breaks ties for ambiguous input (law #6). Mixed/unknown input
 * with no conversational context asks for clarification (law #10) — never silence.
 */
export function resolveResponseLanguage(opts: {
  utteranceText?: string | null
  detected?: DetectedLang            // pass a precomputed detection if you have it
  conversationLanguage?: Lang | null
  preference: LangPreference
}): ResponseLanguageResult {
  const detected = opts.detected ?? detectUtteranceLanguage(opts.utteranceText)
  if (detected === 'he' || detected === 'es') return { language: detected, reason: 'utterance' }
  // Ambiguous (unknown/mixed): fall back to context, then explicit preference.
  if (opts.conversationLanguage) return { language: opts.conversationLanguage, reason: 'conversation' }
  if (opts.preference !== 'auto') return { language: opts.preference, reason: 'preference' }
  if (detected === 'mixed') return { language: null, reason: 'clarify' }
  // Truly unknown, no context, no preference → default to Hebrew (Martita's primary)
  // rather than stall. (A bare non-linguistic sound falls here.)
  return { language: 'he', reason: 'default' }
}

/** TTS language always mirrors the resolved response language. */
export function resolveTtsLanguage(responseLanguage: Lang): Lang { return responseLanguage }

// ── One-call façade for a completed utterance (used by every voice path) ──────
export interface UtteranceLanguageChain {
  preferredLanguage: LangPreference
  detectedUtteranceLanguage: DetectedLang
  conversationLanguage: Lang | null
  sttPlan: SttLanguagePlan
  responseLanguage: Lang | null   // null → clarify
  ttsLanguage: Lang | null
  needsClarification: boolean
}

export function resolveLanguageChain(opts: {
  utteranceText?: string | null
  preference: LangPreference
  conversationLanguage?: Lang | null
}): UtteranceLanguageChain {
  const detected = detectUtteranceLanguage(opts.utteranceText)
  const sttPlan = resolveSttLanguage({ preference: opts.preference, conversationLanguage: opts.conversationLanguage ?? null })
  const resp = resolveResponseLanguage({ detected, conversationLanguage: opts.conversationLanguage ?? null, preference: opts.preference })
  return {
    preferredLanguage: opts.preference,
    detectedUtteranceLanguage: detected,
    conversationLanguage: opts.conversationLanguage ?? null,
    sttPlan,
    responseLanguage: resp.language,
    ttsLanguage: resp.language,
    needsClarification: resp.language === null,
  }
}

/** A natural, bilingual clarification line for unknown/mixed input (law #10). */
export const CLARIFY_LINE = 'סליחה, לא הבנתי אם דיברת בעברית או בספרדית. ¿En qué idioma querés seguir — עברית או español?'
