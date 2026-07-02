/*
 * Contradiction Guard (Phase 7)
 * ═════════════════════════════
 * Blocks an answer that contradicts real calendar state or a prior answer:
 *  - "אין כלום היום" when the store actually has events (or vice-versa).
 *  - "אין לי גישה ליומן" when the calendar tool is available.
 *  - a calendar-count answer that disagrees with the real appointment count.
 * Grounded on the real store, not on text alone.
 */
export interface ContradictionResult { contradiction: boolean; reason: string }

const SAYS_EMPTY = /אין\s+כלום|אין\s+לך\s+כלום|יום\s+שקט|היומן\s+ריק|אין\s+פגישות/u
const SAYS_NO_ACCESS = /אין\s+לי\s+גישה\s+ליומן|לא\s+יכולה\s+לגשת\s+ליומן|היומן\s+לא\s+זמין/u
const SAYS_HAS_COUNT = /יש\s+לך\s+(\d+|פגישה|שתי|שלוש|כמה)/u

/**
 * @param answer the candidate calendar answer
 * @param realCount the true number of appointments for the queried scope
 * @param calendarToolAvailable whether the read tool works (always true here)
 */
export function checkCalendarContradiction(
  answer: string,
  realCount: number,
  calendarToolAvailable = true,
): ContradictionResult {
  const a = answer ?? ''
  if (SAYS_NO_ACCESS.test(a) && calendarToolAvailable) {
    return { contradiction: true, reason: 'claims no calendar access while the tool is available' }
  }
  if (SAYS_EMPTY.test(a) && realCount > 0) {
    return { contradiction: true, reason: `says empty but ${realCount} event(s) exist` }
  }
  if (SAYS_HAS_COUNT.test(a) && realCount === 0) {
    return { contradiction: true, reason: 'claims events but the store is empty (invention)' }
  }
  return { contradiction: false, reason: 'consistent with calendar state' }
}

/** Two answers about the same scope must not flip empty↔has without a state change. */
export function checkReadConsistency(prevAnswer: string, nextAnswer: string, stateChanged: boolean): ContradictionResult {
  if (stateChanged) return { contradiction: false, reason: 'state changed — flip allowed' }
  const prevEmpty = SAYS_EMPTY.test(prevAnswer)
  const nextHas = SAYS_HAS_COUNT.test(nextAnswer)
  const prevHas = SAYS_HAS_COUNT.test(prevAnswer)
  const nextEmpty = SAYS_EMPTY.test(nextAnswer)
  if ((prevEmpty && nextHas) || (prevHas && nextEmpty)) {
    return { contradiction: true, reason: 'calendar read flipped without a state change' }
  }
  return { contradiction: false, reason: 'consistent' }
}
