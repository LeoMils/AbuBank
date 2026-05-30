/*
 * 200+ fixed Hebrew utterances covering the voice-pipeline surface:
 *   - reminders (medication, water, call, home, generic)
 *   - relative time ("בעוד X")
 *   - absolute time (HH:MM, "בשעה X", AM/PM ambiguity)
 *   - recurring ("כל יום", "כל שבוע")
 *   - appointments (full, time-only, person-only, missing date)
 *   - family relations (resolved, ambiguous, missing)
 *   - schedule queries
 *   - self-correction utterances ("X סליחה Y")
 *   - free/noisy speech with fillers
 *   - edge / ambiguous cases
 *   - empty / nonsense utterances (negative cases)
 *
 * Reruns are deterministic: TODAY_ISO pins the relative-date base.
 */

export const TODAY_ISO = '2026-05-29'

export interface Fixture {
  id: string
  text: string
  expectIntent: 'reminder' | 'appointment' | 'schedule_query' | 'family_query' | 'unknown'
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

  // ══════════════════════════════════════════════════════════════════════
  //  A. More appointments (30+)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'app-a-01', text: 'פגישה עם אופיר מחר בערב',                              expectIntent: 'appointment' },
  { id: 'app-a-02', text: 'יש לי רופא שיניים ביום חמישי בבוקר',                   expectIntent: 'appointment' },
  { id: 'app-a-03', text: 'קבעי לי בדיקה ביום ראשון בשמונה בבוקר',                expectIntent: 'appointment' },
  { id: 'app-a-04', text: 'תוסיפי לי תור ביום שני בעשר וחצי',                    expectIntent: 'appointment' },
  { id: 'app-a-05', text: 'תרשמי פגישה עם גלעד מחרתיים בערב',                    expectIntent: 'appointment' },
  { id: 'app-a-06', text: 'מחר ב-21 וחצי פגישה עם אופיר',                        expectIntent: 'appointment' },
  { id: 'app-a-07', text: 'ביום שישי בעשר ורבע רופא',                             expectIntent: 'appointment' },
  { id: 'app-a-08', text: 'יש לי תור לרופא שיניים ביום שלישי בשתיים',             expectIntent: 'appointment' },
  { id: 'app-a-09', text: 'תוסיפי תור לרופא עיניים ביום חמישי',                   expectIntent: 'appointment' },
  { id: 'app-a-10', text: 'יש לי פגישה עם יועץ מס ב-15 ביוני בעשר',              expectIntent: 'appointment' },
  { id: 'app-a-11', text: 'תרשמי לי תור לדנטיסט מחר בתשע',                       expectIntent: 'appointment' },
  { id: 'app-a-12', text: 'יש לי דיקור ביום ראשון בארבע בצהריים',                 expectIntent: 'appointment' },
  { id: 'app-a-13', text: 'קבעי פגישה עם עורך דין ב-5 ביוני בשתיים',             expectIntent: 'appointment' },
  { id: 'app-a-14', text: 'יש לי פגישה עם הנכדה של מור',                          expectIntent: 'appointment' },
  { id: 'app-a-15', text: 'יש לי בדיקת דם מחר בשמונה בבוקר',                     expectIntent: 'appointment' },
  { id: 'app-a-16', text: 'תקבעי פגישה מחרתיים בשלוש בצהריים',                   expectIntent: 'appointment' },
  { id: 'app-a-17', text: 'יש לי תור לאורטופד ביום שני בשעה אחת עשרה',            expectIntent: 'appointment' },
  { id: 'app-a-18', text: 'קבעי לי פגישה עם ארי ביום חמישי בשש בערב',            expectIntent: 'appointment' },
  { id: 'app-a-19', text: 'יש לי תור לרופא עור מחרתיים בעשר בבוקר',              expectIntent: 'appointment' },
  { id: 'app-a-20', text: 'תקבעי לי עם מירטה מחר בשתים בצהריים',                 expectIntent: 'appointment' },
  { id: 'app-a-21', text: 'יש לי פגישה ביום שלישי בשבע בערב',                    expectIntent: 'appointment' },
  { id: 'app-a-22', text: 'תרשמי לי תור לקרדיולוג ב-20 ביוני בתשע בבוקר',        expectIntent: 'appointment' },
  { id: 'app-a-23', text: 'יש לי פגישה עם ילדים מחר בשתים עשרה בצהריים',         expectIntent: 'appointment' },
  { id: 'app-a-24', text: 'קבעי לי בדיקת עיניים ביום רביעי בשעה עשר',            expectIntent: 'appointment' },
  { id: 'app-a-25', text: 'יש לי תור אצל הפיזיותרפיסט ביום חמישי בשתיים',        expectIntent: 'appointment' },
  { id: 'app-a-26', text: 'תוסיפי פגישה ביום שישי בבוקר',                        expectIntent: 'appointment' },
  { id: 'app-a-27', text: 'יש לי רופא שיניים ביום ראשון בעשר',                    expectIntent: 'appointment' },
  { id: 'app-a-28', text: 'קבעי לי עם עילי ביום שני בשמונה בערב',                 expectIntent: 'appointment' },
  { id: 'app-a-29', text: 'יש לי בדיקת דם ביום חמישי בשבע בבוקר',                expectIntent: 'appointment' },
  { id: 'app-a-30', text: 'תרשמי לי פגישה עם הנכד ביום ראשון בצהריים',           expectIntent: 'appointment' },

