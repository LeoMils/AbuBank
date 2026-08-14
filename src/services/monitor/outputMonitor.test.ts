/*
 * outputMonitor.test.ts — M2 deterministic detectors (Layer 1, zero false-positive intent).
 * Each detector is proven to FIRE on the real device defect AND to stay quiet on a good answer.
 */
import { describe, it, expect } from 'vitest'
import {
  monitorTurn, detectLanguageImpurity, detectSourceNamed, detectTooLong,
  detectReadBack, detectLiteralCount, repairableViolations, buildRepairInstruction,
} from './outputMonitor'

describe('language purity', () => {
  it('flags a Latin run in a Hebrew turn; passes clean Hebrew (brands allowed)', () => {
    expect(detectLanguageImpurity('the weather is nice today outside', 'מה מזג האוויר?')?.kind).toBe('LANGUAGE_IMPURE')
    expect(detectLanguageImpurity('מזג האוויר נעים היום', 'מה מזג האוויר?')).toBeNull()
    expect(detectLanguageImpurity('הבושם Bleu de Chanel עולה 597 שקלים', 'כמה עולה בלו דה שאנל')).toBeNull() // brand tokens ok
  })
  it('flags Hebrew when the turn was Spanish', () => {
    expect(detectLanguageImpurity('היי מה שלומך', '¿cómo estás, Abu?')?.kind).toBe('LANGUAGE_IMPURE')
    expect(detectLanguageImpurity('todo bien, ¿y vos?', '¿cómo estás?')).toBeNull()
  })
})

describe('source named', () => {
  it('flags a URL/domain or a narrated lookup; passes a plain fact', () => {
    expect(detectSourceNamed('מצאתי את זה באתר seret.co.il')?.kind).toBe('SOURCE_NAMED')
    expect(detectSourceNamed('לפי גוגל יש היום גשם')?.kind).toBe('SOURCE_NAMED')
    expect(detectSourceNamed('היום צפוי גשם קל אחר הצהריים')).toBeNull()
  })
})

describe('length', () => {
  it('flags an over-long answer unless a story is allowed', () => {
    const long = 'מילה '.repeat(50)
    expect(detectTooLong(long)?.kind).toBe('TOO_LONG')
    expect(detectTooLong(long, true)).toBeNull()
    expect(detectTooLong('תשובה קצרה ונעימה')).toBeNull()
  })
})

describe('read-back', () => {
  it('flags echoing a long chunk of on-screen text', () => {
    const card = 'מור יקרה, אני חושבת עלייך היום המון ושולחת לך המון נשיקות וחיבוקים גדולים'
    expect(detectReadBack(`ההודעה מוכנה: ${card}`, card)?.kind).toBe('READ_BACK')
    expect(detectReadBack('ההודעה מוכנה, תלחצי שליחה', card)).toBeNull()
  })
})

describe('literal count', () => {
  it('flags counting 0..5 when asked 1..5; passes the correct sequence', () => {
    expect(detectLiteralCount('0, 1, 2, 3, 4, 5', 'תספרי מ-1 עד 5')?.kind).toBe('LITERAL_COUNT')
    expect(detectLiteralCount('1, 2, 3, 4, 5', 'תספרי מ-1 עד 5')).toBeNull()
    expect(detectLiteralCount('אחת, שתיים, שלוש', 'ספרי מ אחת עד שלוש')).toBeNull()
  })
})

describe('monitorTurn + repair decision', () => {
  it('a clean short Hebrew answer has no violations and no repair', () => {
    const vs = monitorTurn('מור היא הבת שלך, מרטיטה', { userText: 'מי זאת מור?' })
    expect(vs).toEqual([])
    expect(buildRepairInstruction(vs)).toBeNull()
  })
  it('a source-naming answer is a HARD violation and yields a repair instruction', () => {
    const vs = monitorTurn('לפי אתר seret.co.il יש היום שלושה סרטים', { userText: 'איזה סרטים רצים?' })
    expect(repairableViolations(vs).length).toBeGreaterThan(0)
    const instr = buildRepairInstruction(vs)
    expect(instr).toBeTruthy()
    expect(instr).toContain('מקור')
  })
  it('an over-long answer is SOFT — logged, never a repair', () => {
    const vs = monitorTurn('מילה '.repeat(50), { userText: 'ספרי לי' })
    expect(vs.some((v) => v.kind === 'TOO_LONG')).toBe(true)
    expect(repairableViolations(vs)).toEqual([])
  })
})
