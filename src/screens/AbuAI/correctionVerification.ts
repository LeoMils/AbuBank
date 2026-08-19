/*
 * CORRECTION-VERIFICATION (intake-rebuild P7).
 * ════════════════════════════════════════════════════════════════════════════
 * When Martita CORRECTS a factual/online answer ("לא נכון", "טעית", "בעצם זה…"),
 * AbuAI must NOT simply agree — a false "you're right" is worse than a re-check.
 * If the prior turn was an ONLINE answer (conversation focus = 'online'), a factual
 * correction re-triggers the online search on that topic, so the agreement (or the
 * honest "I was wrong") comes from a REAL retrieval, not politeness.
 *
 * Pure + deterministic — the routing decision only; the actual re-search runs
 * through the existing online runtime.
 */

// A correction aimed at the TRUTH of the last answer (not a cancel / "no thanks").
const FACTUAL_CORRECTION = /(?:טעית|את\s+טועה|לא\s+נכון|לא\s+מדויק|זה\s+לא\s+(?:נכון|מדויק|ככה|זה)|בעצם\s+(?:זה|לא|כן)|לא\s+זה\s+ה|טעות|זה\s+שגוי)/u

/** True when the utterance corrects the FACTS of the previous answer. */
export function isFactualCorrection(text: string): boolean {
  return FACTUAL_CORRECTION.test(text.trim())
}

/** A factual correction of a prior ONLINE answer → re-verify (re-search) that topic. */
export function shouldReverifyOnline(
  text: string,
  focus: { kind: 'online' | 'calendar_event'; label: string } | null | undefined,
): { reverify: true; topic: string } | { reverify: false } {
  if (focus?.kind === 'online' && focus.label && isFactualCorrection(text)) {
    return { reverify: true, topic: focus.label }
  }
  return { reverify: false }
}