  // ══════════════════════════════════════════════════════════════════════
  //  B. More reminders (30+)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'rem-b-01', text: 'עוד עשר דקות להזכיר לי מים',                          expectIntent: 'reminder' },
  { id: 'rem-b-02', text: 'תזכירי לי כל ערב בשמונה לקחת תרופה',                  expectIntent: 'reminder' },
  { id: 'rem-b-03', text: 'בעוד שעה וחצי לבדוק כביסה',                           expectIntent: 'reminder' },
  { id: 'rem-b-04', text: 'תזכירי לי בעוד רבע שעה להתקשר לאופיר',               expectIntent: 'reminder' },
  { id: 'rem-b-05', text: 'כל ערב בעשר לקחת תרופת לחץ דם',                       expectIntent: 'reminder' },
  { id: 'rem-b-06', text: 'תזכירי לי מחר בבוקר להשקות פרחים',                    expectIntent: 'reminder' },
  { id: 'rem-b-07', text: 'תזכירי לי בעוד שתי דקות לקחת כדור',                   expectIntent: 'reminder' },
  { id: 'rem-b-08', text: 'אני צריכה לזכור מחר לקחת כדור',                       expectIntent: 'reminder' },
  { id: 'rem-b-09', text: 'תזכורת להתקשר לרופא ביום שני',                        expectIntent: 'reminder' },
  { id: 'rem-b-10', text: 'כל שבת בשתים עשרה בצהריים לבדוק לחץ דם',             expectIntent: 'reminder' },
  { id: 'rem-b-11', text: 'תזכירי לי בעוד עשרים דקות לקחת ויטמינים',             expectIntent: 'reminder' },
  { id: 'rem-b-12', text: 'תזכירי לי מחר בשש לקחת אנטיביוטיקה',                  expectIntent: 'reminder' },
  { id: 'rem-b-13', text: 'תזכירי לי כל יום שלישי בשבע בבוקר לקחת גלולה',        expectIntent: 'reminder' },
  { id: 'rem-b-14', text: 'תזכירי לי בעוד שלושים דקות לכבות את התנור',            expectIntent: 'reminder' },
  { id: 'rem-b-15', text: 'תזכירי לי הלילה בתשע לקחת כדור',                      expectIntent: 'reminder' },
  { id: 'rem-b-16', text: 'כל יום שישי בשתיים לצלצל לאופיר',                     expectIntent: 'reminder' },
  { id: 'rem-b-17', text: 'תזכירי לי ביום ראשון בתשע בבוקר לקחת תרופה',          expectIntent: 'reminder' },
  { id: 'rem-b-18', text: 'תזכירי לי בעוד חמש דקות לשתות כוס מים',               expectIntent: 'reminder' },
  { id: 'rem-b-19', text: 'תזכורת לבדוק לחץ דם מחר בבוקר',                       expectIntent: 'reminder' },
  { id: 'rem-b-20', text: 'תזכירי לי בעוד שעה וחצי לבדוק את הסיר',              expectIntent: 'reminder' },
  { id: 'rem-b-21', text: 'תזכירי לי כל בוקר בשמונה לשתות מים',                  expectIntent: 'reminder' },
  { id: 'rem-b-22', text: 'תזכירי לי מחר בצהריים להתקשר לנועם',                  expectIntent: 'reminder' },
  { id: 'rem-b-23', text: 'תזכירי לי ביום שני להתקשר לעדי',                      expectIntent: 'reminder' },
  { id: 'rem-b-24', text: 'בעוד עשרים דקות להוציא מהמקרר',                       expectIntent: 'reminder' },
  { id: 'rem-b-25', text: 'תזכירי לי לפני שישי לארגן אוכל',                      expectIntent: 'reminder' },
  { id: 'rem-b-26', text: 'תזכירי לי בעוד שעתיים לשתות מים',                     expectIntent: 'reminder' },
  { id: 'rem-b-27', text: 'תזכורת לקחת כדור לחץ דם בכל ערב',                     expectIntent: 'reminder' },
  { id: 'rem-b-28', text: 'תזכירי לי מחרתיים בשעה שלוש להתקשר לעורך דין',        expectIntent: 'reminder' },
  { id: 'rem-b-29', text: 'תזכירי לי כל שבוע ביום שישי להתקשר למור',             expectIntent: 'reminder' },
  { id: 'rem-b-30', text: 'תזכירי לי בעוד ארבעים דקות לצאת לטיול',               expectIntent: 'reminder' },

