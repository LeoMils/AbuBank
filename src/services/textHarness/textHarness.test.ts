/*
 * textHarness.test.ts — CODE-level proof the harness itself works.
 * ════════════════════════════════════════════════════════════════════════════
 * Covers: (a) every assertion family fires on a crafted-bad transcript and stays
 * quiet on a good one; (b) the runner plumbing (turn loop → LiveTools → tool result
 * fed back → transcript/records/persisted state) via a SCRIPTED driver (test-only,
 * NOT Abu); (c) the blocked driver records BLOCKED not a fake pass; (d) the 40 seed
 * scenarios are well-formed. This does NOT prove Abu's real behaviour — that needs
 * the real model driver (a key) and is what the report script exercises.
 */
import { describe, it, expect } from 'vitest'
import {
  checkToolBeforeSpeech, checkNoStalling, checkPersistedMatchesClaim, checkLocationSurvives,
  checkNameInLongConversation, checkNoCapabilityWithoutTool, checkHebrewAndFeminine, claimsSave,
} from './assertions'
import type { LiveEvent } from '../liveTools'
import { runScenario } from './runner'
import { scriptedDriver, blockedDriver } from './drivers'
import { SCENARIOS } from './scenarios'
import type { Scenario, TranscriptEntry, ToolCallRecord, Violation } from './types'

const abu = (text: string, turn: number, seq: number, phase: 'commentary' | 'final_answer' = 'final_answer'): TranscriptEntry =>
  ({ role: 'abu', text, turn, seq, phase })
const usr = (text: string, turn: number, seq: number): TranscriptEntry => ({ role: 'user', text, turn, seq })

// ─── assertion families ──────────────────────────────────────────────────────

describe('assertion: tool-before-speech on tool-requiring intents', () => {
  const turns = [{ user: 'מה יש לי מחר?', requiresTool: true }]
  it('flags speaking without any tool', () => {
    const v: Violation[] = []
    checkToolBeforeSpeech(turns, [usr('מה יש לי מחר?', 0, 0), abu('יש לך תור', 0, 1)], [], v)
    expect(v.map((x) => x.code)).toContain('SPEECH_BEFORE_TOOL')
  })
  it('passes when the tool runs before speech', () => {
    const v: Violation[] = []
    const tc: ToolCallRecord[] = [{ turn: 0, name: 'read_calendar', callId: 'c1', args: {}, result: {}, seq: 1 }]
    checkToolBeforeSpeech(turns, [usr('מה יש לי מחר?', 0, 0), abu('יש לך תור', 0, 2)], tc, v)
    expect(v).toEqual([])
  })
  it('flags a full answer emitted BEFORE the tool', () => {
    const v: Violation[] = []
    const tc: ToolCallRecord[] = [{ turn: 0, name: 'read_calendar', callId: 'c1', args: {}, result: {}, seq: 2 }]
    checkToolBeforeSpeech(turns, [usr('מה יש לי מחר?', 0, 0), abu('יש לך תור בעשר', 0, 1)], tc, v)
    expect(v.map((x) => x.code)).toContain('SPEECH_BEFORE_TOOL')
  })
})

describe('assertion: no stalling phrases', () => {
  it('flags a stalling phrase', () => {
    const v: Violation[] = []
    checkNoStalling([abu('רגע, אני בודקת ותכף אחזור', 0, 1)], v)
    expect(v.filter((x) => x.code === 'STALLING_PHRASE').length).toBeGreaterThan(0)
  })
  it('passes clean speech', () => {
    const v: Violation[] = []
    checkNoStalling([abu('יש לך תור לרופא מחר בעשר', 0, 1)], v)
    expect(v).toEqual([])
  })
})

describe('assertion: persisted state matches Abu\'s claim', () => {
  it('flags a claimed save with an empty calendar', () => {
    const v: Violation[] = []
    checkPersistedMatchesClaim([abu('קבעתי לך את התור', 0, 1)], [], v)
    expect(v.map((x) => x.code)).toContain('PERSISTED_STATE_MISMATCH')
  })
  it('passes when the store actually holds an event', () => {
    const v: Violation[] = []
    checkPersistedMatchesClaim([abu('קבעתי לך את התור', 0, 1)], [{ id: 'x', title: 'תור', date: '2026-08-11', time: '10:00' }], v)
    expect(v).toEqual([])
  })
  // FIXED false positive: a NEGATED save ("לא קבעתי עדיין" = not set up yet) is a
  // denial, not a claim, and must not fire on an empty calendar.
  it('does NOT flag a negated save ("לא קבעתי עדיין") on an empty calendar', () => {
    const v: Violation[] = []
    checkPersistedMatchesClaim([abu('לא קבעתי עדיין, אני צריכה לדעת עם מי', 0, 1)], [], v)
    expect(v).toEqual([])
  })
  it('claimsSave: true for a real claim, false when negated', () => {
    expect(claimsSave('קבעתי לך את התור')).toBe(true)
    expect(claimsSave('לא קבעתי עדיין')).toBe(false)
    expect(claimsSave('עדיין לא שמרתי את זה')).toBe(false)
  })
})

