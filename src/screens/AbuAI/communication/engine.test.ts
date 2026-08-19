import { describe, it, expect } from 'vitest'
import {
  reduceGoal,
  decideCommunicationTurn,
  renderResponse,
  validateResponse,
  type ActiveGoal,
  type TurnSource,
  type ActionStatus,
  type Decision,
} from './engine'

const CTX = { buildId: 'test', recipientCanHandoff: true }
const CAL = /פגיש[הות]|ביומן|ביומ[ןנ]|\bתור\b|קבעתי|אין\s+כלום/

// Run a whole conversation through the engine, threading the active goal.
function run(turns: Array<{ text: string; source?: TurnSource; canHandoff?: boolean }>): { steps: Decision[]; goal: ActiveGoal | null } {
  let goal: ActiveGoal | null = null
  const steps: Decision[] = turns.map((t) => {
    const d = decideCommunicationTurn(goal, { text: t.text, source: t.source ?? 'text' }, { ...CTX, recipientCanHandoff: t.canHandoff ?? true })
    goal = d.result.goal
    return d
  })
  return { steps, goal }
}

// ════════════════════════════════════════════════════════════════════════════
// GOLDEN CONVERSATIONS — the frozen real failures (section 8)
// ════════════════════════════════════════════════════════════════════════════
describe('GOLDEN — multi-turn WhatsApp compose keeps ONE communication goal', () => {
  it('start → follow-ups → "לא פגישה" correction → time: never Calendar, payload preserved', () => {
    const { steps, goal } = run([
      { text: 'תשלח הודעה ללאו' },   // ACTION_START
      { text: 'שיבוא היום בערב' },    // continue
      { text: 'עם יין' },             // continue
      { text: 'לא פגישה' },           // correction (must NOT become calendar)
      { text: 'בשמונה וחצי' },        // correction/continue
    ])
    for (const s of steps) {
      expect(s.result.capability, s.result.decisionReason).toBe('communication')
      expect(s.receipt.actionStatus).toBe('HANDOFF_AVAILABLE')
      expect(s.response.text).not.toMatch(CAL)          // no calendar language ever
      expect(validateResponse(s.response.text, { mode: 'message', status: s.status, recipientName: 'לאו', hasHandoff: true }).ok).toBe(true)
    }
    expect(steps[0]!.result.turnKind).toBe('ACTION_START')
    expect(goal?.mode).toBe('message')
    expect(goal?.recipientHebrew).toBeTruthy()
    // "לא פגישה" did not inject a meeting word into the payload.
    expect(goal?.command?.intent ?? '').not.toMatch(/פגיש/)
  })
})

describe('GOLDEN — call goal survives reassertion, never Calendar', () => {
  it('"תתקשרי לליאו" then reassertions mentioning "יומן" stay a call', () => {
    const { steps, goal } = run([
      { text: 'תתקשרי לליאו' },
      { text: 'לא ראיתי שיחה, אני רוצה שיחה עכשיו עם לאו. תתקשרי.' },
      { text: 'זה בכלל לא קשור ליומן. אני רוצה שתתקשרי לליאו עכשיו.' },
    ])
    for (const s of steps) {
      expect(s.result.capability, s.result.decisionReason).toBe('communication')
      expect(s.response.text).not.toMatch(CAL)
    }
    expect(goal?.mode).toBe('call')
    expect(steps[0]!.receipt.outerAction).toBe('communication.call')
    // The call handoff response never denies the capability.
    expect(steps[0]!.response.text).toMatch(/מכינה שיחה|החייגן/)
  })
})

describe('GOLDEN — meta-questions explain truthfully, goal retained', () => {
  it('"מה זה אומר שאת פותחת הודעה?" keeps the goal and explains open≠send', () => {
    const { steps, goal } = run([
      { text: 'תשלחי ללאו שיביא מחר יין לארוחה' },
      { text: 'מה זה אומר שאת פותחת הודעה?' },
      { text: 'למה אמרת פותחת אם את לא מסוגלת?' },
    ])
    expect(steps[1]!.result.turnKind).toBe('QUESTION')
    expect(steps[2]!.result.turnKind).toBe('QUESTION')
    for (const s of steps.slice(1)) {
      expect(s.result.capability).toBe('communication')
      // Never denies the handoff it just produced; never claims a send.
      expect(s.response.text).toMatch(/מוכנה|WhatsApp/)
      expect(s.response.text).not.toMatch(/שלחתי|נשלח/)
    }
    expect(goal?.recipientHebrew).toBeTruthy()
  })
})