  // ══════════════════════════════════════════════════════════════════════
  //  C. More schedule queries (15+)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'sq-c-01', text: 'יש לי משהו השבוע',                                       expectIntent: 'schedule_query' },
  { id: 'sq-c-02', text: 'יש לי משהו היום בערב',                                   expectIntent: 'schedule_query' },
  { id: 'sq-c-03', text: 'מה יש לי ביום שישי',                                     expectIntent: 'schedule_query' },
  { id: 'sq-c-04', text: 'מה מתוכנן לי מחר בבוקר',                                expectIntent: 'schedule_query' },
  { id: 'sq-c-05', text: 'תראי לי את השבוע',                                       expectIntent: 'unknown' },
  { id: 'sq-c-06', text: 'מה יש לי מחרתיים',                                       expectIntent: 'schedule_query' },
  { id: 'sq-c-07', text: 'מה יש לי ביום ראשון',                                    expectIntent: 'schedule_query' },
  { id: 'sq-c-08', text: 'מה בלוח השנה שלי',                                       expectIntent: 'unknown' },
  { id: 'sq-c-09', text: 'מה יש לי השבוע הבא',                                     expectIntent: 'schedule_query' },
  { id: 'sq-c-10', text: 'יש לי משהו מחר',                                         expectIntent: 'schedule_query' },
  { id: 'sq-c-11', text: 'מה יש לי היום',                                           expectIntent: 'schedule_query' },
  { id: 'sq-c-12', text: 'מתי יש לי תור',                                           expectIntent: 'schedule_query' },
  { id: 'sq-c-13', text: 'מה קורה לי מחר',                                          expectIntent: 'schedule_query' },
  { id: 'sq-c-14', text: 'מה יש לי ביום חמישי',                                    expectIntent: 'schedule_query' },
  { id: 'sq-c-15', text: 'מה התוכנית שלי היום',                                    expectIntent: 'schedule_query' },

  // ══════════════════════════════════════════════════════════════════════
  //  D. More family relation phrases (15+)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'rel-d-01', text: 'תקבעי פגישה עם הנכד של מור מחר',                        expectIntent: 'appointment' },
  { id: 'rel-d-02', text: 'תזכירי לי להתקשר לאחות של ארי בערב',                   expectIntent: 'reminder' },
  { id: 'rel-d-03', text: 'יש לי פגישה עם בן הזוג של אופיר מחר בבוקר',            expectIntent: 'appointment' },
  { id: 'rel-d-04', text: 'תזכירי לי להתקשר לבן של מור ביום ראשון',               expectIntent: 'reminder' },
  { id: 'rel-d-05', text: 'תקבעי פגישה עם הנכדה של מור מחר בצהריים',              expectIntent: 'appointment' },
  { id: 'rel-d-06', text: 'יש לי פגישה עם הבת של לאו ביום שישי',                  expectIntent: 'appointment' },
  { id: 'rel-d-07', text: 'תזכירי לי להתקשר לאשה של עילי מחר',                    expectIntent: 'reminder' },
  { id: 'rel-d-08', text: 'קבעי פגישה עם הבן של לאו ביום שני בשש',               expectIntent: 'appointment' },
  { id: 'rel-d-09', text: 'יש לי פגישה עם אשת עילי ביום רביעי',                   expectIntent: 'appointment' },
  { id: 'rel-d-10', text: 'תזכירי לי להתקשר לנכד של לאו',                         expectIntent: 'reminder' },
  { id: 'rel-d-11', text: 'קבעי לי עם בעל של אופיר מחרתיים בעשר',                 expectIntent: 'appointment' },
  { id: 'rel-d-12', text: 'יש לי פגישה עם הנכדה של לאו ביום חמישי',               expectIntent: 'appointment' },
  { id: 'rel-d-13', text: 'תזכירי לי להתקשר לבעל של אופיר ביום שישי',             expectIntent: 'reminder' },
  { id: 'rel-d-14', text: 'תקבעי פגישה עם הבן של מור ביום שני בשבע',              expectIntent: 'appointment' },
  { id: 'rel-d-15', text: 'יש לי פגישה עם הנכד של לאו מחר בצהריים',              expectIntent: 'appointment' },

