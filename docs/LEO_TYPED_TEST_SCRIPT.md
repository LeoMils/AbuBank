# LEO TYPED TEST SCRIPT — AbuAI (text layer)

**Build:** 0.113.0-referable-fix · branch `rc5/cognitive-architecture-and-acceptance`
**Scope:** TYPED input only (voice/Realtime is a later mission).
**Verified:** the deterministic checks below were run against the DEPLOYED preview in a
real mobile-chrome browser — **13/13 pass at PREVIEW class** (family incl. in-laws, dates,
memory, and the full create→where→move→cancel calendar flow), each ~300–400 ms.
**How to use:** type each line into AbuAI and compare to *Expected*. Date/time answers
reflect the day you run it.

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

### Math (deterministic arithmetic — PREVIEW-verified)
15. `כמה זה 15 כפול 4` → **✅ RUNTIME** — `זה יוצא 60.`
16. `20 אחוז מ-200` → **✅ RUNTIME** — `20% מ-200 זה 40.`
17. `cuánto es 12 por 8` → **✅ RUNTIME** — `Son 96.`

### Calendar — read & search (deterministic, grounded in the store)
18. First create an event (see 22), then: `מה יש לי מחר` → **✅ RUNTIME** — lists the
    event, or `מחר אין כלום. יום שקט.` when empty.
19. `מה יש לי ביום ראשון` → **✅ RUNTIME** — reads the **next Sunday** (not today);
    `ביום ראשון אין כלום ביומן.` when empty. *(named-weekday read)*
20. `מתי הפגישה עם רפי` → **✅ RUNTIME** — searches all days; `אין לך פגישה עם רפי ביומן.`
    when none.

### Calendar — create, confirm, referable read & mutation
21. `תקבעי פגישה עם רפי מחר בשלוש בבית קפה מרוקו` → **✅ LEGACY-UI** — a confirm card:
    `פגישה עם רפי מחר בשלוש אחר הצהריים. בית קפה מרוקו. נכון?`
22. `כן` → **✅ LEGACY-UI** — saves and reads back, e.g.
    `קבוע — פגישה עם רפי 17 ביולי 2026, יום שישי בשעה 15:00. בית קפה מרוקו`
    *(this now also sets the conversation FOCUS to that event.)*
23a. …then `איפה אני פוגשת אותו?` → **✅ RUNTIME** — `הפגישה עם רפי בית קפה מרוקו.`
23b. …then `תעבירי אותה ליום ראשון` → **✅ RUNTIME** — `עדכנתי: פגישה עם רפי ל-19 ביולי 2026, יום ראשון.` *(next-Sunday date reflects run-day)*
23c. …then `תבטלי אותה` → **✅ RUNTIME** — `מחקתי את פגישה עם רפי בשעה 15:00.`
    *(pronoun “cancel it” now resolves to the focused event — was Part B, now wired in 0.112.0.)*

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

## Part B — remaining wiring status (honest)

The referable-calendar gap that used to be here was **closed in 0.112.0** (the
UI cutover): `index.tsx` now routes `calendar_delete` / `calendar_update` through
the runtime, **persists the conversation `focus`** across turns (set after a save),
and the duplicate delete/modify handlers were removed — one runtime path. Those
turns are items 23a–23c above.

Still on their existing paths (works, but not the runtime), by deliberate scope:
- **Create / confirm** (items 21–22) — the elaborate legacy create flow (voice,
  pronoun guard, birthday-reminder fusion) is intentionally left for a later,
  separate cutover.
- **General / online** (items 29–30) — model / live retrieval by design.

(Math, items 15–17, IS deterministic in-app — PREVIEW-verified 3/3.)

**Update (0.113.0):** the referable items (23a–23c) are now **PREVIEW-verified** — a
real-browser Playwright run against the deployed preview passes 13/13, with the
referable read/cancel answered deterministically (~330 ms), not by the LLM.

---

## Evidence classes (honest)
- *Expected* strings: **CODE** (captured from the real runtime, deterministic).
- ✅ RUNTIME wiring: **CODE + source-contract** (the UI routes these to the runtime);
  live end-to-end is **PREVIEW-pending**.
- Live-app behaviour on the preview: **PREVIEW** once verified there (not yet done).
- Physical device / voice: **not covered here** (later mission).
