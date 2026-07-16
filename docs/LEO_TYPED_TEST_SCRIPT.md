# LEO TYPED TEST SCRIPT — AbuAI (text layer)

**Build:** 0.111.0-memory-ui-wired · branch `rc5/cognitive-architecture-and-acceptance`
**Scope:** TYPED input only (voice/Realtime is a later mission).
**How to use:** type each line into AbuAI and compare to *Expected*. Answers were
captured from the **actual runtime** (`runCognitiveTurn`) with the clock pinned to
**Thu 2026-07-16**; on the live app, date/time answers reflect the day you run it.

## Honesty legend — where each answer comes from
- **✅ RUNTIME** — the deployed UI answers this deterministically via the single
  cognitive runtime (exact wording below).
- **✅ LEGACY-UI** — the deployed UI answers it via its own (older) handler; content
  is right, wording may differ slightly from the runtime capture.
- **🤖 LLM** — answered by the language model (content should be correct via injected
  family/date/memory grounding; wording varies, not deterministic).
- **🌐 ONLINE** — requires live web retrieval; the answer varies and must carry sources,
  or AbuAI must say honestly it cannot check (never fabricate).
- **⚠️ GAP** — the *runtime* produces the correct answer (proven by tests) but the
  deployed UI does **not yet route this turn through the runtime** (see “Known wiring
  gap” at the bottom). Listed so it can be verified after the UI cutover.

---

## Part A — should work on the preview today

### Family relations (deterministic graph — no dates)
1. `מי זאת מור` → **✅ RUNTIME** — `מרטיטה האמא של מור.`
2. `מי אמא של אופיר` → **✅ RUNTIME** — `מור`
3. `מי הבן של מרטיטה` → **✅ RUNTIME** — `לאו`
4. `מה הקשר בין רפי ללאו` → **✅ RUNTIME** — `רפי הגיס לשעבר של לאו.`
5. `מה הקשר בין ירדן לנועם` → **✅ RUNTIME** — `ירדן נשואה לעילי, ועילי בן דוד של נועם.`
   *(in-law by composition: wife of Noam’s cousin)*
6. `מה הקשר בין גלעד ללאו` → **✅ RUNTIME** — `גלעד נשוי לאופיר, ואופיר אחיינית של לאו.`
   *(husband of Leo’s niece)*
7. `כמה נכדים יש למור` → **✅ RUNTIME** — `יש למור 2 נכדים: אנאבל וארי.`
8. `quién es Ofir` → **✅ RUNTIME** — `Abu es abuela de Ofir (a través de Mor).`
9. `qué relación hay entre Rafi y Leo` → **✅ RUNTIME** — `Raphi es ex cuñado de Leo.`
10. `la hija de Mor` → **🤖 LLM** — should answer *Ofir* (the runtime doesn’t own this
    bare Spanish shorthand; the model answers from the injected family facts).

### Dates & time (deterministic from the real clock)
11. `מה התאריך היום` → **✅ RUNTIME** — `היום 16 ביולי 2026, יום חמישי.` *(reflects run-day)*
12. `איזה יום מחר` → **✅ RUNTIME** — `מחר יהיה יום שישי, 17 ביולי 2026.` *(reflects run-day)*
13. `כמה ימים עד סוף החודש` → **✅ RUNTIME** — `עד סוף החודש נשארו 15 ימים.` *(reflects run-day)*
14. `מה השעה בניו יורק` → **✅ RUNTIME** — `בניו יורק השעה עכשיו 03:00.` *(reflects real time; NY is 7h behind Israel in July)*

### Math (deterministic arithmetic)
15. `כמה זה 15 כפול 4` → **🤖 LLM** — expect `60`. *(the runtime computes `זה יוצא 60.`
    but the UI currently sends math to the model; still should be correct.)*
16. `20 אחוז מ-200` → **🤖 LLM** — expect `40`. *(runtime: `20% מ-200 זה 40.`)*
17. `cuánto es 12 por 8` → **🤖 LLM** — expect `96`. *(runtime: `Son 96.`)*

### Calendar — read & search (deterministic, grounded in the store)
18. First create an event (see 22), then: `מה יש לי מחר` → **✅ RUNTIME** — lists the
    event, or `מחר אין כלום. יום שקט.` when empty.