  // ══════════════════════════════════════════════════════════════════════
  //  E. Self-correction utterances (15+)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'corr-e-01', text: 'מחר בתשע סליחה בעשר לקחת כדור',                       expectIntent: 'reminder' },
  { id: 'corr-e-02', text: 'בעוד שעה לא בעוד שעתיים להתקשר למשה',                expectIntent: 'reminder' },
  { id: 'corr-e-03', text: 'מחר לא מחרתיים פגישה עם אופיר',                       expectIntent: 'appointment' },
  { id: 'corr-e-04', text: 'ביום ראשון לא ביום שני רופא',                          expectIntent: 'appointment' },
  { id: 'corr-e-05', text: 'עם אופיר בעצם עם גלעד מחר בתשע',                      expectIntent: 'unknown' },
  { id: 'corr-e-06', text: 'תזכירי לי מחר בשש לא בשבע לקחת כדור',                expectIntent: 'reminder' },
  { id: 'corr-e-07', text: 'תקבעי פגישה ביום שני סליחה ביום שלישי בשעה עשר',     expectIntent: 'appointment' },
  { id: 'corr-e-08', text: 'תזכירי לי בעוד עשרים דקות סליחה בעוד שלושים דקות לשתות מים', expectIntent: 'reminder' },
  { id: 'corr-e-09', text: 'יש לי תור בשתיים בעצם בשלוש בצהריים',                expectIntent: 'appointment' },
  { id: 'corr-e-10', text: 'פגישה עם מור מחר סליחה מחרתיים בצהריים',             expectIntent: 'appointment' },
  { id: 'corr-e-11', text: 'תזכירי לי בשש בבוקר לא בשבע לקחת תרופה',             expectIntent: 'reminder' },
  { id: 'corr-e-12', text: 'בעוד חמש דקות סליחה בעוד עשר דקות להוציא מהתנור',    expectIntent: 'reminder' },
  { id: 'corr-e-13', text: 'ביום חמישי סליחה ביום שישי יש לי תור לרופא',          expectIntent: 'appointment' },
  { id: 'corr-e-14', text: 'תקבעי ביום ראשון בתשע לא בעשר פגישה עם גלעד',        expectIntent: 'appointment' },
  { id: 'corr-e-15', text: 'תזכירי לי ביום שני בבוקר תיקון ביום שני בערב לקחת כדור', expectIntent: 'reminder' },

