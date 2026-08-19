/*
 * Current-info grounding — regression + replay + acceptance for the real device
 * failure "AbuAI answered a stale historical fact for a current-events question"
 * (the canonical 2022-World-Cup-for-2026 incident, generalised).
 *
 * FIRST DIVERGENCE (root cause): the intent classifier routed a time-sensitive
 * WORLD-FACT question (current office holder / election / championship winner)
 * that the narrow category regexes did not catch to the `general` LLM path, which
 * answers from the offline model's stale memory. The fix makes the whole SEMANTIC
 * class (`requiresCurrentInfo`) route to the online provider — which, on failure,
 * already refuses honestly ("NO TOOL RESULT = NO CLAIM"). It is NEVER answered
 * from memory.
 *
 * This is CODE/TEST evidence (deterministic routing). It does NOT prove the real
 * provider on a device — that stays a PREVIEW/DEVICE gate on the Acceptance Board.
 */
import { describe, it, expect } from 'vitest'
import { orchestrate } from './understandingOrchestrator'
import { requiresCurrentInfo, isOnlineCurrentInfoQuery } from './onlineIntent'

const ctx = { messages: [] as Array<{ role: string; content: string }> }
const intentOf = (t: string) => orchestrate(t, ctx).intent

describe('current-info grounding — volatile world facts route online, never to memory', () => {
  // The real failure family (Leo, iPhone): current events answered from stale memory.
  const MUST_ROUTE_ONLINE = [
    // Hebrew — office holders (change over time)
    'מי ראש הממשלה עכשיו',
    'מי ראש הממשלה',
    'מי הנשיא של ארצות הברית',
    'מי הנשיא של ארה"ב עכשיו',
    // Hebrew — winners / elections
    'מי ניצח בבחירות',
    'מי נבחר לראשות העיר',
    'מי זכה באליפות',
    // Spanish
    'quién es el presidente ahora',
    'quién ganó las elecciones',
    // English
    'who is the president now',
    'who won the election',
  ]

  for (const q of MUST_ROUTE_ONLINE) {
    it(`routes to ONLINE (not general memory): "${q}"`, () => {
      expect(requiresCurrentInfo(q)).toBe(true)
      expect(isOnlineCurrentInfoQuery(q)).toBe(true)
      expect(intentOf(q)).toBe('online')
    })
  }

  // The already-covered sports/World-Cup case must remain online (no regression).
  it('the canonical World Cup question stays online', () => {
    expect(intentOf('מי ניצח במונדיאל')).toBe('online')
  })
})

describe('current-info grounding — NEGATIVE guards (no over-routing / no hijack)', () => {
  // Evergreen facts the offline model CAN answer must stay general (not online).
  const EVERGREEN = ['מה הבירה של צרפת', 'כמה זה שתיים ועוד שתיים', 'מי היה הנשיא הראשון של ארצות הברית']
  for (const q of EVERGREEN) {
    it(`evergreen stays general, not online: "${q}"`, () => {
      expect(requiresCurrentInfo(q)).toBe(false)
      expect(intentOf(q)).not.toBe('online')
    })
  }

  // Calendar creates that merely contain a date word must NOT be hijacked online.
  it('calendar create with a date word is NOT routed online', () => {
    expect(requiresCurrentInfo('תקבעי לי פגישה היום בשלוש')).toBe(false)
    expect(intentOf('תקבעי לי פגישה היום בשלוש')).toBe('calendar_create')
  })

  // Personal "what do I have" must stay off the web (grounded/local).
  it('personal calendar question is not routed online', () => {
    expect(intentOf('מה יש לי היום')).not.toBe('online')
  })
})
