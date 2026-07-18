/*
 * Warm openers — cached, instant, varied voice greetings.
 * ═══════════════════════════════════════════════════════
 * The pipeline greeting (AbuAI getVoiceGreeting) is computed locally (no LLM) so it
 * is INSTANT. Today it is one fixed line per time-of-day. This module holds a small
 * set of warm, human, NON-menu variants per (language, time-of-day) so the opener
 * doesn't sound identical every time — a companion, not a recording.
 *
 * SHIPPED DEFAULT-OFF: it is gated behind `warmOpenersEnabled()` (localStorage
 * 'abu-warm-openers' === '1'), pending Leo's blind listening approval. Default → the
 * existing single line is used, so there is ZERO behavior change until switched on.
 *
 * Rules: warm + short (one sentence), present-tense companion tone, never a menu /
 * option-list / feature pitch, "Martita" always Latin, no emojis. Deterministic pick
 * (index-based) so it is testable and never depends on Math.random.
 */
export type OpenerLang = 'he' | 'es'
export type TimeSlot = 'morning' | 'noon' | 'evening' | 'night'

export const WARM_OPENERS_KEY = 'abu-warm-openers'

/** Default OFF — pending Leo's blind-listening approval. */
export function warmOpenersEnabled(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(WARM_OPENERS_KEY) === '1' }
  catch { return false }
}
export function setWarmOpenersEnabled(on: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (on) localStorage.setItem(WARM_OPENERS_KEY, '1'); else localStorage.removeItem(WARM_OPENERS_KEY)
  } catch { /* storage unavailable — stays default-off */ }
}

export function timeSlotOf(hour: number): TimeSlot {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'noon'
  if (hour < 21) return 'evening'
  return 'night'
}

// Each variant is ONE warm sentence. "Martita" stays Latin. No menu/options.
const OPENERS: Record<OpenerLang, Record<TimeSlot, string[]>> = {
  he: {
    morning: ['בוקר טוב, Martita. אני פה איתך.', 'בוקר טוב, Martita. טוב לשמוע אותך.', 'בוקר טוב, Martita. אני כאן, דברי איתי.'],
    noon: ['צהריים טובים, Martita. אני פה איתך.', 'צהריים טובים, Martita. טוב שבאת.', 'צהריים טובים, Martita. אני כאן בשבילך.'],
    evening: ['ערב טוב, Martita. אני פה איתך.', 'ערב טוב, Martita. טוב לשמוע אותך.', 'ערב טוב, Martita. אני כאן, ספרי לי.'],
    night: ['לילה טוב, Martita. אני פה איתך.', 'לילה טוב, Martita. אני כאן אם בא לך לדבר.', 'לילה טוב, Martita. טוב לשמוע אותך.'],
  },
  es: {
    morning: ['Buen día, Martita. Acá estoy con vos.', 'Buen día, Martita. Qué bueno escucharte.'],
    noon: ['Buenas, Martita. Acá estoy con vos.', 'Buenas tardes, Martita. Contame.'],
    evening: ['Buenas tardes, Martita. Acá estoy con vos.', 'Buenas, Martita. Qué bueno escucharte.'],
    night: ['Buenas noches, Martita. Acá estoy con vos.', 'Buenas noches, Martita. Acá estoy si querés hablar.'],
  },
}

/**
 * A warm instant opener for the language + hour. `index` selects a variant
 * deterministically (caller may rotate it per session); out-of-range wraps.
 */
export function getInstantOpener(lang: OpenerLang, hour: number, index = 0): string {
  const slot = timeSlotOf(hour)
  const variants = OPENERS[lang][slot]
  const i = ((index % variants.length) + variants.length) % variants.length
  return variants[i]!
}

/** All openers (for tests / review). */
export function allOpeners(): string[] {
  return (Object.keys(OPENERS) as OpenerLang[]).flatMap((l) =>
    (Object.keys(OPENERS[l]) as TimeSlot[]).flatMap((s) => OPENERS[l][s]))
}
