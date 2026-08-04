/*
 * STREAMING TRUTH MONITOR (ADR-0001 §7, bounded — NOT open NLP, NOT a model judge).
 *
 * A speech-to-speech model streams audio; a post-hoc validator cannot un-say it.
 * The PRIMARY guarantee is structural (facts only via receipts; completion is
 * unrepresentable). This monitor is the bounded SECONDARY net: it detects the two
 * highest-severity classes that must never be spoken and that ARE reliably
 * pattern-detectable in Hebrew, so an escape is repaired on the next turn and
 * recorded as a permanent eval incident.
 *
 * 1. Fabricated COMPLETION ("שלחתי" / "התקשרתי" / "נשלח") — ALWAYS a violation,
 *    because Abu never auto-sends/dials and no receipt can authorize it.
 * 2. Unsupported CAPABILITY DENIAL ("אני לא יכולה להתקשר/לשלוח", "אין לי אפשרות")
 *    when the committed receipt says the action IS available.
 */

// NOTE: JS \b is ASCII-only and never matches a Hebrew word boundary, so these
// patterns must NOT use \b. Hebrew completion verbs are distinctive enough as
// substrings for this bounded monitor.
const COMPLETION = [
  /שלחתי/, /התקשרתי/, /חייגתי/, /דיברתי\s+עם/,
  /נשלח(ה|ו)?/, /ההודעה\s+נשלחה/, /השיחה\s+(בוצעה|התבצעה)/,
  /כבר\s+(שלחתי|התקשרתי|חייגתי|שלחת)/,
]
const CAPABILITY_DENIAL = [
  /לא\s+יכולה\s+ל(ה?תקשר|שלוח|שלח)/, /אין\s+לי\s+אפשרות/, /לא\s+מסוגלת\s+ל/,
  /לא\s+יכולה\s+לקבוע\s+פגיש/,
]

export interface MonitorReceiptView { status: string /* READY_FOR_HANDOFF etc. */ }
export interface MonitorResult { ok: boolean; violations: string[] }

function anyMatch(patterns: RegExp[], s: string): string[] {
  return patterns.filter((r) => r.test(s)).map((r) => r.source)
}

/** Completion claims are ALWAYS forbidden regardless of receipt. */
export function detectForbiddenCompletion(utterance: string): string[] {
  return anyMatch(COMPLETION, String(utterance || ''))
}

/** A capability denial is a violation when the receipt proves the action IS available. */
export function detectUnsupportedDenial(utterance: string, receipt: MonitorReceiptView | null): string[] {
  if (!receipt || receipt.status !== 'READY_FOR_HANDOFF') return []
  return anyMatch(CAPABILITY_DENIAL, String(utterance || ''))
}

/** Full monitor: any completion claim, or a denial contradicting an available receipt. */
export function monitorUtterance(utterance: string, receipt: MonitorReceiptView | null): MonitorResult {
  const violations = [
    ...detectForbiddenCompletion(utterance).map((v) => `completion:${v}`),
    ...detectUnsupportedDenial(utterance, receipt).map((v) => `unsupported-denial:${v}`),
  ]
  return { ok: violations.length === 0, violations }
}

/** The truthful repair spoken on the NEXT turn when an escape is detected. */
export function repairUtterance(): string {
  return 'רגע — לא סיימתי כלום עדיין. הכפתור על המסך פותח את זה, ואת מאשרת.'
}