  // ══════════════════════════════════════════════════════════════════════
  //  F. Free / noisy speech with fillers (15+)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'noisy-f-01', text: 'אני צריכה שתעזרי לי לזכור מחר לקחת כדור',            expectIntent: 'reminder' },
  { id: 'noisy-f-02', text: 'טוב אז מחר בעשר יש לי תור',                          expectIntent: 'appointment' },
  { id: 'noisy-f-03', text: 'רגע תזכירי לי בעוד שתי דקות להתקשר',                expectIntent: 'reminder' },
  { id: 'noisy-f-04', text: 'אממ קבעי לי עם אופיר מחר',                            expectIntent: 'appointment' },
  { id: 'noisy-f-05', text: 'עוד עשר דקות להזכיר לי מים',                         expectIntent: 'reminder' },
  { id: 'noisy-f-06', text: 'אל תשכחי, מחר בתשע יש לי רופא',                     expectIntent: 'appointment' },
  { id: 'noisy-f-07', text: 'תשמעי, תזכירי לי בערב לקחת תרופה',                  expectIntent: 'reminder' },
  { id: 'noisy-f-08', text: 'רגע רגע, יש לי תור ביום חמישי בשעה עשר',            expectIntent: 'appointment' },
  { id: 'noisy-f-09', text: 'אוקיי תזכירי לי בעוד שעה להתקשר לאופיר',            expectIntent: 'reminder' },
  { id: 'noisy-f-10', text: 'כן כן, תקבעי פגישה עם גלעד מחר',                    expectIntent: 'appointment' },
  { id: 'noisy-f-11', text: 'בקיצור יש לי בדיקה ביום שני בבוקר',                 expectIntent: 'appointment' },
  { id: 'noisy-f-12', text: 'אה כן, תזכירי לי בעוד רבע שעה להוציא אוכל מהתנור', expectIntent: 'reminder' },
  { id: 'noisy-f-13', text: 'שמעי, מחר בשתים יש לי פגישה עם מור',                expectIntent: 'appointment' },
  { id: 'noisy-f-14', text: 'תחכי תחכי, תזכירי לי בשמונה בערב לסגור את הדלת',   expectIntent: 'reminder' },
  { id: 'noisy-f-15', text: 'אני חושבת שיש לי תור ביום ראשון בבוקר',              expectIntent: 'appointment' },

  // ══════════════════════════════════════════════════════════════════════
  //  G. Edge / ambiguous cases (15+)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'edge-g-01', text: 'בשתיים',                                               expectIntent: 'unknown' },
  { id: 'edge-g-02', text: 'תשע',                                                  expectIntent: 'unknown' },
  { id: 'edge-g-03', text: 'מחר',                                                  expectIntent: 'unknown' },
  { id: 'edge-g-04', text: 'תקבעי',                                                expectIntent: 'appointment' },
  { id: 'edge-g-05', text: '12 בלילה פגישה עם גלעד',                               expectIntent: 'appointment' },
  { id: 'edge-g-06', text: '12 בצהריים תור לרופא',                                 expectIntent: 'appointment' },
  { id: 'edge-g-07', text: 'שתיים בלילה תזכורת לשתות מים',                        expectIntent: 'reminder' },
  { id: 'edge-g-08', text: 'יש לי',                                                expectIntent: 'unknown' },
  { id: 'edge-g-09', text: 'תזכירי',                                               expectIntent: 'unknown' },
  { id: 'edge-g-10', text: 'פגישה',                                                expectIntent: 'unknown' },
  { id: 'edge-g-11', text: 'ביום ראשון',                                           expectIntent: 'unknown' },
  { id: 'edge-g-12', text: 'תקבעי פגישה',                                          expectIntent: 'appointment' },
  { id: 'edge-g-13', text: 'יש לי תור',                                            expectIntent: 'appointment' },
  { id: 'edge-g-14', text: 'כן, בסדר, שלום',                                       expectIntent: 'unknown' },
  { id: 'edge-g-15', text: 'תזכירי לי לא לא לא לשתות קפה',                        expectIntent: 'reminder' },
  { id: 'edge-g-16', text: 'פגישה עם גלעד',                                        expectIntent: 'appointment' },
  { id: 'edge-g-17', text: 'מה השעה',                                              expectIntent: 'unknown' },
  { id: 'edge-g-18', text: 'תודה תזכירי לי מחר בבוקר',                            expectIntent: 'reminder' },

