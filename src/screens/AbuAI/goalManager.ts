/*
 * Goal Manager (Phase 3)
 * ══════════════════════
 * Tracks the conversation's goal state across turns so confirmations resolve the
 * right pending action, repeated "כן" doesn't loop, frustration doesn't reset
 * context, and an audio complaint never cancels anything.
 */
export interface GoalState {
  activeGoal: string | null
  pendingAction: 'save_calendar' | 'save_reminder' | null
  expectedConfirmation: boolean
  missingFields: string[]
  lastQuestionAsked: string | null
  lastCorrection: string | null
  lastAnswer: string | null
  lastTopic: string | null
  lastToolResult: string | null
  frustrationLevel: number
  chunkIndex: number
}

export const IDLE_GOAL: GoalState = {
  activeGoal: null, pendingAction: null, expectedConfirmation: false, missingFields: [],
  lastQuestionAsked: null, lastCorrection: null, lastAnswer: null, lastTopic: null,
  lastToolResult: null, frustrationLevel: 0, chunkIndex: -1,
}

const YES = /^(?:כן(?:\s+כן)*|כן\s+בבקשה|בטח|תקבעי(?:\s+את\s+זה)?|תעשי\s+את\s+זה|קדימה(?:\s+תקבעי)?|אוקיי?|okay|ok|sí|dale)\.?$/iu
const AUDIO = /(?:לא\s+שומעת?\s+אות|אני\s+לא\s+שומע|לא\s+שמעתי|הקול\s+נעלם|אין\s+קול)/u
const CONTINUE = /(?:תמשיכי|תשלימי|תמשיך|עוד|הלאה)/u
const WHY = /^למה\??$/u
const FRUSTRATION = /את\s+לא\s+(?:עונה|מבינה)|לא\s+ענית|זה\s+לא\s+מה\s+ששאלתי/u

/** Does this text resolve the pending action? (repeated yes still resolves once.) */
export function resolvesPending(text: string, state: GoalState): boolean {
  return state.expectedConfirmation && !!state.pendingAction && YES.test(text.trim())
}

export interface GoalSignals {
  isYes: boolean
  isAudioComplaint: boolean
  isContinuation: boolean
  refersToPreviousTurn: boolean
  isFrustration: boolean
}

export function readSignals(text: string): GoalSignals {
  const t = text.trim()
  return {
    isYes: YES.test(t),
    isAudioComplaint: AUDIO.test(t),
    isContinuation: CONTINUE.test(t),
    refersToPreviousTurn: WHY.test(t),
    isFrustration: FRUSTRATION.test(t),
  }
}

/**
 * Advance the goal state for a turn. Audio complaints and frustration NEVER clear
 * the pending action or reset context. A resolved confirmation clears the pending
 * action (so a following "כן" can't loop it).
 */
export function advanceGoal(state: GoalState, text: string): GoalState {
  const s = readSignals(text)
  if (s.isAudioComplaint) return { ...state } // keep everything — audio cancels nothing
  if (s.isFrustration) return { ...state, frustrationLevel: state.frustrationLevel + 1 } // context preserved
  if (resolvesPending(text, state)) {
    return { ...state, pendingAction: null, expectedConfirmation: false, activeGoal: null, missingFields: [] }
  }
  return state
}