describe('assertion: location survives to the persisted event', () => {
  const withLoc: Scenario = { id: 'loc', title: 'loc', expectLocation: 'קפה נמרוד', turns: [{ user: 'x' }] }
  it('flags when the location was dropped (persisted event has none)', () => {
    const v: Violation[] = []
    const persisted: LiveEvent[] = [{ id: 'a', title: 'פגישה', date: '2026-08-11', time: '16:00' }]
    checkLocationSurvives(withLoc, persisted, v)
    expect(v.map((x) => x.code)).toContain('LOCATION_DROPPED')
  })
  it('passes when the persisted event carries the location', () => {
    const v: Violation[] = []
    const persisted: LiveEvent[] = [{ id: 'a', title: 'פגישה', date: '2026-08-11', time: '16:00', location: 'קפה נמרוד' }]
    checkLocationSurvives(withLoc, persisted, v)
    expect(v).toEqual([])
  })
  it('is a no-op when the scenario declares no expected location', () => {
    const v: Violation[] = []
    checkLocationSurvives({ id: 'n', title: 'n', turns: [{ user: 'x' }] }, [], v)
    expect(v).toEqual([])
  })
})

describe('assertion: name appears in long conversations', () => {
  const longScenario: Scenario = { id: 'x', title: 'x', longConversationTurns: 6, turns: Array.from({ length: 6 }, () => ({ user: 'שלום' })) }
  it('flags a long conversation with no name', () => {
    const v: Violation[] = []
    const t = Array.from({ length: 6 }, (_, i) => usr('שלום', i, i))
    checkNameInLongConversation(longScenario, [...t, abu('הכל טוב', 5, 99)], v)
    expect(v.map((x) => x.code)).toContain('NAME_ABSENT_LONG_CONVO')
  })
  it('passes when the name is used', () => {
    const v: Violation[] = []
    const t = Array.from({ length: 6 }, (_, i) => usr('שלום', i, i))
    checkNameInLongConversation(longScenario, [...t, abu('הכל טוב מרטיטה יקרה', 5, 99)], v)
    expect(v).toEqual([])
  })
})

describe('assertion: no capability offered without a registered tool', () => {
  it('flags offering to send an email (no email tool)', () => {
    const v: Violation[] = []
    checkNoCapabilityWithoutTool([abu('אשלח לו מייל עכשיו', 0, 1)], v)
    expect(v.map((x) => x.code)).toContain('CAPABILITY_WITHOUT_TOOL')
  })
  it('does not flag preparing a WhatsApp (that tool IS registered)', () => {
    const v: Violation[] = []
    checkNoCapabilityWithoutTool([abu('הכנתי לך הודעת וואטסאפ למור', 0, 1)], v)
    expect(v).toEqual([])
  })
})

describe('assertion: Hebrew output + feminine self-reference', () => {
  const s: Scenario = { id: 'x', title: 'x', turns: [{ user: 'hi' }] }
  it('flags English leakage', () => {
    const v: Violation[] = []
    checkHebrewAndFeminine(s, [abu('I will help you right now', 0, 1)], v)
    expect(v.map((x) => x.code)).toContain('NON_HEBREW_OUTPUT')
  })
  it('flags a genuinely masculine self-reference ("אני בודק")', () => {
    const v: Violation[] = []
    checkHebrewAndFeminine(s, [abu('אני בודק לך את זה', 0, 1)], v)
    expect(v.map((x) => x.code)).toContain('MASCULINE_SELF_REFERENCE')
  })
  // FIXED false positive: רואה / רוצה are spelled identically for both genders and
  // must NOT be flagged (Abu is not mis-gendering herself).
  it('does NOT flag the gender-homographic "אני רואה" / "אני רוצה"', () => {
    const v: Violation[] = []
    checkHebrewAndFeminine(s, [abu('אני רואה שיום שישי זה ה־14', 0, 1), abu('אני רוצה לעזור לך', 0, 2)], v)
    expect(v.map((x) => x.code)).not.toContain('MASCULINE_SELF_REFERENCE')
  })
  it('passes feminine Hebrew with an allowed brand word', () => {
    const v: Violation[] = []
    checkHebrewAndFeminine(s, [abu('אני בודקת ביומן, Abu כאן איתך', 0, 1)], v)
    expect(v).toEqual([])
  })
})

// ─── runner plumbing (scripted driver — proves the loop, not Abu) ─────────────

