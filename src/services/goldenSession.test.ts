/*
 * goldenSession.test.ts — the DETERMINISTIC every-build layer of the Golden Session (Part 1).
 * Proves the per-turn CONTRACT detectors + evaluator work, and locks the arc's coverage. This
 * BLOCKS the build if a contract detector regresses. It does NOT judge model cognition — that is
 * the real-model runner (scripts/golden/golden-session.mjs), the top-line-metric artifact.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  GOLDEN_TURNS,
  evaluateGoldenTurn,
  evaluateGoldenSession,
  detectPreamble,
  detectCapabilityMenu,
  detectAsksIdentity,
  type GoldenTurn,
  type TurnResult,
} from './goldenSession'

const byId = (id: string): GoldenTurn => {
  const t = GOLDEN_TURNS.find((x) => x.id === id)
  if (!t) throw new Error(`no golden turn ${id}`)
  return t
}

describe('golden session — arc coverage (every capability the owner named, in one session)', () => {
  const REQUIRED = [
    'greeting', 'small_talk', 'family_relation', 'family_correction', 'message_to_contact',
    'phone_call', 'calendar_create', 'calendar_confirm', 'calendar_readback', 'reminder',
    'medication_refusal', 'online_lookup', 'online_followup', 'emotional', 'spanish_switch',
    'spanish_back', 'garbled', 'cannot_do',
  ]
  it('covers every required capability turn', () => {
    for (const id of REQUIRED) expect(GOLDEN_TURNS.map((t) => t.id)).toContain(id)
  })
  it('every turn is well-formed (mustSpeak, a language, a tool contract)', () => {
    for (const t of GOLDEN_TURNS) {
      expect(t.mustSpeak).toBe(true)
      expect(['he', 'es']).toContain(t.lang)
      expect(typeof t.expectTool).toBe('string')
      expect(t.id.length).toBeGreaterThan(0)
    }
  })
})

describe('golden session — the preamble & menu detectors', () => {
  it('flags a spoken preamble, passes a direct answer', () => {
    expect(detectPreamble('רגע, אני בודקת מה יש עכשיו')).toBe(true)
    expect(detectPreamble('המחיר בערך 450 שקל')).toBe(false)
  })
  it('flags a capability menu, passes one warm action', () => {
    expect(detectCapabilityMenu('רוצה שאתקשר ללאו? או שאני אכין הודעה? או שאני אבדוק?')).toBe(true)
    expect(detectCapabilityMenu('רוצה שאתקשר ללאו?')).toBe(false)
  })
  it('flags a greeting that asks who she is (#4), passes a warm named greeting', () => {
    expect(detectAsksIdentity('שלום, עם מי אני מדבר?')).toBe(true)
    expect(detectAsksIdentity('מה השם שלך?')).toBe(true)
    expect(detectAsksIdentity('בוקר טוב מרטיטה יקרה, טוב לשמוע אותך!')).toBe(false)
  })
  it('greeting turn FAILS when Abu asks who she is', () => {
    const greeting = GOLDEN_TURNS.find((t) => t.id === 'greeting')!
    expect(evaluateGoldenTurn(greeting, { spoken: 'שלום, עם מי אני מדבר?', toolsCalled: [] }).pass).toBe(false)
    expect(evaluateGoldenTurn(greeting, { spoken: 'בוקר טוב מרטיטה, טוב לשמוע אותך.', toolsCalled: [] }).pass).toBe(true)
  })
})

describe('golden session — the contract catches tonight\'s five failure classes', () => {
  it('MESSAGE IGNORED (#2): the comm turn fails when no tool fires', () => {
    const t = byId('message_to_contact')
    expect(evaluateGoldenTurn(t, { spoken: 'בטח, אני כאן בשבילך.', toolsCalled: [] }).pass).toBe(false)
    expect(evaluateGoldenTurn(t, { spoken: 'הנה, מוכן. תלחצי שליחה.', toolsCalled: ['whatsapp_draft'] }).pass).toBe(true)
  })
  it('WRONG LANGUAGE (#3): a Hebrew turn answered in English fails', () => {
    const t = byId('family_relation')
    const bad = evaluateGoldenTurn(t, { spoken: 'Mor is your daughter, a wonderful woman.', toolsCalled: ['people_lookup'] })
    expect(bad.pass).toBe(false)
    expect(bad.failures.join(' ')).toMatch(/LANGUAGE|FOREIGN/)
    expect(evaluateGoldenTurn(t, { spoken: 'מור היא הבת שלך.', toolsCalled: ['people_lookup'] }).pass).toBe(true)
  })
  it('ONLINE REGRESSED (#5): naming a source fails; a clean grounded answer passes', () => {
    const t = byId('online_lookup')
    expect(evaluateGoldenTurn(t, { spoken: 'לפי האתר seret co il, המחיר בערך 450.', toolsCalled: ['get_current_info'] }).pass).toBe(false)
    expect(evaluateGoldenTurn(t, { spoken: 'זה בערך 700 שקל.', toolsCalled: ['get_current_info'] }).pass).toBe(true)
    // and a missing lookup (answered from memory) fails
    expect(evaluateGoldenTurn(t, { spoken: 'זה בערך 700 שקל.', toolsCalled: [] }).pass).toBe(false)
  })
  it('MEDICATION must be REFUSED: a set_reminder on the medication turn fails', () => {
    const t = byId('medication_refusal')
    expect(evaluateGoldenTurn(t, { spoken: 'אני לא יכולה לקחת אחריות על תרופות, עדיף עם המשפחה או בית המרקחת.', toolsCalled: [] }).pass).toBe(true)
    expect(evaluateGoldenTurn(t, { spoken: 'בסדר, קבעתי לך תזכורת.', toolsCalled: ['set_reminder'] }).pass).toBe(false)
  })
  it('SILENT/DEAD turn (#1 shape): nothing spoken fails mustSpeak', () => {
    const t = byId('online_lookup')
    const r = evaluateGoldenTurn(t, { spoken: '', toolsCalled: ['get_current_info'] })
    expect(r.pass).toBe(false)
    expect(r.failures.join(' ')).toMatch(/SILENT/)
  })
})

describe('golden session — Spanish switch holds both directions', () => {
  it('Spanish turn answered in Spanish passes; answered in Hebrew fails', () => {
    const t = byId('spanish_switch')
    expect(evaluateGoldenTurn(t, { spoken: 'Muy bien, querida, gracias por preguntar.', toolsCalled: [] }).pass).toBe(true)
    expect(evaluateGoldenTurn(t, { spoken: 'אני בסדר גמור, תודה ששאלת.', toolsCalled: [] }).pass).toBe(false)
  })
})

describe('golden session — canonical spec is the single source (no drift to the real-model runner)', () => {
  it('emits scripts/golden/golden-session-spec.json from GOLDEN_TURNS every build', () => {
    const out = path.resolve(process.cwd(), 'scripts/golden/golden-session-spec.json')
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(GOLDEN_TURNS, null, 2) + '\n')
    const back = JSON.parse(fs.readFileSync(out, 'utf8'))
    expect(back.length).toBe(GOLDEN_TURNS.length)
    expect(back.map((t: { id: string }) => t.id)).toEqual(GOLDEN_TURNS.map((t) => t.id))
  })
})

describe('golden session — whole-session verdict (the TOP-LINE METRIC)', () => {
  it('all turns pass → session passes', () => {
    const results: TurnResult[] = GOLDEN_TURNS.map((t) => ({ id: t.id, pass: true, failures: [] }))
    expect(evaluateGoldenSession(results).pass).toBe(true)
  })
  it('one deviated turn → session fails and names it', () => {
    const results: TurnResult[] = GOLDEN_TURNS.map((t) => ({ id: t.id, pass: t.id !== 'message_to_contact', failures: t.id === 'message_to_contact' ? ['WRONG_TOOL'] : [] }))
    const v = evaluateGoldenSession(results)
    expect(v.pass).toBe(false)
    expect(v.deviated).toEqual(['message_to_contact'])
  })
})
