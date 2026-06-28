/*
 * Companion Experience Enforcer
 * ═════════════════════════════
 * The product rule in one place: AbuAI is Martita's warm, familiar companion —
 * never an assistant, a menu, a caregiver, or a person with a fabricated life.
 *
 * Two concerns this module owns (the rest of the tone work lives in
 * companionComposer for text and spokenPersona/toSpokenText for voice, which BOTH
 * call into here):
 *   1. No fabricated lived experience — AbuAI must never invent its own day,
 *      fatigue, meals, visitors, or family events ("קצת עייפה, מור ויעל באו
 *      לבקר"). Warmth and presence ("אני איתך") are fine; a fake life is not.
 *   2. Temperature is Celsius only — strip Fahrenheit that an online source leaks.
 *
 * Pure + deterministic.
 */

// First-person CLAIMS of an external/private life the AI cannot have. Carefully
// scoped so genuine companion presence ("אני איתך", "אני פה") is never touched.
// No Hebrew \b (Hebrew letters are not \w) — match the phrase directly within a
// sentence span.
const FAKE_LIFE_SENTENCE =
  /[^.!?]*(?:קצת\s+עייפה|אני\s+עייפה|התעייפתי|נחתי\s|הלכתי\s+ל|יצאתי\s+ל|הייתי\s+ב|אכלתי|שתיתי\s+קפה|בישלתי|ישנתי|קמתי\s+מוקדם|באו\s+לבקר|באו\s+אליי|היה\s+לי\s+יום|בילינו|טיילתי|נסעתי\s+ל|המשפחה\s+שלי\s+(?:באה|הגיעה|ביקרה))[^.!?]*[.!?]?/gu

/** True if the text contains a fabricated personal-life claim. */
export function hasFabricatedLife(text: string): boolean {
  FAKE_LIFE_SENTENCE.lastIndex = 0
  return FAKE_LIFE_SENTENCE.test(text ?? '')
}

/** Remove fabricated personal-life sentences while keeping the rest of the reply. */
export function stripFabricatedLife(text: string): string {
  if (!text) return text
  const out = text.replace(FAKE_LIFE_SENTENCE, ' ').replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
  return out
}

/** Fahrenheit → drop it; temperature is spoken in Celsius only. */
export function stripFahrenheit(text: string): string {
  if (!text) return text
  return text
    // "30°C (86°F)" / "30 מעלות (86F)" → drop the parenthetical Fahrenheit
    .replace(/\s*[([]\s*-?\d{1,3}\s*°?\s*(?:F|פ[ה']?רנהייט|fahrenheit)\s*[)\]]/gi, '')
    // bare "86°F" / "86 F" / "86 פרנהייט"
    .replace(/\s*-?\d{1,3}\s*°?\s*(?:F\b|פ[ה']?רנהייט|fahrenheit)/gi, '')
    // a now-dangling separator left where the Fahrenheit value was ("32°C / ")
    .replace(/\s*[/|]\s*(?=[,.!?֐-׿]|$)/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Companion-experience pass applied to outbound text (both the text and voice
 * enforcers call this). Strips fabricated life + Fahrenheit. Tone/menu/markdown
 * enforcement remains with companionComposer (text) and spokenPersona (voice).
 */
export function enforceCompanionExperience(text: string): string {
  return stripFahrenheit(stripFabricatedLife(text ?? ''))
}