19. `מה יש לי ביום ראשון` → **✅ RUNTIME** — reads the **next Sunday** (not today);
    `ביום ראשון אין כלום ביומן.` when empty. *(named-weekday read)*
20. `מתי הפגישה עם רפי` → **✅ RUNTIME** — searches all days; `אין לך פגישה עם רפי ביומן.`
    when none.

### Calendar — create & confirm (deployed UI path)
21. `תקבעי פגישה עם רפי מחר בשלוש בבית קפה מרוקו` → **✅ LEGACY-UI** — a confirm card:
    `פגישה עם רפי מחר בשלוש אחר הצהריים. בית קפה מרוקו. נכון?`
22. `כן` → **✅ LEGACY-UI** — saves and reads back, e.g.
    `קבוע — פגישה עם רפי 17 ביולי 2026, יום שישי בשעה 15:00. בית קפה מרוקו`
23. `תבטלי את הפגישה עם רפי` → **✅ LEGACY-UI** — `מחקתי את פגישה עם רפי בשלוש אחר הצהריים.`
    *(explicit-name delete works; the pronoun form “cancel it” is a GAP — see Part B.)*

### Memory (durable, user-commanded — now wired to the UI)
24. `תזכרי שאני אוהבת יין אדום` → **✅ RUNTIME** — `בסדר, אני אזכור את זה: אני אוהבת יין אדום.`
25. `מה את זוכרת עליי?` → **✅ RUNTIME** — `הנה מה שאני זוכרת עלייך: אני אוהבת יין אדום.`
26. `תשכחי שאני אוהבת יין אדום` → **✅ RUNTIME** — `בסדר, שכחתי את זה.`
27. `recordá que me gusta el mate` → **✅ RUNTIME** — `Listo, me acuerdo: me gusta el mate.`
    then `qué te acordás de mí` → `Me acuerdo de esto sobre vos: me gusta el mate.`
28. `תזכרי שמספר הטלפון שלי 0521234567` → **✅ RUNTIME** (privacy) —
    `את זה אני מעדיפה לא לשמור, אבל אני כאן איתך.` *(never stores phone/medical/financial/street.)*

### General knowledge & current-info
29. `כמה זמן לוקח לאור מהשמש להגיע לכדור הארץ` → **🤖 LLM** — a real answer (~8 minutes 20 seconds); a general-knowledge question always gets an answer.
30. `מה מזג האוויר בכפר סבא עכשיו` → **🌐 ONLINE** — a live answer **with sources**, or an
    honest “I can’t check right now” — never an invented temperature.

---

## Part B — known wiring gap (runtime-proven, NOT yet reaching the deployed UI)

These behave correctly in the cognitive runtime (covered by
`calendarReferability.test.ts` + `calendarReferableMutation.test.ts`), but the
deployed `index.tsx` still uses its **own** calendar handlers for these turns and
does **not thread the conversation `focus`** across turns — so they will currently
fall to the LLM/legacy path in the app. Re-run these after the UI cutover.

- After creating a meeting: `איפה אני פוגשת אותו?` → *(runtime)* `הפגישה עם רפי בית קפה מרוקו.`
- After creating a meeting: `מתי אני נפגשת איתו?` → *(runtime)* `הפגישה עם רפי … בשעה 15:00.`
- `תעבירי אותה ליום ראשון` → *(runtime)* `עדכנתי: פגישה עם רפי ל-19 ביולי 2026, יום ראשון.`
  *(friendly Hebrew date; the legacy UI handler shows a rawer form.)*
- `תבטלי אותה` (cancel **it**, pronoun) → *(runtime)* deletes the focused event; the
  legacy UI does not recognise the pronoun form and sends it to the LLM.

**Root cause / next work:** `index.tsx` defers only 6 intents to `runCognitiveTurn`
(`RUNTIME_OWNED`) and keeps duplicate create/delete/modify handlers — a violation of
the “one runtime path per capability” rule. The fix is to cut the UI’s create/confirm/
delete/modify over to the runtime **and persist `focus`** across turns, so referable
reads and pronoun mutations work for Martita. This is a medium-risk UI change and is
tracked as the next cycle.

---

## Evidence classes (honest)
- Parts A/B *Expected* strings: **CODE** (captured from the real runtime, deterministic).
- Live-app behaviour on the preview: **PREVIEW** once verified there (not yet done).
- Physical device / voice: **not covered here** (later mission).
