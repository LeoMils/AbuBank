/*
 * Dialogue Manager (Phase 4)
 * ══════════════════════════
 * Prevents dead-end loops: two identical clarifications, repeated apologies, or a
 * repeated generic "אני כאן". When the same failure repeats, it stops guessing and
 * escalates to an honest, specific limitation + one precise question.
 */
export interface DialogueDecision { allow: boolean; replacement: string | null; reason: string }

const CLARIFY_MARKERS = /לא\s+הבנתי|באיזה\s+יום|באיזו\s+שעה|למי\s+את\s+מתכוונת|מה\s+לרשום/u
const APOLOGY = /סליחה|מצטערת/u
const GENERIC_PRESENCE = /^אני\s+(?:כאן|פה)(?:\s+איתך)?\.?$/u

function normalize(s: string): string { return (s ?? '').replace(/\s+/g, ' ').trim() }
// A "stuck"/non-answer line (a loop signal): clarification, apology, generic presence,
// or an honest can't/limitation. A repeat of one of these is a dead-end to break; a
// repeat of a substantive factual answer is fine.
const HONEST_LIMIT = /לא\s+הצלחתי|אין\s+לי|לא\s+יודעת|לא\s+בטוחה|לא\s+מצליחה/u
function isStuckLine(s: string): boolean {
  return CLARIFY_MARKERS.test(s) || APOLOGY.test(s) || GENERIC_PRESENCE.test(s) || HONEST_LIMIT.test(s)
}

/**
 * @param candidate the answer the runtime is about to emit
 * @param recentAssistant the last few assistant messages (most-recent last)
 */
export function guardDialogue(candidate: string, recentAssistant: string[]): DialogueDecision {
  const c = normalize(candidate)
  const last = recentAssistant.map(normalize)
  const prev = last[last.length - 1] ?? ''

  // Exact repeat of the immediately-previous answer → break the loop, but ONLY when
  // the repeated line is a STUCK/non-answer (clarification / apology / filler / honest
  // limitation). A repeated FACTUAL answer is NOT a loop — two different questions can
  // share the same true answer ("מי אמא של אופיר?"→מור, then "מי אמא של אדר?"→מור; two
  // date questions landing on the same day). Suppressing those was a real marathon bug.
  if (prev && c === prev && isStuckLine(c)) {
    return { allow: false, replacement: escalate(c), reason: 'exact repeat of a stuck line' }
  }
  // Two clarifications in a row → stop guessing, escalate.
  if (CLARIFY_MARKERS.test(c) && CLARIFY_MARKERS.test(prev)) {
    return { allow: false, replacement: escalate(c), reason: 'repeated clarification' }
  }
  // Repeated apology.
  if (APOLOGY.test(c) && APOLOGY.test(prev)) {
    return { allow: false, replacement: 'בואי נעשה את זה אחרת — תגידי לי בדיוק מה חשוב לך עכשיו.', reason: 'repeated apology' }
  }
  // Repeated generic presence filler.
  if (GENERIC_PRESENCE.test(c) && last.some(GENERIC_PRESENCE.test.bind(GENERIC_PRESENCE))) {
    return { allow: false, replacement: 'אני מקשיבה. על מה תרצי שנדבר?', reason: 'repeated generic presence' }
  }
  return { allow: true, replacement: null, reason: 'ok' }
}

function escalate(_c: string): string {
  // NEVER a forced menu ("פגישה, יומן, משפחה") — that reads like a phone-tree to an
  // 80-year-old. Break the loop with a warm, open re-prompt in her own words.
  return 'רגע, אני רוצה להבין אותך נכון. תגידי לי שוב במילים שלך — אני מקשיבה.'
}

/** When the user corrects AbuAI, acknowledge the specific correction (never a generic apology). */
export function acknowledgeCorrection(correction: string): string {
  const c = normalize(correction)
  return `הבנתי, תיקנת אותי: "${c}". בואי נתקן.`
}
