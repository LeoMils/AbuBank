/*
 * classifiedCorpus.test.ts — the classified checks EARN the right to gate only by numbers.
 * Asserts each heuristic fires on its clear defect AND — the real gate — keeps a ZERO
 * false-positive rate on warm, correct answers engineered to be mistaken for the defect.
 */
import { describe, it, expect } from 'vitest'
import { buildClassifiedCorpus, measureClassified } from './classifiedCorpus'
import { classifyTurn, buildClassifiedRepair } from './classifiedMonitor'

const reports = measureClassified(buildClassifiedCorpus())
const by = (d: string) => reports.find((r) => r.detector === d)!

describe('classified corpus is real (fire + clean sets both substantial)', () => {
  it('each detector has an engineered fire set and a clean set built to fool it', () => {
    for (const r of reports) {
      expect(r.firePositives).toBeGreaterThanOrEqual(4)
      expect(r.cleanNegatives).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('FALSE POSITIVES are zero — a blocked good answer is worse than the defect', () => {
  for (const d of ['DISTRESS_MENU', 'METHOD_NARRATION', 'UNGROUNDED_ENTITY']) {
    it(`${d}: FP rate === 0 (no FPs ${JSON.stringify(by(d).falsePositives)})`, () => {
      expect(by(d).falsePositives).toEqual([])
      expect(by(d).falsePositiveRate).toBe(0)
    })
  }
})

describe('each classified check intercepts its engineered defect', () => {
  for (const d of ['DISTRESS_MENU', 'METHOD_NARRATION', 'UNGROUNDED_ENTITY']) {
    it(`${d}: interception === 1.0 (no misses ${JSON.stringify(by(d).missed)})`, () => {
      expect(by(d).missed).toEqual([])
      expect(by(d).interceptionRate).toBe(1)
    })
  }
})

describe('key discriminations (the exact FP traps)', () => {
  it('a SINGLE warm caring offer in distress is NOT a menu', () => {
    expect(classifyTurn('אני איתך. רוצה שאתקשר ללאו?', { userText: 'נפלתי ואני מפחדת' })).toEqual([])
  })
  it('a family fact WITH a grounding tool result is not ungrounded', () => {
    expect(classifyTurn('מור היא הבת שלך', { userText: 'מי זאת מור?', groundedTools: ['people_lookup'] })).toEqual([])
  })
  it('the same family fact with NO tool this turn is flagged (soft)', () => {
    const v = classifyTurn('מור היא הבת של פפי', { userText: 'מי זאת מור?', groundedTools: [] })
    expect(v.some((x) => x.kind === 'UNGROUNDED_ENTITY' && x.severity === 'soft')).toBe(true)
  })
  it('a distress-menu produces a warm, list-free repair instruction', () => {
    const v = classifyTurn('רוצה שאתקשר? או רוצה שאשלח הודעה? או משהו אחר?', { userText: 'נפלתי' })
    const instr = buildClassifiedRepair(v)
    expect(instr).toBeTruthy()
    expect(instr).toContain('חום')
  })
})
