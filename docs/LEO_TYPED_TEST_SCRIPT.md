# LEO TYPED TEST SCRIPT — AbuAI (text layer)

## ⛔ STEP 0 — VERIFY THE BUILD FIRST (else STOP)
The previous round was invalidated because it ran on a **49-versions-stale cached build**.
Before typing anything:
1. On the **Home** screen, read the small **`QA: v…`** badge (bottom). It MUST read
   **`QA: v0.139.0-family-record-screen`**.
2. If it shows any other version → you are on a **stale/cached build**. A gold banner
   **"יש גרסה חדשה של האפליקציה — לחצי לרענון"** should appear at the top; tap **רענון**.
   If not, hard-refresh (iOS: close the PWA/tab fully and reopen from the CURRENT preview URL
   given with this script), then re-check the badge.
3. **Do NOT start the checks until the badge matches.** A wrong version = STOP.

**Build to look for:** `0.139.0-family-record-screen` (Settings → About shows the build; the Home
QA badge shows `QA: v0.139.0-family-record-screen`). Branch `rc5/cognitive-architecture-and-acceptance`.
**Scope:** TYPED input. Every check below was proven through the DEPLOYED preview in a real
mobile browser (Playwright) across cycles 39–47 — `e2e/preview-typed-script.spec.ts`,
`e2e/leo-device-failures.spec.ts`, `e2e/preview-parity.spec.ts`.
**How to use:** type each numbered line into AbuAI and compare to **Expected**. Date/time answers
reflect the day you run it (examples below were captured on **Sat 18 Jul 2026**). Deterministic
checks answer in **~0.3–0.7s**.

## Legend
- **RUNTIME** — answered deterministically by the single cognitive runtime (exact wording).
- **LLM** — answered by the model (content correct via grounding; wording varies).
- **ONLINE** — needs live retrieval; must carry the answer honestly or say it cannot check —
  **never fabricate** (`NO TOOL RESULT = NO CLAIM`).
- ✅ good example · ❌ failing example (what a regression would look like).

---

