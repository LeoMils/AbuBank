/*
 * Spoken Persona Layer
 * ════════════════════
 * The LAST stop before any text reaches TTS. It guarantees Martita hears a warm
 * adult companion — calm, direct, friend-like — never a menu, an "assistant", a
 * caregiver, a robot, or a documentation paragraph.
 *
 *   any answer → shapeVoiceSafe (URLs/markdown/sources out, ≤2 sentences)
 *              → persona rewrites (no "אני כאן" dead-end, no menu, weather/jargon
 *                naturalised, length-capped) → spoken text
 *
 * Pure + deterministic. `toSpokenText` is idempotent.
 */
import { shapeVoiceSafe } from './voiceShaper'
import { BANNED_PHRASES } from './companionComposer'
import { enforceCompanionExperience } from './companionExperience'

const SOFT_CAP = 180 // spoken answers stay short; trim to the first sentence past this.

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
// Strip any menu / assistant / patronizing register that slipped through.
const BANNED_RE = new RegExp(`\\s*[,:]?\\s*(?:${BANNED_PHRASES.map(escapeRe).join('|')})\\s*[,:!.]?\\s*`, 'gi')

/** Convert any answer into warm, natural, spoken Hebrew. */
export function toSpokenText(text: string): string {
  // Companion-experience pass first: no fabricated life, no Fahrenheit.
  let t = shapeVoiceSafe(enforceCompanionExperience(text ?? ''))
  if (!t) return ''

  // 1. Never a dead-end "אני כאן" — a companion is "פה איתך".
  t = t.replace(/אני\s+כאן\s+איתך/gu, 'אני פה איתך')
       .replace(/(?<![א-ת])אני\s+כאן(?![֐-׿])/gu, 'אני פה איתך')

  // 2. Strip menu / assistant / patronizing register.
  t = t.replace(BANNED_RE, ' ')

  // 3. Naturalise weather/forecast jargon for the ear.
  t = t.replace(/ה?טמפרטורה\s+ה?מינימלית\s+תהיה\s*/gu, 'יהיה בערך ')
       .replace(/ה?טמפרטורה\s+ה?מקסימלית\s+תהיה\s*/gu, 'עד ')
       .replace(/\s*מעלות\s+צלזיוס/gu, ' מעלות')
       .replace(/\bלהלן\b\s*/gu, '')

  // 4. Soften a blunt "לא הבנתי" opening into a warm one.
  t = t.replace(/^לא\s+הבנתי\s*[—\-,.]?\s*/u, 'רגע, ')

  // 5. tidy whitespace, collapse doubled punctuation (".." → "."), fix stray
  //    leading punctuation the strips may have left.
  t = t.replace(/\s+/g, ' ')
       .replace(/\s+([,.!?])/g, '$1')
       .replace(/\s*([.!?])\s*\1+/g, '$1')   // ".." / ". ." → "."
       .replace(/([.!?]){2,}/g, '$1')
       .replace(/^[\s,;:.!–—-]+/u, '')
       .trim()

  // 6. soft length cap — keep to the first sentence once past the cap.
  if (t.length > SOFT_CAP) {
    const firstEnd = t.search(/[.!?]/)
    if (firstEnd > 0 && firstEnd + 1 <= SOFT_CAP) t = t.slice(0, firstEnd + 1).trim()
    else t = t.slice(0, SOFT_CAP).replace(/\s+\S*$/u, '').trim()
  }

  return t
}