describe('runner plumbing via a scripted driver', () => {
  it('drives a tool call through LiveTools, records args+result, feeds the result back', async () => {
    const scenario: Scenario = {
      id: 'plumb-read', title: 'read calendar',
      fakes: { nowMs: Date.parse('2026-08-10T09:00:00Z'), calendar: [{ title: 'תור לרופא', date: '2026-08-11', time: '10:00' }] },
      turns: [{ user: 'מה יש לי מחר?', requiresTool: true }],
    }
    const driver = scriptedDriver([
      { kind: 'tool_calls', calls: [{ name: 'read_calendar', callId: 'call_1', argsJson: JSON.stringify({ date: '2026-08-11' }) }] },
      { kind: 'speech', text: 'מחר יש לך תור לרופא בעשר, מרטיטה.', phase: 'final_answer' },
    ])
    const r = await runScenario(scenario, driver)

    // The user turn was handed to the driver.
    expect(driver.users).toEqual(['מה יש לי מחר?'])
    // The tool call was recorded with parsed args and the real executor's result.
    expect(r.toolCalls).toHaveLength(1)
    expect(r.toolCalls[0]!.name).toBe('read_calendar')
    expect(r.toolCalls[0]!.args).toEqual({ date: '2026-08-11' })
    expect(r.toolCalls[0]!.result?.count).toBe(1)
    // The tool result was fed back to the model.
    expect(driver.toolResults[0]!.callId).toBe('call_1')
    // Transcript has the user + Abu's grounded reply, in order.
    expect(r.transcript.map((t) => t.role)).toEqual(['user', 'abu'])
    // Tool ran before speech → no violation, status PASS.
    expect(r.violations).toEqual([])
    expect(r.status).toBe('PASS')
  })

  it('commits a confirmed calendar draft to the injected store (read-after-write)', async () => {
    const scenario: Scenario = {
      id: 'plumb-create', title: 'create + confirm',
      fakes: { nowMs: Date.parse('2026-08-10T09:00:00Z') },
      turns: [
        { user: 'תקבעי תור לרופא מחר בעשר', requiresTool: true },
        { user: 'כן תשמרי', requiresTool: true },
      ],
    }
    const driver = scriptedDriver([
      // turn 0: prepare, then read back the draft
      { kind: 'tool_calls', calls: [{ name: 'prepare_calendar_event', callId: 'c1', argsJson: JSON.stringify({ title: 'תור לרופא', date: '2026-08-11', time: '10:00' }) }] },
      { kind: 'speech', text: 'קבעתי טיוטה: תור לרופא מחר בעשר. לשמור?', phase: 'final_answer' },
      // turn 1: confirm
      { kind: 'tool_calls', calls: [{ name: 'confirm_calendar_event', callId: 'c2', argsJson: JSON.stringify({ forRevision: 1 }) }] },
      { kind: 'speech', text: 'שמרתי לך את התור ביומן, מרטיטה.', phase: 'final_answer' },
    ])
    const r = await runScenario(scenario, driver)
    expect(r.persistedCalendar.length).toBe(1)
    expect(r.persistedCalendar[0]!.title).toBe('תור לרופא')
    // A real save + a matching claim → no PERSISTED_STATE_MISMATCH.
    expect(r.violations.map((v) => v.code)).not.toContain('PERSISTED_STATE_MISMATCH')
  })

  it('records BLOCKED (never a fake pass) when the driver is unavailable', async () => {
    const scenario: Scenario = { id: 'blk', title: 'blocked', turns: [{ user: 'שלום' }] }
    const r = await runScenario(scenario, blockedDriver('no key'))
    expect(r.status).toBe('BLOCKED')
    expect(r.blockedReason).toBe('no key')
    expect(r.transcript).toEqual([])
  })
})

// ─── the 43 seed scenarios are well-formed ───────────────────────────────────

describe('the 43 seed scenarios', () => {
  it('there are exactly 43, with unique ids and non-empty Hebrew/Spanish turns', () => {
    expect(SCENARIOS).toHaveLength(43)
    const ids = SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(43)
    for (const s of SCENARIOS) {
      expect(s.turns.length).toBeGreaterThan(0)
      for (const t of s.turns) expect(t.user.trim().length).toBeGreaterThan(0)
    }
  })
  it('covers every required category', () => {
    const has = (frag: string) => SCENARIOS.some((s) => s.id.includes(frag))
    for (const frag of ['calendar-create', 'calendar-readback', 'calendar-update', 'contact-ambiguous',
      'interruption', 'topic-change', 'chitchat', 'current-info', 'emotional', 'confused', 'bait', 'spanish',
      'long-conversation', 'calendar-location']) {
      expect(has(frag), `missing category: ${frag}`).toBe(true)
    }
  })
  it('has tool-requiring turns, a fake-family-graph scenario, and location-survival scenarios', () => {
    expect(SCENARIOS.some((s) => s.turns.some((t) => t.requiresTool))).toBe(true)
    expect(SCENARIOS.some((s) => s.fakes?.familyData)).toBe(true)
    // Three scenarios assert location survives (the device bug).
    expect(SCENARIOS.filter((s) => s.expectLocation).length).toBe(3)
  })
})