## A · Family relations (deterministic graph)
1. `מי זאת מור` → RUNTIME — `מרטיטה האמא של מור.`
2. `מה הקשר בין ירדן לנועם` → RUNTIME — names `עילי` + `דוד` (Yarden is married to Eili, Eili is Noam's cousin).
3. `מה הקשר בין גלעד ללאו` → RUNTIME — names `אופיר` (Gilad is married to Ofir, Leo's niece).
4. `כמה נכדים יש למור` → RUNTIME — `יש למור 2 נכדים: אנאבל וארי.`
5. `מה הקשר בין אנבל ללאו` → RUNTIME — `אנאבל נכדת-אחיין של לאו.`
6. `מי גלעד עבור רפי` → RUNTIME — `גלעד החתן של רפי.`
   - ❌ regression: `לא הצלחתי / אין לי גישה` (dead-end) or the literal phrase echoed back.

## B · Dates & math
7. `מה התאריך היום` → RUNTIME — today's date incl. `2026`, e.g. `היום 18 ביולי 2026, שבת.`
8. `איזה יום מחר` → RUNTIME — tomorrow's weekday + date, e.g. `מחר יהיה יום ראשון, 19 ביולי 2026.`
9. `בעוד 5 ימים איזה יום` → RUNTIME — e.g. `בעוד 5 ימים יהיה יום חמישי, 23 ביולי 2026.`
10. `כמה זה 15 כפול 4` → RUNTIME — `זה יוצא 60.`
11. `20 אחוז מ-200` → RUNTIME — `20% מ-200 זה 40.`
12. `cuánto es 12 por 8` → RUNTIME — `Son 96.` (Spanish, no Hebrew).

## C · Calendar create → confirm → referable → cancel
13. `תקבעי פגישה עם רפי מחר בשלוש בבית קפה מרוקו` → RUNTIME — `פגישה עם רפי מחר בשלוש אחר הצהריים. בית קפה מרוקו. נכון?`
14. `כן` → RUNTIME — `קבוע — פגישה עם רפי …19 ביולי 2026… בשעה 15:00. בית קפה מרוקו`
15. `איפה אני פוגשת אותו?` → RUNTIME — `הפגישה עם רפי בית קפה מרוקו.` (referable — reads the just-saved event).
16. `באיזה יום הפגישה` → RUNTIME — the **day + date + time**, e.g. `הפגישה עם רפי ביום שני, 20 ביולי 2026 בשעה 15:00.`
    - ✅ good: names the DAY (weekday) + date + time. ❌ failing (the 0.79 bug): gives only the hour, "לא מצאתי במקום הזה", or an LLM guess.
17. `תבטלי אותה` → RUNTIME — `מחקתי את פגישה עם רפי בשעה 15:00.`
    - ❌ regression: `באיזה יום?` / invents a different event / can't find it.

## D · Corrections mid-create (draft must update, not restart)
17. `תקבעי פגישה עם דני מחר בשבע` → RUNTIME — confirm for `דני` … `בשבע` … `נכון?`
18. `לא, בארבע` → RUNTIME — same `דני` draft, time now **four** (`בארבע`), asks `נכון?` again.
    - ✅ good: person kept, only the time changed. ❌ failing: starts a brand-new empty create, or a later `כן` saves seven.

## E · Rambling story → clean extraction (P2)
19. Type the whole story:
    `אז תשמעי, דיברתי היום עם החתן של רפי, והוא סיפר לי שהוא טס לניו יורק בשבוע הבא, ואנחנו רוצים להיפגש מחר בשלוש אחר הצהריים בבית קפה טולדנו כדי לדבר על הטיול המשפחתי`
    → RUNTIME — `פגישה עם גלעד מחר בשלוש אחר הצהריים. בית קפה טולדנו. בנושא טיול המשפחתי. נכון?`
    - ✅ good: resolves `החתן של רפי`→`גלעד`, keeps `טולדנו` + `מחר`, subject stated **once**.
    - ❌ failing: dumps the raw story (`ניו יורק`, `סיפר לי`), or repeats the subject twice.

## F · Spanish end-to-end (Rioplatense) — language discipline: NO Hebrew may leak
20. `agendá una reunión con Gabi mañana a las tres` → RUNTIME — `Te agendo una reunión con Gabi mañana a las 15:00. ¿Está bien?`
21. `dale, agendalo` → RUNTIME — `Listo, te agendé una reunión con Gabi mañana a las 15:00.`
22. `cancelalo` → RUNTIME — `Listo, cancelé la reunión con Gabi a las 15:00.` (Spanish confirm, not Hebrew).
23. `¿qué relación hay entre Anabel y Leo?` → RUNTIME — `Anabel es sobrina nieta de Leo.`
    - ❌ regression on 20–23: any Hebrew word in the reply.

## G · Cross-language supersession (the 0.126 fix) — do these IN ORDER, one session
24. `תקבעי פגישה עם החתן של רפי מחר בשלוש` → RUNTIME — confirm for `גלעד` … `נכון?`
25. `agendá una reunión con Gabi mañana a las tres` → RUNTIME — Spanish confirm for **Gabi** (`¿Está bien?`).
26. `dale, agendalo` → RUNTIME — `Listo, te agendé una reunión con **Gabi** …` (saves **Gabi**, in Spanish).
    - ❌ failing (the old bug): saves `גלעד` in Hebrew — the new create didn't supersede the old draft.

## H · Memory store / recall / forget (this session)
27. `תזכרי שאני אוהבת יין אדום` → RUNTIME — `בסדר, אני אזכור את זה: אני אוהבת יין אדום.`
28. `מה את זוכרת עליי?` → RUNTIME — `הנה מה שאני זוכרת עלייך: אני אוהבת יין אדום.`
29. `תשכחי שאני אוהבת יין אדום` → RUNTIME — `בסדר, שכחתי את זה.` (recall after this must NOT mention red wine).

## I · Online honesty & style
30. `מי ניצח אתמול במשחק` → ONLINE — either a real, current answer **with a source**, or an honest
    decline: `לא מצאתי מידע עדכני על זה כרגע. אני מעדיפה להגיד לך את זה מאשר להמציא.`
    - ✅ good: honest decline when it can't retrieve. ❌ failing: confidently states a made-up score/winner.
31. Style check (applies to every answer): warm + feminine address (`את`, `תגידי`), **never a menu**
    (`אפשרות 1… אפשרות 2…`), never robotic, `Martita` always in Latin letters, the `Ja ja ja` laugh
    (never `חחח`). ❌ failing: an option-list opener, English UI text, or a cold/clipped reply.

## J · Family LEDGER round-trips (the write path — new in 0.132→0.139)
Type these in ONE session, in order. A written fact must pass **THE LAWS gate** and then be
answerable in the SAME session.
32. `תזכרי שדני גר בתל אביב` → RUNTIME — a warm confirmation that it was written, e.g.
    `רשמתי — דני גר בתל אביב.` (explicit "תזכרי ש…" writes immediately, through the gate).
33. `איפה גר דני` → RUNTIME — reads the chapter back: `דני גר בתל אביב.`
    - ❌ regression: `לא יודעת` / an LLM guess / treated as a reminder ("תזכורת").
34. `רותי היא אשתו של דני` → RUNTIME — a **soft-confirm** prompt (the fact is only *stated*, not
    ordered), e.g. `שאשמור שרותי היא אשתו של דני? תגידי כן ואשמור.`
35. `כן` → RUNTIME — commits it: `רשמתי — רותי אשתו של דני.` (a `לא` here must DISCARD it).
36. `מה הקשר בין דני לרותי` → RUNTIME — names the marriage (`דני` + `רותי`, בני זוג).
37. **Poison (must be REFUSED):** `אופיר היא אשתו של רפי` → RUNTIME — a soft-confirm; answer `כן`.
    The write must be **REJECTED at the gate** with a plain-Hebrew reason (Ofir is already placed /
    would break monogamy) and **nothing is stored** — a follow-up `מי אשתו של רפי` must NOT say Ofir.
    - ✅ good: gentle Hebrew refusal, ledger unchanged. ❌ failing: silently accepts the contradiction.

## K · Personal chapters (facts about people, with provenance)
38. `תזכרי שמור אוהבת לצייר` → RUNTIME — `רשמתי — מור אוהבת לצייר.`
39. `מה מור אוהבת` → RUNTIME — `מור אוהבת לצייר.`
40. `מה את יודעת על דני` → RUNTIME — reads back the whole chapter gathered above (גר בתל אביב, בן זוג של רותי).

## L · תעודת המשפחה screen (Settings → 📜 תעודת המשפחה)
41. Open **Settings** (⚙︎) → tap **📜 תעודת המשפחה**. The screen shows the full family record in
    Hebrew (people, relations, and any facts you added above, each with its source), a paste box,
    and three buttons: **בדקי**, **ייצוא גיבוי**, **ביטול שינוי אחרון**.
42. In the paste box type two lines and tap **בדקי**:
    `גבי גר בחיפה`
    `אופיר היא אשתו של רפי`
    → the first line shows a **green accept** row with a **רשמי** button; tap it → it commits and
    the record above updates. The second (poison) line, on **רשמי**, is **refused** with a Hebrew
    reason and the record does NOT change.
43. Tap **ביטול שינוי אחרון** → the last thing you added is removed from the record (undo works).
44. Tap **ייצוא גיבוי** → a JSON backup file downloads (the full change-log + rendered record).
    - ✅ good: what you type in conversation and what you add here land in the SAME record.
    - ❌ failing: the screen is empty, a clean line won't commit, or the poison line stores.

---

## Notes for this round
- **Build:** confirm Settings → About reads `0.139.0-family-record-screen` before starting (see Step 0).
- **Speech pace:** replies are spoken at NORMAL pace by default now (Settings → מהירות דיבור:
  איטי / רגיל / מהיר centred on normal). This script is the TYPED layer; voice audibility is a
  separate on-device round.
- **Weekly drift check (operator):** `PARITY_GUARD_WRITE=1 npx vitest run src/eval/parityGuard.test.ts`
  writes `docs/eval/PARITY_GUARD_LATEST.md`.

## Constitution foundation (under the hood — operator, not typed checks yet)
The Truth-Loop and Learning-Loop keystones landed in 0.131.0. They are internal machinery
(no conversation→ledger write path is wired yet), so they are NOT typed AbuAI checks — verify
them as an operator:
- **THE LAWS (write gate):** `npx vitest run src/truth/familyLaws.test.ts` — a planted
  contradiction (parenthood cycle, parent-younger-than-child, bigamy, siblings-without-shared-
  parent, duplicate identity) is REJECTED at the gate with a one-line Hebrew reason, and a
  rejected write leaves the ledger unchanged (poisoning never stores). A manual upload with a
  planted conflict returns a one-line diff per fact.
- **METAMORPHIC MIRRORS:** `npx vitest run src/truth/mirrorSuite.test.ts` — 1380 oracle-free
  consistency checks over the real family engine pass, and a planted asymmetry is caught by
  mirrors alone.
- **CHAMPION vs CHALLENGER duel (promotion gate):** `npx vitest run src/eval/duel.test.ts` — a
  build promotes only if it beats the prior on the ENTIRE corpus (parity + marathon + flight
  recorder + 1380 mirrors) with NO dimension regressing; a deliberately regressed build is
  BLOCKED. The weekly line for Leo lands in `docs/eval/DUEL_LATEST.md`, e.g.
  `השבוע: 0 נתפסו, 0 תוקנו, 0 חזרו (חובה: 0 חזרו) — עבר ✓`.
- **Now shipped (0.132→0.139):** the conversation→ledger WRITE path (sections J–K above), the
  full-person chapters with provenance, and the **תעודת המשפחה** file screen with one-tap diff
  approval for pasted facts + export-backup + undo (section L). Verify these as TYPED/tap checks now.
- **Still to come (after Leo's round):** cloud-canonical persistence + real email/cron
  notification (infra-gated), birthdays→calendar auto-entries, and the on-device VOICE phase.
