/*
 * 50 fixed Hebrew utterances covering the voice-pipeline surface:
 *   - reminders (medication, water, call, home, generic)
 *   - relative time ("בעוד X")
 *   - absolute time (HH:MM, "בשעה X", AM/PM ambiguity)
 *   - recurring ("כל יום", "כל שבוע")
 *   - appointments (full, time-only, person-only, missing date)
 *   - family relations (resolved, ambiguous, missing)
 *   - schedule queries
 *   - empty / nonsense utterances (negative cases)
 *
 * Reruns are deterministic: TODAY_ISO pins the relative-date base.
 */

export const TODAY_ISO = '2026-05-29'

export interface Fixture {
  id: string
  text: string
  expectIntent: 'reminder' | 'appointment' | 'schedule_query' | 'unknown'
}

export const VOICE_PIPELINE_FIXTURES: ReadonlyArray<Fixture> = [
  // ─── Reminders: medication ──────────────────────────────────────────
  { id: 'rem-med-01', text: 'תזכירי לי מחר בעשר בבוקר לקחת כדור',                 expectIntent: 'reminder' },
  { id: 'rem-med-02', text: 'תזכירי לי בעוד שעה לקחת את התרופה',                  expectIntent: 'reminder' },
  { id: 'rem-med-03', text: 'תזכירי לי כל יום בתשע בבוקר לקחת תרופה',              expectIntent: 'reminder' },
  { id: 'rem-med-04', text: 'תזכרי לי בערב לקחת ויטמינים',                         expectIntent: 'reminder' },
  { id: 'rem-med-05', text: 'תזכירי לי בעוד חצי שעה לקחת כדור לחץ דם',             expectIntent: 'reminder' },

  // ─── Reminders: water ───────────────────────────────────────────────
  { id: 'rem-water-01', text: 'תזכירי לי בעוד שעתיים לשתות מים',                  expectIntent: 'reminder' },
  { id: 'rem-water-02', text: 'תזכירי לי כל שעה לשתות מים',                       expectIntent: 'reminder' },
  { id: 'rem-water-03', text: 'תזכירי לי בעוד רבע שעה לשתות כוס מים',             expectIntent: 'reminder' },

  // ─── Reminders: calls (family resolution) ───────────────────────────
  { id: 'rem-call-01', text: 'תזכירי לי מחר בערב להתקשר לבעל של אופיר',           expectIntent: 'reminder' },
  { id: 'rem-call-02', text: 'תזכירי לי בעוד שעה להתקשר ללאו',                    expectIntent: 'reminder' },
  { id: 'rem-call-03', text: 'תזכירי לי כל יום שישי להתקשר למור',                 expectIntent: 'reminder' },
  { id: 'rem-call-04', text: 'תזכירי לי מחר להתקשר לבת של מור',                   expectIntent: 'reminder' },
  { id: 'rem-call-05', text: 'תזכירי לי בעוד עשרים דקות להתקשר לרופאה',           expectIntent: 'reminder' },

  // ─── Reminders: home ────────────────────────────────────────────────
  { id: 'rem-home-01', text: 'תזכירי לי בעוד חצי שעה להוציא את האוכל מהתנור',     expectIntent: 'reminder' },
  { id: 'rem-home-02', text: 'תזכירי לי הלילה לסגור את החלון',                    expectIntent: 'reminder' },
  { id: 'rem-home-03', text: 'תזכירי לי מחר בבוקר להשקות את הצמחים',              expectIntent: 'reminder' },

  // ─── Reminders: recurring ───────────────────────────────────────────
  { id: 'rem-rec-01', text: 'תזכירי לי כל יום בשמונה בבוקר לקחת תרופה',           expectIntent: 'reminder' },
  { id: 'rem-rec-02', text: 'תזכירי לי כל שבוע ביום ראשון לבדוק לחץ דם',          expectIntent: 'reminder' },
  { id: 'rem-rec-03', text: 'תזכירי לי כל בוקר לעשות הליכה',                      expectIntent: 'reminder' },

  // ─── Reminders: ambiguous / missing fields ──────────────────────────
  { id: 'rem-amb-01', text: 'תזכירי לי לקחת תרופה',                               expectIntent: 'reminder' },
  { id: 'rem-amb-02', text: 'תזכירי לי בשתיים לקחת תרופה',                        expectIntent: 'reminder' },
  { id: 'rem-amb-03', text: 'תזכירי לי מחר',                                      expectIntent: 'reminder' },

  // ─── Appointments: full ─────────────────────────────────────────────
  { id: 'app-full-01', text: 'תקבעי פגישה עם גלעד מחר בתשע בערב',                 expectIntent: 'appointment' },
  { id: 'app-full-02', text: 'יש לי פגישה עם הרופא מחר בעשר וחצי בבוקר',          expectIntent: 'appointment' },
  { id: 'app-full-03', text: 'תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים',       expectIntent: 'appointment' },
  { id: 'app-full-04', text: 'יש לי תור אצל התופרת מחר בשעה 10:32 ברחוב קוק 14 בהרצליה', expectIntent: 'appointment' },
  { id: 'app-full-05', text: 'תקבעי פגישה עם מור ביום שלישי בשמונה בבוקר',        expectIntent: 'appointment' },

  // ─── Appointments: AM/PM ambiguous ──────────────────────────────────
  { id: 'app-amb-01', text: 'מחר בשעה 2:34 יש לי תור אצל התופרת ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים', expectIntent: 'appointment' },
  { id: 'app-amb-02', text: 'יש לי פגישה בשלוש',                                  expectIntent: 'appointment' },

  // ─── Appointments: family relations ─────────────────────────────────
  { id: 'app-rel-01', text: 'תקבעי פגישה עם הבעל של אופיר מחר בתשע בערב',         expectIntent: 'appointment' },
  { id: 'app-rel-02', text: 'יש לי פגישה עם הבת של מור מחר בשתיים בצהריים',       expectIntent: 'appointment' },
  { id: 'app-rel-03', text: 'תקבעי פגישה עם הבן של מור ביום שני בשמונה בערב',     expectIntent: 'appointment' },
  { id: 'app-rel-04', text: 'יש לי פגישה עם בעלה של אופיר ביום שישי בעשר בבוקר',  expectIntent: 'appointment' },
  { id: 'app-rel-05', text: 'תקבעי פגישה עם האשה של פלוני מחר',                   expectIntent: 'appointment' },

  // ─── Appointments: missing fields ───────────────────────────────────
  { id: 'app-miss-01', text: 'תקבעי פגישה עם גלעד',                               expectIntent: 'appointment' },
  { id: 'app-miss-02', text: 'יש לי תור מחר',                                     expectIntent: 'appointment' },
  { id: 'app-miss-03', text: 'תקבעי פגישה בשתיים',                                expectIntent: 'appointment' },

  // ─── Schedule queries ───────────────────────────────────────────────
  { id: 'sq-01', text: 'מה יש לי היום',                                            expectIntent: 'schedule_query' },
  { id: 'sq-02', text: 'מה יש לי מחר',                                             expectIntent: 'schedule_query' },
  { id: 'sq-03', text: 'מה התוכניות שלי השבוע',                                    expectIntent: 'schedule_query' },
  { id: 'sq-04', text: 'מה קורה לי היום',                                          expectIntent: 'schedule_query' },

  // ─── Date variants ──────────────────────────────────────────────────
  { id: 'app-date-01', text: 'יש לי פגישה ביום ראשון ב-17.34',                    expectIntent: 'appointment' },
  { id: 'app-date-02', text: 'יש לי תור ב-30 במאי בעשר בבוקר',                    expectIntent: 'appointment' },
  { id: 'app-date-03', text: 'תקבעי פגישה ב-15 ביוני בשתיים בצהריים',             expectIntent: 'appointment' },

  // ─── Reminders: date variants ───────────────────────────────────────
  { id: 'rem-date-01', text: 'תזכירי לי ביום שישי בעשר בבוקר ללכת לרופא',         expectIntent: 'reminder' },
  { id: 'rem-date-02', text: 'תזכירי לי בעוד יומיים להתקשר למזכירה',              expectIntent: 'reminder' },

  // ─── Edge / negative cases ──────────────────────────────────────────
  { id: 'edge-01', text: '',                                                       expectIntent: 'unknown' },
  { id: 'edge-02', text: 'שלום, מה שלומך',                                         expectIntent: 'unknown' },
  { id: 'edge-03', text: 'תודה רבה',                                               expectIntent: 'unknown' },
  { id: 'edge-04', text: 'אני קצת עייפה היום',                                    expectIntent: 'unknown' },
]
