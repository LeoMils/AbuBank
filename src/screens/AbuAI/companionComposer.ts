/*
 * Companion Response Composer — the layer that stands between grounded facts
 * and Martita. No raw tool answer and no "assistant" register may reach her.
 *
 * `enforceCompanion` is a runtime GUARD applied to every outgoing response
 * (including LLM paraphrases): it strips the banned customer-support / database
 * / AI-self-reference register (Identity Spec §5 + RC6 hard bans) and tidies the
 * result. If a response was nothing but banned filler, it falls back to a plan-
 * appropriate companion line rather than sending emptiness.
 *
 * Pure, deterministic, no LLM. The model writes; this guarantees the floor.
 */
import type { CompanionPlan } from './companionPlanner'

/** Hard-banned phrases (HE + EN). Matched case-insensitively as substrings. */
export const BANNED_PHRASES: string[] = [
  // database / search register
  'על פי הנתונים', 'לפי הנתונים', 'לפי המידע', 'על סמך המידע',
  'מצאתי עבורך', 'מצאתי עבורך ש', 'חיפשתי עבורך', 'חיפשתי באינטרנט', 'על פי החיפוש',
  // customer-support / menu register
  'אשמח לעזור', 'איך אפשר לעזור', 'איך אוכל לעזור', 'איך אני יכולה לעזור', 'במה אני יכולה לעזור',
  'כיצד אוכל לסייע', 'במה אוכל לסייע', 'איך אפשר לסייע', 'אני כאן לשירותך', 'לשירותך',
  'יש עוד משהו שאוכל', 'האם תרצי שאסייע', 'בחרי אחת מהאפשרויות', 'תפריט האפשרויות', 'הנה כמה אפשרויות',
  'אני כאן אם תצטרכי', 'אני כאן כדי לעזור', 'בכל שאלה אני כאן',
  // greeting-menu / feature-list register (the robotic opening Leo flagged)
  'אפשר לדבר איתי', 'אפשר לבקש שאקבע', 'לבקש שאקבע לך', 'או לבקש שאקבע',
  'אפשר לשאול משהו', 'לשאול משהו, או', ', לשאול משהו',
  // dead-bot self-state + generic support-menu (real device failures Leo flagged)
  'אני בסדר', 'רוצה לדבר על משהו אחר',
  // patronizing
  'שאלה מצוינת', 'שאלה טובה', 'יופי של שאלה', 'כל הכבוד', 'איזה יופי ששאלת',
  // AI self-reference
  'אני בינה מלאכותית', 'כבינה מלאכותית', 'אני עוזרת וירטואלית', 'אני עוזרת חכמה', 'אני רק עוזרת',
  'אני עוזרת דיגיטלית', 'אני מודל שפה', 'אני תוכנה', 'אני רובוט',
  // English equivalents
  'as an ai', 'i am an ai', "i'm an ai", 'how can i help', 'how may i help',
  'great question', 'good question', 'happy to help', "i'd be happy to help",
  'according to the data', 'based on the information', 'based on the data',
]

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// One regex that also eats an adjacent comma/colon and surrounding spaces so
// "על פי הנתונים, יש לך רופא" → "יש לך רופא".
const BANNED_RE = new RegExp(
  `\\s*[,:]?\\s*(?:${BANNED_PHRASES.map(escapeRe).join('|')})\\s*[,:!.]?\\s*`,
  'gi',
)

/** Returns the first banned phrase present, or null. */
export function findBannedPhrase(text: string): string | null {
  const low = (text ?? '').toLowerCase()
  for (const p of BANNED_PHRASES) if (low.includes(p.toLowerCase())) return p
  return null
}

function planFallback(plan: CompanionPlan): string {
  switch (plan.step7_act) {
    case 'listen': return 'אני פה איתך.'
    case 'lead': return 'בא לך שנדבר על משהו?'
    case 'encourage': return 'איזה כיף לשמוע.'
    case 'ask': return 'תגידי לי עוד קצת?'
    // Warm and present, a companion — never "אני כאן" (menu/dead-end register).
    default: return 'אני פה איתך.'
  }
}

// A bare, object-less "אין לי מידע" / "אין מידע" / "אין לי מושג" is the cold
// database register Leo flagged. We rewrite the WHOLE message (only when that's
// ALL it is) into a warm, human line. Specific honest negations that name what's
// missing ("אין לי את שנת הלידה של נועם") are NOT matched — they stay untouched.
const GENERIC_NOINFO_RE = /^(?:אין לי (?:מידע|נתונים|אינפורמציה)|אין מידע|אין לי מושג)\s*[.!?]*$/
const WARM_NOINFO = 'את זה אני לא יודעת, אבל אני פה איתך. תשאלי אותי משהו אחר?'

/**
 * Runtime guard: strip banned register from an outgoing response and tidy it.
 * Never returns a banned phrase; never returns empty (falls back per plan).
 */
export function enforceCompanion(textRaw: string, plan: CompanionPlan): string {
  let t = (textRaw ?? '').trim()
  if (!t) return planFallback(plan)
  if (GENERIC_NOINFO_RE.test(t)) return WARM_NOINFO
  t = t.replace(BANNED_RE, ' ')
  // tidy: collapse whitespace, fix stray leading punctuation, single spaces.
  t = t.replace(/\s+/g, ' ')
       .replace(/^[\s,;:.!–-]+/, '')
       .replace(/\s+([,.!?])/g, '$1')
       .trim()
  if (!t || findBannedPhrase(t)) return planFallback(plan)
  return t
}