  // ══════════════════════════════════════════════════════════════════════
  //  H. Additional mixed coverage to reach ≥200 total
  // ══════════════════════════════════════════════════════════════════════
  { id: 'mix-h-01', text: 'תזכירי לי בעוד שעה לצאת לקניות',                       expectIntent: 'reminder' },
  { id: 'mix-h-02', text: 'יש לי בדיקת שמיעה ביום חמישי בשתים עשרה',             expectIntent: 'appointment' },
  { id: 'mix-h-03', text: 'תקבעי פגישה עם איילון ביום ראשון בתשע',               expectIntent: 'appointment' },
  { id: 'mix-h-04', text: 'תזכירי לי כל שישי בבוקר לשלוח הודעה לילדים',           expectIntent: 'reminder' },
  { id: 'mix-h-05', text: 'יש לי ביקור בית ביום שלישי בשעה ארבע בצהריים',         expectIntent: 'appointment' },
  { id: 'mix-h-06', text: 'מה יש לי ביום שלישי',                                  expectIntent: 'schedule_query' },
  { id: 'mix-h-07', text: 'תוסיפי פגישה עם עורך הדין ב-10 ביוני בעשר בבוקר',    expectIntent: 'appointment' },
  { id: 'mix-h-08', text: 'תזכירי לי בעוד שלוש דקות לכבות את הגז',               expectIntent: 'reminder' },
  { id: 'mix-h-09', text: 'יש לי ספא מחרתיים בשתים בצהריים',                     expectIntent: 'appointment' },
  { id: 'mix-h-10', text: 'תזכירי לי מחר לקחת מטרייה',                            expectIntent: 'reminder' },
  { id: 'mix-h-11', text: 'תקבעי פגישה עם הבת של מור ביום שישי בצהריים',          expectIntent: 'appointment' },
  { id: 'mix-h-12', text: 'יש לי משהו ביום ראשון בבוקר',                          expectIntent: 'schedule_query' },

  // ══════════════════════════════════════════════════════════════════════
  //  I. WAR-ROOM HARD CASES — Martita's actual speech patterns.
  //     Family queries, time edges, self-corrections, no-trigger context.
  // ══════════════════════════════════════════════════════════════════════

  // ─── Family queries (NEW route — never saves) ───────────────────────
  { id: 'fq-i-01', text: 'מי הבעל של אופיר',                                       expectIntent: 'family_query' },
  { id: 'fq-i-02', text: 'מי האחות של ארי',                                        expectIntent: 'family_query' },
  { id: 'fq-i-03', text: 'מי הילדים של מור',                                       expectIntent: 'family_query' },
  { id: 'fq-i-04', text: 'מי הבת של מור',                                          expectIntent: 'family_query' },
  { id: 'fq-i-05', text: 'מי הבן של לאו',                                          expectIntent: 'family_query' },
  { id: 'fq-i-06', text: 'מי הנכד של מור',                                         expectIntent: 'family_query' },
  { id: 'fq-i-07', text: 'מי בעלה של אופיר',                                       expectIntent: 'family_query' },
  { id: 'fq-i-08', text: 'מי אחות של ארי',                                         expectIntent: 'family_query' },

  // ─── Time edges (Martita's vocabulary) ──────────────────────────────
  { id: 'time-i-01', text: 'מחר בתשע',                                              expectIntent: 'unknown' }, // bare date+ambiguous time, no noun/verb
  { id: 'time-i-02', text: 'מחר בתשע בערב',                                         expectIntent: 'unknown' }, // same, contextual but no save target
  { id: 'time-i-03', text: 'מחר ב-12 בלילה פגישה',                                  expectIntent: 'appointment' },
  { id: 'time-i-04', text: 'מחר באחת בצהריים פגישה',                                expectIntent: 'appointment' },
  { id: 'time-i-05', text: 'מחר ברבע לעשר בערב פגישה',                              expectIntent: 'appointment' },
  { id: 'time-i-06', text: 'תזכירי לי מחר ב-12 בלילה לקחת תרופה',                  expectIntent: 'reminder' },
  { id: 'time-i-07', text: 'תזכירי לי מחר באחת בצהריים לקחת כדור',                expectIntent: 'reminder' },
  { id: 'time-i-08', text: 'תזכירי לי מחר ברבע לעשר בערב לכבות תנור',              expectIntent: 'reminder' },
  { id: 'time-i-09', text: 'תזכירי לי בעוד שעה וחצי לשתות מים',                   expectIntent: 'reminder' },
  { id: 'time-i-10', text: 'תזכירי לי עוד רבע שעה להתקשר',                         expectIntent: 'reminder' },
  { id: 'time-i-11', text: 'תזכירי לי בעוד שעה ורבע לבדוק כביסה',                  expectIntent: 'reminder' },

  // ─── Self-corrections, full sentences ───────────────────────────────
  { id: 'corr-i-01', text: 'מחר בתשע לא סליחה בעשר לקחת כדור תזכירי לי',           expectIntent: 'reminder' },
  { id: 'corr-i-02', text: 'תקבעי עם גלעד מחר לא עם אופיר מחר',                    expectIntent: 'appointment' },
  { id: 'corr-i-03', text: 'תזכירי לי לקחת כדור בעוד שעה בעצם בעוד שעתיים',        expectIntent: 'reminder' },
  { id: 'corr-i-04', text: 'תקבעי פגישה עם אופיר ביום ראשון לא ביום שני בעשר',     expectIntent: 'appointment' },

