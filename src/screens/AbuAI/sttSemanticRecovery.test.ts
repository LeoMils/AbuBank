/**
 * Hebrew STT Semantic Recovery — 40+ mistake cases.
 * Each asserts the repair (or, when context is absent, the safe preservation),
 * that a correction is logged with a reason, and that no new meaning is invented.
 */
import { describe, it, expect } from 'vitest'
import { recoverHebrewStt } from './sttSemanticRecovery'

// [input, mustContain, mustNotContain?, expectCorrection]
type Case = [string, string, string | null, boolean]

const RENTAL = 'פגישה עם אלכסנדרה על השכירות של הבית והדיירים'

const CASES: Case[] = [
  // ── שכירות non-word phonetic neighbours (always corrected) ──
  ['לדבר על זכירות הבית', 'שכירות', 'זכירות', true],
  ['לדבר על שחירות הבית', 'שכירות', 'שחירות', true],
  ['לדבר על סחירות הבית', 'שכירות', 'סחירות', true],
  ['חוזה שכירת הדירה', 'שכירות', null, true],
  ['זכירות', 'שכירות', 'זכירות', true],
  ['שחירות', 'שכירות', 'שחירות', true],
  ['סחירות', 'שכירות', 'סחירות', true],
  ['נדבר על השחירות מחר', 'שכירות', 'שחירות', true],
  ['הסחירות של הבית', 'שכירות', 'סחירות', true],
  ['בקשר לזכירות החדשה', 'שכירות', 'זכירות', true],
  // ── "הזכיר שכירות" → "השכירות" (context-gated) ──
  [`${RENTAL} לדבר על הזכיר שכירות`, 'השכירות', 'הזכיר שכירות', true],
  ['פגישה עם אלכסנדרה על הזכיר שכירות של הבית', 'השכירות', 'הזכיר שכירות', true],
  ['לסגור את הזכיר שכירות לפני שהדיירים נכנסים', 'השכירות', 'הזכיר שכירות', true],
  // negative: "הזכיר" with NO rental context stays (could be the real verb)
  ['הוא הזכיר לי משהו', 'הזכיר', null, false],
  // ── "אחר צהריים" → "אחר הצהריים" (always) ──
  ['פגישה מחר אחר צהריים', 'אחר הצהריים', null, true],
  ['בשלוש אחר צהריים', 'אחר הצהריים', null, true],
  ['אחרי צהריים נקבע', 'אחרי הצהריים', null, true],
  ['תקבעי משהו אחר צהריים עם מור', 'אחר הצהריים', null, true],
  // already-correct stays untouched, no correction logged
  ['פגישה מחר אחר הצהריים', 'אחר הצהריים', null, false],
  ['בשבע בערב', 'בשבע בערב', null, false],
  // ── venue repairs ──
  ['ניפגש בקפה גרג ב רעננה', 'קפה גרג ברעננה', null, true],
  ['קפה גריג ברעננה', 'קפה גרג', 'גריג', true],
  ['בקפה גרג ברעננה', 'קפה גרג ברעננה', null, false],
  // ── tenants spelling ──
  ['לפני שהדירים נכנסים', 'הדיירים', null, true],
  ['הדירים החדשים מגיעים', 'הדיירים', null, true],
  ['הדיירים החדשים', 'הדיירים', null, false],
  // ── combined hostile sentences ──
  ['מחר אחר צהריים נדבר על שחירות הבית עם אלכסנדרה', 'אחר הצהריים', 'שחירות', true],
  ['פגישה עם אלכסנדרה בקפה גריג ב רעננה על זכירות הבית', 'שכירות', 'זכירות', true],
  ['לסגור את הזכיר שכירות בבית עם הדירים החדשים', 'השכירות', 'הזכיר שכירות', true],
  ['בשלוש אחר צהריים עם מור על שחירות', 'אחר הצהריים', 'שחירות', true],
  // ── clean inputs: no change, no false corrections ──
  ['תקבעי לי פגישה עם מור מחר בשבע בערב', 'פגישה עם מור', null, false],
  ['מה יש לי היום', 'מה יש לי היום', null, false],
  ['מי זאת מור', 'מי זאת מור', null, false],
  ['פגישה עם אלכסנדרה על השכירות', 'השכירות', null, false],
  ['קבעי תור לרופא מחרתיים', 'רופא', null, false],
  ['יום הולדת לנועם בשבוע הבא', 'נועם', null, false],
  ['ארוחת ערב עם המשפחה', 'משפחה', null, false],
  ['לדבר על הטיול לאיטליה', 'איטליה', null, false],
  ['נקבע משהו לפני הטיסה', 'הטיסה', null, false],
  ['בדיקות אצל הרופאה', 'בדיקות', null, false],
  ['פגישה עם אופיר על החתונה', 'חתונה', null, false],
]

describe('recoverHebrewStt — 40+ Hebrew STT mistake cases', () => {
  it.each(CASES)('"%s" → contains "%s"', (input, mustContain, mustNot, expectCorrection) => {
    const r = recoverHebrewStt(input)
    expect(r.text).toContain(mustContain)
    if (mustNot) expect(r.text).not.toContain(mustNot)
    if (expectCorrection) {
      expect(r.corrections.length).toBeGreaterThan(0)
      // every correction names what was heard, what it became, and why
      for (const c of r.corrections) {
        expect(c.heard).toBeTruthy()
        expect(c.understoodAs).toBeTruthy()
        expect(c.reason).toBeTruthy()
      }
    } else {
      expect(r.corrections.length).toBe(0)
    }
  })

  it('never invents meaning when there is no anchor (clean text is identity)', () => {
    const clean = 'תקבעי לי פגישה עם מור מחר בשבע בערב בהוד השרון'
    const r = recoverHebrewStt(clean)
    expect(r.text).toBe(clean)
    expect(r.corrections).toHaveLength(0)
    expect(r.confidencePenalty).toBe(0)
  })

  it('context-gated guesses carry a confidence penalty', () => {
    const r = recoverHebrewStt('פגישה עם אלכסנדרה על הזכיר שכירות של הבית והדיירים')
    expect(r.confidencePenalty).toBeGreaterThan(0)
  })
})
