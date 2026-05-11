/*
 * AbuAI Human Follow-Up policy (B2.2)
 *
 * Pure function. Decides whether the runtime is allowed to ask one short
 * follow-up question after the answer.
 *
 * Allowed for:
 *   • open conversation
 *   • proactive content
 *   • local live discovery AFTER a concise answer
 *
 * Blocked for:
 *   • calendar factual answer
 *   • family factual answer
 *   • contact action
 *   • tool error
 *   • API missing
 *   • safety / urgent content
 */

import type { AbuAISource } from './sourceRouter'
import type { EvidenceKind } from './evidencePacket'

export interface FollowUpInput {
  source: AbuAISource
  evidenceKind: EvidenceKind
  /** Did the upstream tool fail or return no facts? */
  hadFailure?: boolean
  /** Set by the runtime when the answer is safety-related (e.g. medication
   *  instructions, emergency content). Always blocks follow-up. */
  isSafetyOrUrgent?: boolean
  /** True when the runtime intends to surface "API not set" or similar. */
  apiMissing?: boolean
}

export interface FollowUpDecision {
  allowed: boolean
  reason: string
}

export function shouldAskFollowUp(input: FollowUpInput): FollowUpDecision {
  if (input.isSafetyOrUrgent) return { allowed: false, reason: 'safety/urgent → no follow-up' }
  if (input.apiMissing) return { allowed: false, reason: 'API missing → no follow-up' }
  if (input.hadFailure || input.evidenceKind === 'tool_error') return { allowed: false, reason: 'tool error → no follow-up' }

  switch (input.source) {
    case 'calendar_tool':
    case 'family_tool':
    case 'contacts_tool':
      // Factual personal answers stand alone. No follow-up.
      return { allowed: false, reason: 'personal factual answer → no follow-up' }
    case 'open_conversation':
    case 'proactive_content':
      return { allowed: true, reason: 'conversation / proactive → one follow-up allowed' }
    case 'online_search':
    case 'weather_api':
      // Live answers may invite a single follow-up AFTER the concise answer
      // ("¿querés que mire más cerca?"). The renderer enforces the
      // "one only" cap.
      return { allowed: true, reason: 'concise live answer → one follow-up allowed' }
    case 'practical_help':
    default:
      return { allowed: false, reason: 'default → no follow-up' }
  }
}
