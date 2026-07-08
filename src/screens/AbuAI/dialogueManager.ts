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

/**
 * @param candidate the answer the runtime is about to emit
 * @param recentAssistant the last few assistant messages (most-recent last)
 */
export function guardDialogue(candidate: string, recentAssistant: string[]): DialogueDecision {
  const c = normalize(candidate)
  const last = recentAssistant.map(normalize)
  const prev = last[last.length - 1] ?? ''

  // Exact repeat of the immediately-previous answer → break the loop.
  if (prev && c === prev) {
    return { allow: false, replacement: escalate(c), reason: 'exact repeat of previous turn' }
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