  // ─── Implicit reminder via "אני צריכה" ──────────────────────────────
  { id: 'imp-i-01', text: 'אני צריכה מחר בבוקר לקחת כדור תזכירי לי',               expectIntent: 'reminder' },
  { id: 'imp-i-02', text: 'אני צריכה מחר בערב לדבר עם אופיר',                       expectIntent: 'unknown' }, // no trigger verb, no appt noun
  { id: 'imp-i-03', text: 'אל תשכחי להזכיר לי בערב להתקשר לאופיר',                  expectIntent: 'reminder' },
  { id: 'imp-i-04', text: 'אל תשכחי לי את התרופה בערב',                             expectIntent: 'reminder' }, // medication w/o noun

  // ─── Recurring, no trigger ──────────────────────────────────────────
  { id: 'rec-i-01', text: 'כל יום בתשע בבוקר לקחת תרופה',                          expectIntent: 'reminder' },
  { id: 'rec-i-02', text: 'כל ערב בעשר לקחת כדור לחץ דם',                          expectIntent: 'reminder' },
  { id: 'rec-i-03', text: 'כל יום שישי להתקשר למור',                                expectIntent: 'reminder' },

  // ─── Bare appointment phrases (full Martita sentences) ──────────────
  { id: 'bare-i-01', text: 'יש לי בדיקה מחרתיים בעשר בבוקר',                       expectIntent: 'appointment' },
  { id: 'bare-i-02', text: 'יש לי תור לרופא ביום ראשון בשתיים בצהריים',            expectIntent: 'appointment' },
  { id: 'bare-i-03', text: 'פגישה עם גלעד מחר ב-21:30',                            expectIntent: 'appointment' },
  { id: 'bare-i-04', text: 'מחר בתשע וחצי בבוקר רופא שיניים',                      expectIntent: 'appointment' },
  { id: 'bare-i-05', text: 'מחר בתשע וחצי בערב פגישה עם אופיר',                    expectIntent: 'appointment' },
  { id: 'bare-i-06', text: 'תזכירי לי לבדוק כביסה עוד עשר דקות',                   expectIntent: 'reminder' },
  { id: 'bare-i-07', text: 'תרשמי לי מחר בעשר רופא',                               expectIntent: 'appointment' },
  { id: 'bare-i-08', text: 'תזכירי לי עוד חצי שעה לבדוק את הסיר',                  expectIntent: 'reminder' },

  // ─── Calendar query — explicit weekend/specific ─────────────────────
  { id: 'sq-i-01', text: 'מה התוכניות שלי השבוע',                                  expectIntent: 'schedule_query' },
  { id: 'sq-i-02', text: 'מה יש לי השבוע',                                          expectIntent: 'schedule_query' },
  { id: 'sq-i-03', text: 'יש לי משהו מחר בערב',                                    expectIntent: 'schedule_query' },

  // ─── Cancel / minimal utterances ────────────────────────────────────
  { id: 'cancel-i-01', text: 'ביטול',                                              expectIntent: 'unknown' },
  { id: 'cancel-i-02', text: 'תעצרי',                                              expectIntent: 'unknown' },

  // ─── Friday prep / dinner (Martita pattern) ─────────────────────────
  { id: 'frid-i-01', text: 'ביום שישי בבוקר להכין דברים לשבת',                     expectIntent: 'unknown' }, // no trigger, no noun
  { id: 'frid-i-02', text: 'תזכירי לי ביום שישי בבוקר להכין דברים לשבת',          expectIntent: 'reminder' },

  // ─── More family-relation appointments ──────────────────────────────
  { id: 'rel-i-01', text: 'תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר',          expectIntent: 'appointment' },
  { id: 'rel-i-02', text: 'תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי',       expectIntent: 'appointment' },
  { id: 'rel-i-03', text: 'תזכירי לי להתקשר לאחות של ארי בערב',                    expectIntent: 'reminder' },
  { id: 'rel-i-04', text: 'יש לי פגישה עם בעלה של אופיר מחר ב-14:00',              expectIntent: 'appointment' },
  { id: 'rel-i-05', text: 'תזכירי לי בעוד שעה להתקשר לבן הזוג של אופיר',           expectIntent: 'reminder' },
]
