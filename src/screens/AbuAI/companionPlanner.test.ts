import { describe, it, expect } from 'vitest'
import { planCompanionTurn, advanceState, EMPTY_STATE } from './companionPlanner'

describe('companionPlanner — frame & suppression', () => {
  it('grief suppresses lookups even with a person mentioned', () => {
    const p = planCompanionTurn('אני מתגעגעת לפאפי')
    expect(p.step7_frame).toBe('emotion')
    expect(p.step7_act).toBe('listen')
    expect(p.suppressLookups).toBe(true)
  })

  it('worry about a child suppresses the family lookup', () => {
    const p = planCompanionTurn('אופיר לא התקשר ונעלב לי')
    expect(p.step7_frame).toBe('emotion')
    expect(p.suppressLookups).toBe(true)
  })

  it('boredom → companionship lead (not trivia)', () => {
    const p = planCompanionTurn('משעמם לי')
    expect(p.step7_frame).toBe('companionship')
    expect(p.step7_act).toBe('lead')
  })

  it('pride → encourage, lookups not suppressed (may add a warm detail)', () => {
    const p = planCompanionTurn('אני כל כך גאה, אופיר מתחתן!')
    expect(p.step7_act).toBe('encourage')
    expect(p.suppressLookups).toBe(false)
  })
})

describe('companionPlanner — task / online / continuity', () => {
  it('calendar create → task/confirm', () => {
    const p = planCompanionTurn('תקבעי מחר בשלוש עם מוטי')
    expect(p.step7_frame).toBe('task')
    expect(p.step5_calendar).toBe('create')
    expect(p.step7_act).toBe('confirm')
  })

  it('calendar read → task/answer', () => {
    const p = planCompanionTurn('מה יש לי מחר?')
    expect(p.step5_calendar).toBe('read')
    expect(p.step7_act).toBe('answer')
  })

  it('online need detected for news/weather', () => {
    expect(planCompanionTurn('מה מזג האוויר מחר?').step6_onlineNeeded).toBe(true)
    expect(planCompanionTurn('ומה חדש בעולם?').step6_onlineNeeded).toBe(true)
  })

  it('pronoun continuity resolves to last person', () => {
    let s = { ...EMPTY_STATE }
    const p1 = planCompanionTurn('מי זאת מור?', s)
    s = advanceState(s, p1)
    const p2 = planCompanionTurn('ספרי לי עליה', s)
    expect(p2.step7_act).toBe('continue')
    expect(p2.step4_continuity.resolvedPerson).toBe('מור')
  })
})

describe('companionPlanner — mood stickiness', () => {
  it('an incidental factual turn does NOT reset grief', () => {
    let s = { ...EMPTY_STATE }
    const p1 = planCompanionTurn('אני מתגעגעת לפאפי', s)
    s = advanceState(s, p1)
    const p2 = planCompanionTurn('מה השעה?', s)
    expect(p2.step7_frame).toBe('emotion')
    expect(p2.suppressLookups).toBe(true)
  })

  it('a clear task DOES shift out of lingering grief', () => {
    let s = { ...EMPTY_STATE }
    const p1 = planCompanionTurn('היה לי יום קשה, אני מתגעגעת לפאפי', s)
    s = advanceState(s, p1)
    const p2 = planCompanionTurn('טוב. תקבעי לי רופא מחר בארבע', s)
    expect(p2.step7_frame).toBe('task')
    expect(p2.step5_calendar).toBe('create')
  })
})
