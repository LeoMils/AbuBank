# 20-Turn Conversation Continuity — Deterministic Results

_Structural continuity through the real follow-up/planner/grounding engines. Live-model prose warmth NOT judged here._

| Turn | User | Check | Result | Detail |
|------|------|-------|--------|--------|
| 2 | מי זאת מור? | family grounded | ✅ PASS | מור, הבת שלך. בהוד השרון עם יעל. |
| 3 | ספרי לי עליה | pronoun→continue + last person retained (Mor) | ✅ PASS | act=continue lastPerson=מור |
| 5 | מי סבתא רבתא של אנאבל? | inference grounded, no leak | ✅ PASS | מרטיטה. |
| 6 | מה יש לי מחר? | calendar read tomorrow | ✅ PASS | מחר יש לך רופא. / בארבע אחר הצהריים. |
| 7 | ומה אחרי זה? | cal follow-up → week | ✅ PASS | true:מה יש לי השבוע? |
| 8 | ומה ביום הבא? | next-day → tomorrow | ✅ PASS | true:מה יש לי מחר? |
| 10 | תמשיכי | topic continuation detected (act=continue) | ✅ PASS | act=continue |
| 12 | אני מתגעגעת לפאפי | grief → suppress lookups + emotion frame | ✅ PASS | frame=emotion suppress=true |
| 13 | מה השעה? | mood stickiness across neutral turn | ✅ PASS | frame=emotion |
| 14 | מי זאת מור? | RETURN to family after detour | ✅ PASS | מור, הבת שלך. בהוד השרון עם יעל. |
| 15 | עליה | pronoun continuation again (Mor retained) | ✅ PASS | act=continue lastPerson=מור |
| 16 | מה יש לי השבוע? | calendar week read after return | ✅ PASS | יום רביעי (24/06): / 🏥 רופא בשעה 16:00 |

**Continuity checks: 12 · pass 12 · fail 0** across a 20-turn session.

> Felt warmth / real-model coherence over these 20 turns is a separate real-run gate — see dashboard §5.