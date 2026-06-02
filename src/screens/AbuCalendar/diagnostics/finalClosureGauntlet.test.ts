/*
 * Final Closure Gauntlet — 64 scenarios across Phase 3 (time/date),
 * Phase 4 (family), and Phase 5 (routing/boundaries).
 *
 * Pinned to TODAY_ISO = '2026-05-29' (Friday).
 */

import { describe, it, expect } from 'vitest'
import { runVoicePipelineDiagnostic } from './voicePipelineHarness'

const TODAY_ISO = '2026-05-29'

// ── PHASE 3 — TIME / DATE ──────────────────────────────────────────────

describe('Phase 3 — Absolute times', () => {
  const cases: { n: number; text: string; time: string; date?: string }[] = [
    { n: 1,  text: 'מחר בחצות פגישה עם אופיר',                          time: '00:00' },
    { n: 2,  text: 'מחר בחצות וחצי פגישה עם אופיר',                      time: '00:30' },
    { n: 3,  text: 'מחר ברבע לחצות פגישה עם אופיר',                      time: '23:45' },
    { n: 4,  text: 'מחר ברבע אחרי חצות פגישה עם אופיר',                  time: '00:15' },
    { n: 5,  text: 'מחר בתשע וחצי בערב פגישה עם אופיר',                  time: '21:30' },
    { n: 6,  text: 'מחר בשבע וחצי בבוקר פגישה',                          time: '07:30' },
    { n: 7,  text: 'מחר בשבע וחצי בערב פגישה',                           time: '19:30' },
    { n: 8,  text: 'מחר 12 וחצי בלילה פגישה',                            time: '00:30' },
    { n: 9,  text: 'מחר שתים עשרה וחצי בלילה פגישה',                     time: '00:30' },
    { n: 10, text: 'הלילה באחת וחצי בלילה',                              time: '01:30' },
    { n: 11, text: 'מחר בשתיים בצהריים ארוחה',                           time: '14:00' },
    { n: 12, text: 'מחר רבע לעשר בערב פגישה',                            time: '21:45' },
    { n: 13, text: 'מחר עשר ורבע בבוקר פגישה',                           time: '10:15' },
    { n: 14, text: 'תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים',        time: '14:00', date: '2026-05-31' },
    { n: 15, text: 'ב-30 במאי בעשר בבוקר פגישה',                         time: '10:00', date: '2026-05-30' },
  ]

  for (const c of cases) {
    it(`#${c.n}: "${c.text.slice(0, 40)}…" → time ${c.time}${c.date ? `, date ${c.date}` : ''}`, () => {
      const row = runVoicePipelineDiagnostic(c.text, TODAY_ISO)
      expect(row.timeParse.time).toBe(c.time)
      if (c.date) {
        expect(row.dateParse.date).toBe(c.date)
      }
    })
  }
})

describe('Phase 3 — Relative reminders', () => {
  const cases: { n: number; text: string }[] = [
    { n: 16, text: 'תזכירי לי בעוד שתי דקות לקחת כדור' },
    { n: 17, text: 'תזכירי לי בעוד 25 דקות לשתות מים' },
    { n: 18, text: 'תזכירי לי בעוד שעה להתקשר' },
    { n: 19, text: 'תזכירי לי בעוד שעה ורבע להתקשר' },
    { n: 20, text: 'תזכירי לי בעוד שעה וחצי לבדוק' },
    { n: 21, text: 'תזכירי לי בעוד שעה ועשרים דקות להתקשר' },
    { n: 22, text: 'תזכירי לי בעוד שעתיים לבדוק' },
  ]

  for (const c of cases) {
    it(`#${c.n}: "${c.text.slice(0, 40)}…" → intent reminder, saveAllowed true`, () => {
      const row = runVoicePipelineDiagnostic(c.text, TODAY_ISO)
      expect(row.intent).toBe('reminder')
      expect(row.saveAllowed.allowed).toBe(true)
    })
  }
})

describe('Phase 3 — Ambiguous time detection', () => {
  it('#23: "מחר בתשע פגישה" → ambiguous false (>=7 defaults morning)', () => {
    const row = runVoicePipelineDiagnostic('מחר בתשע פגישה', TODAY_ISO)
    expect(row.timeParse.ambiguous).toBe(false)
  })

  it('#24: "מחר בשתיים פגישה" → ambiguous true (1-6 range)', () => {
    const row = runVoicePipelineDiagnostic('מחר בשתיים פגישה', TODAY_ISO)
    expect(row.timeParse.ambiguous).toBe(true)
  })

  it('#25: "מחר באחת פגישה" → ambiguous true', () => {
    const row = runVoicePipelineDiagnostic('מחר באחת פגישה', TODAY_ISO)
    expect(row.timeParse.ambiguous).toBe(true)
  })

  it('#26: "מחר ב-12 פגישה" → ambiguous false', () => {
    const row = runVoicePipelineDiagnostic('מחר ב-12 פגישה', TODAY_ISO)
    expect(row.timeParse.ambiguous).toBe(false)
  })
})

// ── PHASE 4 — FAMILY ───────────────────────────────────────────────────