describe('GOLDEN — explicit cancel switches to Calendar (only via explicit release)', () => {
  it('"עזבי. מה יש לי מחר?" cancels communication and switches', () => {
    const { steps } = run([
      { text: 'תשלח הודעה ללאו' },
      { text: 'עזבי. מה יש לי מחר?' },
    ])
    expect(steps[1]!.result.turnKind).toBe('SWITCH')
    expect(steps[1]!.result.capability).toBe('calendar')
    expect(steps[1]!.result.goal).toBeNull() // communication released
  })
})

// ════════════════════════════════════════════════════════════════════════════
// PROPERTY / COUNTEREXAMPLE tests (section 9)
// ════════════════════════════════════════════════════════════════════════════
describe('PROPERTY — inner payload can never change the outer action (Law 2)', () => {
  const payloads = ['שיש לי פגישה מחר', 'שיש לי תור לרופא', 'תזכיר לי על היומן', 'שנקבע פגישה בשמונה']
  for (const p of payloads) {
    it(`"תכתבי ללאו ${p}" → communication.compose, not calendar`, () => {
      const d = decideCommunicationTurn(null, { text: `תכתבי ללאו ${p}`, source: 'text' }, CTX)
      expect(d.result.capability).toBe('communication')
      expect(d.receipt.outerAction).toBe('communication.compose')
    })
  }
})

describe('PROPERTY — correction precedes classification (Law 3)', () => {
  it('"לא פגישה" during a message goal is a CORRECTION, never calendar', () => {
    const start = decideCommunicationTurn(null, { text: 'תשלח הודעה ללאו', source: 'text' }, CTX)
    const corr = decideCommunicationTurn(start.result.goal, { text: 'לא פגישה', source: 'text' }, CTX)
    expect(corr.result.turnKind).toBe('CORRECTION')
    expect(corr.result.capability).toBe('communication')
  })
})

describe('PROPERTY — recipient change preserves payload', () => {
  it('"לא, למור" changes recipient but keeps the message content', () => {
    const s1 = decideCommunicationTurn(null, { text: 'תכתבי ללאו שיביא יין', source: 'text' }, CTX)
    const payload = s1.result.goal?.command?.intent
    expect(payload).toBeTruthy()
    const s2 = decideCommunicationTurn(s1.result.goal, { text: 'לא, למור', source: 'text' }, CTX)
    expect(s2.result.changed).toBe('recipient')
    expect(s2.result.goal?.command?.intent).toBe(payload) // payload preserved
    expect(s2.result.goal?.recipientHebrew).toMatch(/מור/)
  })
})

describe('PROPERTY — cancellation releases the goal', () => {
  it('"עזבי" with no calendar query cancels and releases', () => {
    const s1 = decideCommunicationTurn(null, { text: 'תשלח הודעה ללאו', source: 'text' }, CTX)
    const s2 = decideCommunicationTurn(s1.result.goal, { text: 'עזבי', source: 'text' }, CTX)
    expect(s2.result.turnKind).toBe('CANCEL')
    expect(s2.result.goal).toBeNull()
    expect(s2.status).toBe('CANCELLED')
  })
})

describe('PROPERTY — text / Web Speech / Realtime decide identically (Law 5)', () => {
  const seq = ['תשלח הודעה ללאו', 'עם יין', 'לא פגישה', 'לא, למור']
  const sources: TurnSource[] = ['text', 'voice', 'realtime']
  it('same turnKind + capability + changed across all transports', () => {
    const runs = sources.map((src) => {
      let goal: ActiveGoal | null = null
      return seq.map((text) => {
        const d = reduceGoal(goal, { text, source: src })
        goal = d.goal
        return `${d.turnKind}:${d.capability}:${d.changed}`
      })
    })
    expect(runs[1]).toEqual(runs[0]) // voice == text
    expect(runs[2]).toEqual(runs[0]) // realtime == text
  })
})

describe('PROPERTY — provider is not part of the decision (capability is provider-free)', () => {
  it('capability is decided before any compose provider runs', () => {
    // reduceGoal never imports/calls a provider — a compose failure downstream
    // cannot change the capability chosen here.
    const d = reduceGoal(null, { text: 'תכתבי ללאו שיביא יין', source: 'text' })
    expect(d.capability).toBe('communication')
  })
})

