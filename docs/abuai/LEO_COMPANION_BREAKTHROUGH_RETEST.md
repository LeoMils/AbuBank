# Leo — Companion Breakthrough Retest (real failed flows only)

URL: newest `abu-bank-*.vercel.app` Ready deployment (check `/api/health`
`buildVersion` = the latest). iPhone Safari → tap voice → allow mic. Optional:
Mac Safari → Develop → console to copy `[AbuAI][LATENCY]` / `[AbuAI][CONV_OS]`.

Say each line; check the pass criterion.

| # | Say | Expected (pass) |
|---|---|---|
| 1 | מה שלומך | Warm, short. **No invented life** (no "עייפה / באו לבקר"). |
| 2 | מי ניצח במשחק בין ארגנטינה לירדן | Routes online; if no final result: "מצאתי את המשחק אבל לא קיבלתי תוצאה סופית…". **Not** a bare "אין לי אפשרות". |
| 3 | איזה משחקים יש היום במונדיאל | Online sports answer (first chunk). |
| 4 | תמשיכי | Continues the cached answer from where it stopped — **not** a forget/restart. |
| 5 | למה אין לך אפשרות | The **real reason** (timeout / provider failed / incomplete) + retry offer. |
| 6 | יש לך אונליין | Acknowledges, explains the current failure, offers to try again. |
| 7 | מה מזג האוויר בכפר סבא עכשיו | Short spoken summary, **Celsius only**, no URL/markdown. |
| 8 | השעה שאמרת לא נכונה | Acknowledges; if the source time looked off: "התחזית עדכנית, אבל השעה שהמקור החזיר לא נראית נכונה." |
| 9 | פגישה ביומן להיום בשעה 3:00 עם גבי | Draft: גבי, today, **15:00** (or asks "שלוש אחר הצהריים?") — **never 03:00**. Title "פגישה עם גבי". |
| 10 | בבית קפה מרוקו | **Merges** location into the pending event — does **not** cancel. |
| 11 | מאושר | **Saves** the meeting. |

## Pass / fail checklist
- [ ] Warm companion tone, never menu/assistant/patronizing.
- [ ] No fabricated personal life.
- [ ] Online explains itself and offers recovery (no generic refusal loop).
- [ ] "תמשיכי" continues; "למה" explains the real reason; never the same sentence twice.
- [ ] Calendar saves on natural confirmation; 3:00 ≠ 03:00; location merges; no
      pending pollution of sports/weather.
- [ ] Voice chunks short (1–2 sentences), no URLs spoken.

## Physical-only (cannot be proven in code)
The **sound** of the voice (warm/natural, not robotic/slow) and exact on-device
latency. Everything else above is enforced and covered by
`realDeviceTranscriptRegression.test.ts`, `companionQuality.test.ts`,
`latencyLoopStateGuard.test.ts`, and `conversationOperatingSystem.test.ts`.
