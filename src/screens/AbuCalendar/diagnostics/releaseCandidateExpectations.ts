/*
 * 30 release-candidate QA expectations.
 *
 * Each expectation defines what the voice pipeline MUST produce for a
 * given utterance. Used by:
 *   1. The text-pipeline golden tests (deterministic, no mic)
 *   2. The real-mic QA comparator (operator speaks → JSON → compare)
 *
 * Policy values:
 *   expectedDatePolicy: 'tomorrow' | 'today' | 'next_sunday' | 'any' | 'none'
 *   expectedPersonPolicy: 'none' | 'resolved:<name>' | 'ambiguous' | 'missing' | 'any_honest'
 *   expectedCardPolicy: 'confirm' | 'blocked' | 'query_no_card' | 'any'
 */

import type { QaExpectation } from './qaRunTypes'

export const RELEASE_CANDIDATE_EXPECTATIONS: QaExpectation[] = [
  // ── 1–4: midnight variants ────────────────────────────────────────
  {
    id: 'rc-01', utterance: 'מחר בחצות פגישה עם אופיר',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '00:00',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },
  {
    id: 'rc-02', utterance: 'מחר בחצות וחצי פגישה עם אופיר',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '00:30',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },
  {
    id: 'rc-03', utterance: 'מחר רבע לחצות פגישה עם אופיר',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '23:45',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },
  {
    id: 'rc-04', utterance: 'מחר רבע אחרי חצות פגישה עם אופיר',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '00:15',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },

  // ── 5–9: family relations ─────────────────────────────────────────
  {
    id: 'rc-05', utterance: 'תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '21:00',
    expectedRelationPolicy: 'הבעל של אופיר', expectedPersonPolicy: 'resolved:גלעד',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },
  {
    id: 'rc-06', utterance: 'תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '21:30',
    expectedRelationPolicy: 'אחות של ארי', expectedPersonPolicy: 'any_honest',
    expectedSaveAllowed: null, expectedCardPolicy: 'any', criticality: 'P1',
  },
  {
    id: 'rc-07', utterance: 'מחר בחמש אחר הצהריים פגישה עם הגרוש של מור',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '17:00',
    expectedRelationPolicy: 'הגרוש של מור', expectedPersonPolicy: 'resolved:רפי',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },
  {
    id: 'rc-08', utterance: 'מחר בשמונה בבוקר אני רוצה להיפגש עם אבא של אנאבל',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '08:00',
    expectedRelationPolicy: 'אבא של אנאבל', expectedPersonPolicy: 'ambiguous',
    expectedSaveAllowed: false, expectedCardPolicy: 'blocked', criticality: 'P0',
  },
  {
    id: 'rc-09', utterance: 'מחר בתשע וחצי בערב פגישה עם אופיר',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '21:30',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P1',
  },

  // ── 10–14: reminders ──────────────────────────────────────────────
  {
    id: 'rc-10', utterance: 'תזכירי לי בעוד שתי דקות לקחת כדור',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },
  {
    id: 'rc-11', utterance: 'בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P1',
  },
  {
    id: 'rc-12', utterance: 'תזכירי לי בעוד שעה ועשרים דקות להתקשר למשה',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },
  {
    id: 'rc-13', utterance: 'תזכירי לי בעוד 25 דקות לשתות מים',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P1',
  },
  {
    id: 'rc-14', utterance: 'בחצות וחצי תזכירי לי לקחת כדור',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: '00:30',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: null, expectedCardPolicy: 'any', criticality: 'P1',
  },

  // ── 15: doctor appointment ────────────────────────────────────────
  {
    id: 'rc-15', utterance: 'יש לי תור לרופא מחר בעשר בבוקר',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '10:00',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P0',
  },

  // ── 16–19: more reminders ─────────────────────────────────────────
  {
    id: 'rc-16', utterance: 'תזכירי לי בעוד שעה וחצי לבדוק כביסה',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P1',
  },
  {
    id: 'rc-17', utterance: 'כל יום בתשע בבוקר לקחת תרופה',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: null, expectedCardPolicy: 'any', criticality: 'P1',
  },
  {
    id: 'rc-18', utterance: 'תזכירי לי להתקשר לבעל של אופיר בערב',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: null,
    expectedRelationPolicy: 'present', expectedPersonPolicy: 'resolved:גלעד',
    expectedSaveAllowed: null, expectedCardPolicy: 'any', criticality: 'P1',
  },
  {
    id: 'rc-19', utterance: 'תזכירי לי להתקשר לחברה של מור בערב',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'any', expectedTime: null,
    // "החברה של מור" = Mor's partner Yael (RC4 partner alias) — resolved honestly.
    expectedRelationPolicy: 'present', expectedPersonPolicy: 'any_honest',
    expectedSaveAllowed: null, expectedCardPolicy: 'any', criticality: 'P1',
  },

  // ── 20–23: queries (no save) ──────────────────────────────────────
  {
    id: 'rc-20', utterance: 'מי הבעל של אופיר',
    expectedRoute: 'family_query', expectedDatePolicy: 'none', expectedTime: null,
    expectedRelationPolicy: 'present', expectedPersonPolicy: 'any_honest',
    expectedSaveAllowed: false, expectedCardPolicy: 'query_no_card', criticality: 'P0',
  },
  {
    id: 'rc-21', utterance: 'מי אחות של ארי',
    expectedRoute: 'family_query', expectedDatePolicy: 'none', expectedTime: null,
    expectedRelationPolicy: 'present', expectedPersonPolicy: 'any_honest',
    expectedSaveAllowed: false, expectedCardPolicy: 'query_no_card', criticality: 'P1',
  },
  {
    id: 'rc-22', utterance: 'מה התוכניות שלי השבוע',
    expectedRoute: 'schedule_query', expectedDatePolicy: 'none', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: false, expectedCardPolicy: 'query_no_card', criticality: 'P0',
  },
  {
    id: 'rc-23', utterance: 'מה יש לי מחר',
    expectedRoute: 'schedule_query', expectedDatePolicy: 'none', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: false, expectedCardPolicy: 'query_no_card', criticality: 'P0',
  },

  // ── 24–25: appointments ───────────────────────────────────────────
  {
    id: 'rc-24', utterance: 'תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'next_sunday', expectedTime: '14:00',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P1',
  },
  {
    id: 'rc-25', utterance: 'היום בחצות תזכירי לי לבדוק דלת',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'today', expectedTime: '00:00',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: null, expectedCardPolicy: 'any', criticality: 'P1',
  },

  // ── 26–28: blocked/ambiguous/minimal ──────────────────────────────
  {
    id: 'rc-26', utterance: 'קבעי לי פגישה',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'none', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: false, expectedCardPolicy: 'blocked', criticality: 'P0',
  },
  {
    id: 'rc-27', utterance: 'תזכירי לי לקחת כדור',
    expectedRoute: 'reminder_create', expectedDatePolicy: 'none', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: false, expectedCardPolicy: 'blocked', criticality: 'P0',
  },
  {
    id: 'rc-28', utterance: 'מחר בתשע פגישה עם אופיר',
    expectedRoute: 'appointment_create', expectedDatePolicy: 'tomorrow', expectedTime: '09:00',
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: true, expectedCardPolicy: 'confirm', criticality: 'P1',
  },

  // ── 29–30: cancel/confirm words ───────────────────────────────────
  {
    id: 'rc-29', utterance: 'ביטול',
    expectedRoute: 'unknown', expectedDatePolicy: 'none', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: false, expectedCardPolicy: 'query_no_card', criticality: 'P0',
  },
  {
    id: 'rc-30', utterance: 'כן',
    expectedRoute: 'unknown', expectedDatePolicy: 'none', expectedTime: null,
    expectedRelationPolicy: 'none', expectedPersonPolicy: 'none',
    expectedSaveAllowed: false, expectedCardPolicy: 'query_no_card', criticality: 'P0',
  },
]