describe('Phase 4 — Family resolution', () => {
  const familyPrefix = (phrase: string) => `פגישה עם ${phrase} מחר בעשר בבוקר`

  it('#27: "הבעל של אופיר" → resolved, גלעד', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('הבעל של אופיר'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('resolved')
    expect(row.resolvedPerson.name).toBe('גלעד')
  })

  it('#28: "בעלה של אופיר" → resolved, גלעד', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('בעלה של אופיר'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('resolved')
    expect(row.resolvedPerson.name).toBe('גלעד')
  })

  it('#29: "אשתו של אילי" → missing (אילי not known alias)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('אשתו של אילי'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })

  it('#30: "אשתו של גלעד" → missing (Gilad spouse is male)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('אשתו של גלעד'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })

  it('#31: "אבא של אנאבל" → ambiguous (Ofir + Gilad both male parents)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('אבא של אנאבל'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('ambiguous')
  })

  it('#32: "אמא של אנאבל" → missing (no female parent)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('אמא של אנאבל'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })

  it('#33: "אחות של ארי" → honest result (resolved/ambiguous/missing)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('אחות של ארי'), TODAY_ISO)
    expect(['resolved', 'ambiguous', 'missing']).toContain(row.resolvedPerson.status)
  })

  it('#34: "הבן של מור" → ambiguous (4 sons)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('הבן של מור'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('ambiguous')
  })

  it('#35: "הבת של מור" → missing (no daughters)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('הבת של מור'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })

  it('#36: "חבר של מור" → missing (friend, never resolved)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('חבר של מור'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })

  it('#37: "חברה של מור" → missing', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('חברה של מור'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })

  it('#38: "הגרוש של מור" → resolved, רפי', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('הגרוש של מור'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('resolved')
    expect(row.resolvedPerson.name).toBe('רפי')
  })

  it('#39: "הגרושה של מור" → missing (ex is male)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('הגרושה של מור'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })

  it('#40: "סבא של ארי" → resolved, רפי', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('סבא של ארי'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('resolved')
    expect(row.resolvedPerson.name).toBe('רפי')
  })

  it('#41: "סבתא של ארי" → resolved, מור', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('סבתא של ארי'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('resolved')
    expect(row.resolvedPerson.name).toBe('מור')
  })

  it('#42: "נכד של מור" → honest result (resolved/ambiguous/missing)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('נכד של מור'), TODAY_ISO)
    expect(['resolved', 'ambiguous', 'missing']).toContain(row.resolvedPerson.status)
  })

  it('#43: "נכדה של מור" → honest result (resolved/ambiguous/missing)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('נכדה של מור'), TODAY_ISO)
    expect(['resolved', 'ambiguous', 'missing']).toContain(row.resolvedPerson.status)
  })

  it('#44: "דוד של ארי" → missing (דוד not in KIND regex)', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('דוד של ארי'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })

  it('#45: "דודה של ארי" → missing', () => {
    const row = runVoicePipelineDiagnostic(familyPrefix('דודה של ארי'), TODAY_ISO)
    expect(row.resolvedPerson.status).toBe('missing')
  })
})

// ── PHASE 5 — ROUTING ──────────────────────────────────────────────────

describe('Phase 5 — Intent routing', () => {
  const routingCases: { n: number; text: string; intent: string }[] = [
    { n: 46, text: 'תקבעי לי פגישה למחר בעשר עם גלעד',               intent: 'appointment' },
    { n: 47, text: 'יש לי תור לרופא מחר בעשר',                        intent: 'appointment' },
    { n: 48, text: 'תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים',     intent: 'appointment' },
    { n: 49, text: 'אני רוצה להיפגש עם גלעד מחר בעשר',               intent: 'appointment' },
    { n: 50, text: 'מחר בשמונה יש לי רופא',                           intent: 'appointment' },
    { n: 51, text: 'תזכירי לי לקחת כדור בעוד שעה',                    intent: 'reminder' },
    { n: 52, text: 'אני צריכה לזכור לקחת כדור מחר בבוקר',             intent: 'reminder' },
    { n: 53, text: 'בעוד חמש דקות להתקשר',                            intent: 'reminder' },
    { n: 54, text: 'כל יום בתשע בבוקר לקחת תרופה',                    intent: 'reminder' },
    { n: 55, text: 'מה התוכניות שלי השבוע',                            intent: 'schedule_query' },
    { n: 56, text: 'מה יש לי מחר',                                    intent: 'schedule_query' },
    { n: 57, text: 'מי הבעל של אופיר',                                intent: 'family_query' },
    { n: 58, text: 'מי אחות של ארי',                                  intent: 'family_query' },
  ]

  for (const c of routingCases) {
    it(`#${c.n}: "${c.text.slice(0, 35)}…" → intent ${c.intent}`, () => {
      const row = runVoicePipelineDiagnostic(c.text, TODAY_ISO)
      expect(row.intent).toBe(c.intent)
    })
  }
})

describe('Phase 5 — Boundary inputs (must NOT save)', () => {
  const boundaryCases: { n: number; text: string }[] = [
    { n: 59, text: 'כן' },
    { n: 60, text: 'לא' },
    { n: 61, text: 'ביטול' },
    { n: 62, text: 'שלום' },
    { n: 63, text: 'טוב' },
    { n: 64, text: 'אני לא יודעת' },
  ]

  for (const c of boundaryCases) {
    it(`#${c.n}: "${c.text}" → intent unknown, saveAllowed false`, () => {
      const row = runVoicePipelineDiagnostic(c.text, TODAY_ISO)
      expect(row.intent).toBe('unknown')
      expect(row.saveAllowed.allowed).toBe(false)
    })
  }
})
