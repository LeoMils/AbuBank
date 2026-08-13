/*
 * companionSafety.guard.test.ts — P5.0 + P5.1: the standing companion-SAFETY guard.
 * ════════════════════════════════════════════════════════════════════════════
 * Martita is 81 and lives alone; Abu is sometimes the only voice in the room. These are the
 * invariants that must NEVER silently regress out of the assembled live instructions — a failure
 * here FAILS THE BUILD. They are deterministic (the instruction text is present and intact); the
 * ACTUAL behaviour under the real model is proven separately by the companion suite (P9).
 */
import { describe, it, expect } from 'vitest'
import { buildLiveInstructions } from './liveInstructions'

const instr = buildLiveInstructions()

describe('P5.0 — DISTRESS protocol is present and intact (safety, overrides everything)', () => {
  it('the distress section exists and overrides other rules', () => {
    expect(instr).toContain('אם מרתה במצוקה')
    expect(instr).toMatch(/overrides everything|OVERRIDES every other rule/i)
  })
  it('it prepares a call to Leo and points to emergency services, without claiming a call was made', () => {
    expect(instr).toMatch(/phone_call with recipient "לאו"/)
    expect(instr).toContain('מד״א') // Israeli emergency (Magen David Adom)
    expect(instr).toContain('101')
    expect(instr).toMatch(/NEVER say you have called anyone/i)
  })
  it('it does not diagnose or minimise, and stays with her', () => {
    expect(instr).toMatch(/do NOT diagnose/i)
    expect(instr).toMatch(/STAY WITH HER/i)
    expect(instr).toMatch(/not an emergency service/i)
  })
})

describe('P5.1 — standing safety invariants (never silently regress)', () => {
  it('residence is not live location', () => {
    expect(instr).toMatch(/never present it as her live or current GPS location/i)
  })
  it('never stores or advises on medical or financial details', () => {
    expect(instr).toMatch(/do not keep, ask for, or advise on medical or financial/i)
  })
  it('draws her toward real people — never fosters isolation or dependency', () => {
    expect(instr).toMatch(/draw her closer to her family, never away/i)
    expect(instr).toMatch(/never into leaning only on you/i)
  })
  it('never claims an action a tool has not confirmed', () => {
    expect(instr).toMatch(/never claim an action .* that a tool has not actually confirmed/i)
  })
  it('never invents a family fact — unknown stays unknown', () => {
    expect(instr).toMatch(/Never invent a name, gender, date, or relationship/i)
    expect(instr).toMatch(/say warmly that you are not sure|do not guess/i)
  })
})

describe('P5.2–5.4 — the behaviours that make her a friend are instructed', () => {
  it('brings things up unprompted, rate-limited (never nagging)', () => {
    expect(instr).toContain('מביאה דברים מעצמך')
    expect(instr).toMatch(/אף פעם לא נודניקית/)
  })
  it('connects sideways (food → gefilte fish, Tuesday → Mor, wine → never red)', () => {
    expect(instr).toContain('מקשרת לרוחב')
    expect(instr).toContain('גֶפילְטֶה פיש')
    expect(instr).toContain('היום של מור')
  })
  it('gentle mode when she repeats / is confused / tired', () => {
    expect(instr).toContain('מצב עדין')
    expect(instr).toMatch(/דבר אחד בכל פעם/)
  })
  it('two-strike rule: after two failures, offer an action, not a third rephrase', () => {
    expect(instr).toContain('שני ניסיונות ודי')
    expect(instr).toMatch(/אל תבקשי שתחזור בפעם שלישית/)
  })
  it('warmth without performance', () => {
    expect(instr).toContain('חום בלי הצגה')
  })
})
