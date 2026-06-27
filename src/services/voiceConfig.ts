// ─── Voice Configuration ────────────────────────────────────────────────────
// Single source of truth for HOW AbuAI sounds. The real-device complaint was
// "robotic, old, unpleasant, bad pace." Two causes, both addressed here:
//   1) Voice choice — coral read flat. We standardize on `shimmer`, the warmer,
//      more human OpenAI voice already used by the Realtime path, so the pipeline
//      and Realtime sound like the same person.
//   2) Pace — 0.88 was slow enough to read as "old". We lift to a calm-but-alive
//      0.95 (Hebrew) / 0.97 (Spanish): unhurried for an 80+ listener, not elderly.
// rate/pitch/volume live here so they are tuned in ONE place and asserted by tests.

export type VoiceLang = 'he' | 'es'

export interface VoiceProfile {
  lang: VoiceLang
  /** OpenAI gpt-4o-mini-tts voice id (pipeline TTS). */
  openaiVoice: string
  /** OpenAI Realtime API voice id (native audio path). */
  realtimeVoice: string
  /** Playback rate for OpenAI TTS + Web Speech (1.0 = natural). */
  rate: number
  /** Pitch for Web Speech (1.0 = neutral; no robotic shift). */
  pitch: number
  /** Volume (1.0 = full). */
  volume: number
  /** BCP-47 tag for SpeechSynthesisUtterance. */
  webSpeechLang: string
  /** Ordered preference for picking a warm system voice (best → fallback). */
  webSpeechPrefer: RegExp[]
  /** System voices to avoid (clearly male / robotic). */
  webSpeechAvoid: RegExp
}

// Warm Israeli woman. Native accent target; pace calm but not slow.
// The intended voice character — single source of truth, asserted by tests and
// reflected in the TTS instructions (getTTSInstructions in voice.ts).
export const MARTITA_VOICE_STYLE = {
  character: 'warm, calm, adult, friendly',
  notSlow: true,       // rate 0.95 — unhurried but alive, not "old"
  notElderlyCare: true, // companion register, never a caregiver/clinical tone
  accent: 'native Israeli (he) / Rioplatense (es) — never American',
  rhythm: 'short sentences, brief natural pauses, like a relaxed phone call',
} as const

export const HE_VOICE: VoiceProfile = {
  lang: 'he',
  openaiVoice: 'shimmer',
  realtimeVoice: 'shimmer',
  rate: 0.95,
  pitch: 1.0,
  volume: 1.0,
  webSpeechLang: 'he-IL',
  webSpeechPrefer: [/carmit/i, /google/i, /lihi|yael|female|woman/i],
  webSpeechAvoid: /amit|asaf|male(?!.*fe)/i,
}

// Warm Rioplatense (Buenos Aires) woman.
export const ES_VOICE: VoiceProfile = {
  lang: 'es',
  openaiVoice: 'shimmer',
  realtimeVoice: 'shimmer',
  rate: 0.97,
  pitch: 1.0,
  volume: 1.0,
  webSpeechLang: 'es-AR',
  webSpeechPrefer: [/paulina/i, /google/i, /m[oó]nica|pen[eé]lope|elena|female|woman/i],
  webSpeechAvoid: /jorge|diego|male(?!.*fe)/i,
}

// Last-resort profile when language is unknown — defaults to Hebrew (most input).
export const FALLBACK_VOICE: VoiceProfile = HE_VOICE

export function getVoiceProfile(lang: VoiceLang): VoiceProfile {
  return lang === 'es' ? ES_VOICE : HE_VOICE
}

/**
 * Effective playback rate. A user override (Settings → voice speed) always wins;
 * otherwise the language-tuned default is used. Clamped to a sane, non-robotic
 * range so a bad stored value can't make Martita sound like a chipmunk or a tape
 * running down.
 */
export function getEffectiveRate(lang: VoiceLang, userOverride?: number | null): number {
  const base = getVoiceProfile(lang).rate
  const rate = (userOverride != null && Number.isFinite(userOverride)) ? userOverride : base
  return Math.min(1.15, Math.max(0.8, rate))
}

/** One-line summary of how the voice is configured (for the debug panel/log). */
export function describeVoiceConfig(): string {
  return `voice=${HE_VOICE.openaiVoice} he.rate=${HE_VOICE.rate} es.rate=${ES_VOICE.rate} pitch=${HE_VOICE.pitch}`
}
