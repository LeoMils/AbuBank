/*
 * Per-user speech profile — ONE source for the spoken pace.
 * ════════════════════════════════════════════════════════
 * Standing law: the benchmark is the latest ChatGPT at NORMAL human speech pace —
 * never slowed by DEFAULT. This module reads the user's saved rate (if any) and
 * otherwise returns the language-tuned NORMAL default (1.0, via getEffectiveRate).
 * The rate changes ONLY by an explicit user action (setSpeechRate, wired to the
 * Settings speed control) — nothing may silently slow Martita down.
 */
import { getEffectiveRate, type VoiceLang } from './voiceConfig'

export const SPEECH_RATE_KEY = 'abu-voice-speed'

/** The effective spoken rate for a language: a saved user override, else NORMAL default. */
export function getSpeechRate(lang: VoiceLang = 'he'): number {
  let override: number | null = null
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(SPEECH_RATE_KEY) : null
    if (saved) override = parseFloat(saved)
  } catch { /* storage unavailable → default */ }
  return getEffectiveRate(lang, override)
}

/** Persist an EXPLICIT user speed choice (the only way the pace changes). Clamped by getEffectiveRate on read. */
export function setSpeechRate(rate: number): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SPEECH_RATE_KEY, String(rate)) }
  catch { /* storage unavailable — keeps the normal default */ }
}

/** True when the user has explicitly chosen a non-default (e.g. slower) pace. */
export function hasExplicitRate(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(SPEECH_RATE_KEY) != null }
  catch { return false }
}
