/*
 * yield-discipline-lib.mjs — PURE yield validity rule. (§9/C9)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A yield while MACHINE_CLOSABLE_REMAINING>0 is valid ONLY with a genuine observable hard boundary.
 * Encodes the rule that was violated once (ce-premature-yield): a worked-around tool error is NOT a
 * boundary, and a context-limit code requires an actual measured context signal — not a quality hedge.
 */
export const VALID_HARD_BOUNDARY_CODES = new Set([
  'HARD_CONTEXT_LIMIT', 'NEAR_HARD_CONTEXT_LIMIT_WITH_MEASURED_SIGNAL', 'TOOL_EXECUTION_HARD_FAILURE',
  'EXTERNAL_PERMISSION_BOUNDARY', 'EXTERNAL_SERVICE_BLOCKER', 'OWNER_AUTHORITY_REQUIRED',
  'UNRECOVERABLE_ENVIRONMENT_LIMITATION',
])
// Phrases that are NOT sufficient evidence (§9).
const INVALID_JUSTIFICATIONS = [/practical context/i, /already-?maximal/i, /rather than degrade/i, /better continued later/i, /large program/i, /shallow stub/i]

/**
 * @param y { reasonCode, machineWorkRemaining, contextStopEvidence, measuredContextSignal, toolErrorWorkedAround }
 * @returns { valid, reasons[] }
 */
export function isYieldValid(y = {}) {
  const reasons = []
  if ((y.machineWorkRemaining ?? 0) <= 0) return { valid: true, reasons: ['no machine work remaining'] }

  if (!VALID_HARD_BOUNDARY_CODES.has(y.reasonCode)) reasons.push(`reasonCode ${y.reasonCode} is not a valid hard-boundary code`)
  if (!y.contextStopEvidence) reasons.push('missing CONTEXT_STOP_EVIDENCE')
  else if (INVALID_JUSTIFICATIONS.some((re) => re.test(y.contextStopEvidence))) reasons.push('CONTEXT_STOP_EVIDENCE relies on an insufficient justification (quality hedge / vague context claim)')

  // A context-limit code MUST carry an actual measured context signal.
  if (/CONTEXT_LIMIT/.test(y.reasonCode ?? '') && !y.measuredContextSignal) reasons.push('context-limit code without a measured context signal')

  // A tool error that was worked around is not a boundary.
  if (y.reasonCode === 'TOOL_EXECUTION_HARD_FAILURE' && y.toolErrorWorkedAround === true) reasons.push('the tool error was worked around — not a hard failure')

  return { valid: reasons.length === 0, reasons }
}
