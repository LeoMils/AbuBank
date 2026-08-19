# MARTITA COMPANION ACCEPTANCE — results

Scored 0-3 against the REAL deterministic engines. HARD FAIL on fake-save, raw/banned output, wrong relation, wrong calendar action, lost continuity. LLM-prose scenarios are BLOCKED_BY_KEYS (not scored green).

**Deterministic:** 12 scenarios · avg 3.00/3 · hard-fails 0
**Blocked (need live model/network):** 6

| ID | Category | Score | Reason | Sample |
|----|----------|-------|--------|--------|
| M-FAM-1 | family/identity | 3 | concise role answer | מור, הבת שלך. בהוד השרון עם יעל. |
| M-FAM-2 | family/depth | 3 | rich differs from terse | מור, הבת שלך. בהוד השרון עם יעל. \| מור, הבת שלך. גרה בהוד השרון, וילה עם יעל. ארבעה ילדים  |
| M-FAM-3 | family/inference | 3 | great-grandmother inferred | מרטיטה. |
| M-FAM-4 | family/inference | 3 | uncle inferred | לאו. |
| M-FAM-5 | family/partner | 3 | partner alias → Yael | יעל. |
| M-CAL-1 | calendar/read-exact | 3 | exact-time correct | מחר יש לך רופא. בארבע אחר הצהריים. |
| M-CAL-2 | calendar/read-day | 3 | day read correct | מחר יש לך רופא. בארבע אחר הצהריים. |
| M-MEM-1 | memory/continuity | 3 | pronoun grounded to last person | יעל, בת הזוג של מור. בהוד השרון. \| יעל, בת הזוג של מור. גרה בהוד השרון. גרה עם מור בוילה ב |
| M-TRUST-1 | trust/no-fake-save | 3 | save verified by readback |  |
| M-ES-REL | spanish/relational | 3 | ES relation, Latin name, no dump | La mamá de Ofir es Mor. |
| M-EN-REL | english/relational | 3 | EN uncle inferred | אופיר, הנכד שלך. עם גלעד. |
| M-FAM-HONEST | family/no-invention | 3 | honest: no invented relation | מור, הבת שלך. בהוד השרון עם יעל. |
| M-CASUAL-1 | casual chat | 🔴 BLOCKED | undefined | מה נשמע? |
| M-LONELY-1 | boredom/loneliness | 🔴 BLOCKED | undefined | קצת בודד לי היום |
| M-PAPI-1 | emotional/papi | 🔴 BLOCKED | undefined | אני מתגעגעת לפאפי |
| M-NEWS-1 | online/current | 🔴 BLOCKED | undefined | מה חדש בעולם? |
| M-GK-1 | general knowledge | 🔴 BLOCKED | undefined | ספרי לי על המהפכה הצרפתית |
| M-ES-1 | spanish/rioplatense | 🔴 BLOCKED | undefined | contame de Leo |