describe('PROPERTY — missing number does not proceed to a handoff, but keeps the goal', () => {
  it('no usable number → FAILED, goal retained, draft recoverable', () => {
    const d = decideCommunicationTurn(null, { text: 'תכתבי ללאו שיביא יין', source: 'text' }, { buildId: 't', recipientCanHandoff: false })
    expect(d.status).toBe('FAILED')
    expect(d.result.capability).toBe('communication') // still the same goal (Law 7)
    expect(d.result.goal?.command?.intent).toBeTruthy() // draft survives (Law 8)
    expect(d.response.text).toMatch(/אין מספר/)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// ANTI-CONTRADICTION GATE + FAULT INJECTION (sections 7, 9)
// ════════════════════════════════════════════════════════════════════════════
describe('ANTI-CONTRADICTION gate rejects false action language', () => {
  const msg = { mode: 'message' as const, status: 'HANDOFF_AVAILABLE' as ActionStatus, recipientName: 'לאו', hasHandoff: true }
  const call = { mode: 'call' as const, status: 'HANDOFF_AVAILABLE' as ActionStatus, recipientName: 'לאו', hasHandoff: true }
  it('rejects a fabricated completed call ("התקשרתי")', () => {
    expect(validateResponse('התקשרתי ללאו', call).ok).toBe(false)
  })
  it('rejects a fabricated sent message ("שלחתי")', () => {
    expect(validateResponse('שלחתי ללאו את ההודעה', msg).ok).toBe(false)
  })
  it('rejects denying a handoff that exists', () => {
    expect(validateResponse('אני לא יכולה להתקשר ללאו', call).ok).toBe(false)
  })
  it('rejects calendar language during a communication action', () => {
    expect(validateResponse('קבעתי לך פגישה ביומן', msg).ok).toBe(false)
  })
  it('rejects an auto-send implication', () => {
    expect(validateResponse('שולחת עכשיו את ההודעה', msg).ok).toBe(false)
  })
  it('APPROVES the truthful policy strings for every status', () => {
    const statuses: ActionStatus[] = ['HANDOFF_AVAILABLE', 'HANDOFF_INVOKED', 'NEEDS_CLARIFICATION', 'FAILED', 'CANCELLED']
    for (const mode of ['message', 'call'] as const) {
      for (const status of statuses) {
        const r = renderResponse({ mode, status, recipientName: 'לאו', hasHandoff: status === 'HANDOFF_AVAILABLE' || status === 'HANDOFF_INVOKED' })
        expect(validateResponse(r.text, { mode, status, recipientName: 'לאו', hasHandoff: status.startsWith('HANDOFF') }).ok, `${mode}/${status}: ${r.text}`).toBe(true)
      }
    }
  })
})

describe('FAULT INJECTION — the suite catches a broken engine', () => {
  it('detects a routing inversion (payload calendar word stealing the outer action)', () => {
    // Simulate a regression: a reducer that lets a calendar word in the payload
    // flip the capability. The invariant test above ("PROPERTY — inner payload")
    // is what goes red. Here we assert the guard directly.
    const brokenCapability = /פגיש/.test('תכתבי ללאו שיש לי פגישה מחר') ? 'calendar' : 'communication'
    // The REAL engine must NOT behave like `brokenCapability`.
    const real = reduceGoal(null, { text: 'תכתבי ללאו שיש לי פגישה מחר', source: 'text' }).capability
    expect(real).not.toBe(brokenCapability) // real=communication, broken=calendar → caught
    expect(real).toBe('communication')
  })
  it('detects a response-truth bypass (a raw send claim must be rejected)', () => {
    // If a future path bypasses renderResponse and emits prose, the gate catches it.
    const bypassed = 'שלחתי ללאו שיבוא עם יין'
    expect(validateResponse(bypassed, { mode: 'message', status: 'HANDOFF_AVAILABLE', recipientName: 'לאו', hasHandoff: true }).ok).toBe(false)
  })
  it('detects lost ownership (a follow-up with no active goal must NOT silently act)', () => {
    // Ownership removed → a bare follow-up like "עם יין" alone starts nothing.
    const d = reduceGoal(null, { text: 'עם יין', source: 'text' })
    expect(d.capability).toBe('none')
    expect(d.goal).toBeNull()
  })
})

// FAILURE C invariant: the "לחצי על התקשרי" claim may appear ONLY with a handoff.
describe('ACTION-TRUTH invariant — "התקשרי" wording only accompanies a handoff', () => {
  it('a call HANDOFF_AVAILABLE says "התקשרי" (a reachable button will exist)', () => {
    const r = renderResponse({ mode: 'call', status: 'HANDOFF_AVAILABLE', recipientName: 'לאו', hasHandoff: true })
    expect(r.text).toMatch(/התקשרי/)
    expect(r.responseClass).toBe('call_available')
  })
  it('clarification / no-number NEVER claim the call button', () => {
    for (const status of ['NEEDS_CLARIFICATION', 'FAILED', 'CANCELLED'] as const) {
      const r = renderResponse({ mode: 'call', status, recipientName: 'לאו', hasHandoff: false })
      expect(r.text, `${status}`).not.toMatch(/לחצי על "?התקשרי/)
    }
  })
})
