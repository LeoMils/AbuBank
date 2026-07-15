# AbuAI Intelligence Gap Map (text-only, real runtime)

**Goal:** ChatGPT-Live-quality conversation intelligence, proven in TEXT by driving
the real `ExecutiveCognitiveController.handleTurn` — no microphone, no device needed.
Voice/Realtime is DEFERRED to the very end and is out of scope here.

**Evidence class of this map:** `CODE` — deterministic runtime probe
(`src/eval/intelligenceGapProbe.test.ts`), `now = Wed 2026-07-15 10:00`, LLM + online
tools injected/instrumented so every routing + reasoning decision is observable.
This proves logic/wiring, NOT device/preview behavior.

Legend: 🔴 confidently WRONG answer (worst) · 🟠 punts to LLM / fails when it should be
deterministic · 🟡 partial/quality · ✅ verified working in text.

---

## Cycle 1 — DATE / TIME REASONING (mission #1) — ✅ FIXED (0.80.0)

Fixed in `dateReasoner` + classifier (cognitiveRuntime.ts). Regression:
`relativeDateReasoning.test.ts` 8/8 green. D3–D7, D9, D12 now deterministic (not LLM);
D4/D5 return the correct yesterday/tomorrow date (not today); D9 → ראש השנה 2026-09-22;
D10 (פסח הבא) → 2027-03-22 from the table (no longer an online guess). Below is the
pre-fix evidence for the record.


| id | input | observed | expected | sev |
|----|-------|----------|----------|-----|
| D4 | איזה תאריך היה אתמול? | date_query → "היום 15 ביולי 2026" (TODAY) | 2026-07-14 | 🔴 |
| D5 | מה התאריך מחר? | date_query → "היום 15 ביולי 2026" (TODAY) | 2026-07-16 | 🔴 |
| D3 | איזה יום היה אתמול? | general → LLM (no clock) | יום שלישי 14 ביולי | 🟠 |
| D6 | איזה יום יהיה מחר? | general → LLM | יום חמישי 16 ביולי | 🟠 |
| D7 | איזה יום היה שלשום? | general → LLM | יום שני 13 ביולי | 🟠 |
| D12| ¿qué día fue ayer? | general → LLM | yesterday | 🟠 |
| D9 | מתי החג הבא? | general → LLM (hallucination risk = the Independence-Day-2024 incident) | next holiday after today = ראש השנה 2026-09-22 | 🟠 |
| D10| מתי פסח הבא? | online retrieval (works, but table-answerable) | פסח 2027-03-22 | 🟡 |
| D1,D2,D8,D11 | today / date / time / Spanish-today | ✅ correct deterministic | — | ✅ |

**Mechanism (first divergence):** `dateReasoner(text, now)` (cognitiveRuntime.ts) always
answers with `now` — it never reads a relative offset word (אתמול/שלשום/מחר/מחרתיים) —
and `DATE_QUERY_RE` only recognizes *today/date* phrasings, so relative-day questions fall
through to the LLM (which has no clock). No next-holiday reasoner exists.

---

## Cycle 2 — CONVERSATION QUALITY — ✅ Q2 FIXED (0.81.0)

Q2 fixed: narrowed `WHY_RE` (conversationOS.ts) so "why is X" knowledge questions
reach the general/LLM path instead of a frustration apology; bare "למה?" and specific
challenge phrasings stay challenges. Regression: `whyKnowledgeVsChallenge.test.ts` 5/5.


| id | input | observed | expected | sev |
|----|-------|----------|----------|-----|
| Q2 | למה השמיים כחולים? | **frustration** → apology ("לא הייתי מספיק ברורה") | answer the general-knowledge question | 🔴 |
| Q1 | ספרי לי על המהפכה הצרפתית | general → LLM ✅ | — | ✅ |
| Q3 | את זוכרת מה אמרתי אתמול? | general → LLM (LLM must be honest about no cross-session memory) | honest "I don't keep that" | 🟡 verify |

**Mechanism:** the "למה" why-challenge frustration trigger (`isWhyChallenge`) fires on an
innocent "why is the sky blue" — an over-broad frustration classifier hijacks a knowledge Q.

---

## Cycle 3 — FAMILY reasoning — ✅ F4/F3 FIXED (0.82.0); M2/F6 DEFERRED

F4 (Spanish "¿quién es Ofir?") + F3 (singular "מי הבת/הבן של X") fixed (0.82.0):
`familyDaughterSonSpanish.test.ts` 4/4. F4 → "Abu es abuela de Ofir (a través de Mor).";
F3 → "מור" (daughter) / "לאו" (son).

**M2 pronoun continuity — ✅ FIXED (0.83.0):** added singular mother/father rules
(`parentsByGenderPublic`, so "מי אמא של אופיר" → מור) + working-memory antecedent
(`lastFamilySubject`) + `resolveFamilyPronoun`, which rewrites שלה/שלו/שלהם to the
last-discussed person. "מי זה אופיר?" then "ומי אמא שלה?" → מור. Regression:
`familyPronounContinuity.test.ts` 2/2.

**F6 count queries — ✅ FIXED (0.84.0):** added `familyCountReasoner` + routing;
"כמה נכדים יש למרטיטה?" → "יש למרטיטה 6 נכדים: אופיר, איילון, עילי, אדר, עדי ונועם."
(children/great-grandchildren too; "כמה נכדים יש לי" → "לך"). Regression:
`familyCountQueries.test.ts` 4/4. Family cycle (F1–F6, M2) now complete in text.


| id | input | observed | expected | sev |
|----|-------|----------|----------|-----|
| F4 | ¿quién es Ofir? (Spanish) | "אני לא בטוחה בקשר הזה" (fails; answers in Hebrew) | Ofir is female (Mor's daughter), Spanish reply | 🟠 |
| M2 | (after "מי זה אופיר") "ומי אמא שלה?" | "אני לא בטוחה בקשר הזה" (no continuity) | Mor (Ofir's mother) | 🟠 |
| F3 | מי הבת של מרטיטה? | general → LLM | from graph | 🟠 |
| F6 | כמה נכדים יש למרטיטה? | general → LLM | count from graph | 🟠 |
| F1 | מי זה אופיר? | family → "מרטיטה הסבתא של אופיר (דרך מור)" ✅ | — | ✅ |
| F2 | מה הקשר בין לאו לאנבל? | family → "לאו דוד רבא של אנאבל" ✅ (verify) | — | ✅ |
| F5 | מי זה חורחה? | general → LLM (unknown — must not invent) | 🟡 verify honesty |

---

## Cycle 4 — CALENDAR creation (drafting logic; save/readback/correction ✅ verified)

| id | input | observed | expected | sev |
|----|-------|----------|----------|-----|
| C4 | קבעי ארוחת ערב עם אנבל ביום שישי בשמונה | ✅ time FIXED (0.86.0): dinner ⇒ 20:00 (was 08:00). Title "פגישה עם אנבל" (meal-noun title still open, low sev) | 🟡 |
| C5 | ...בקופת חולים בכפר סבא בתשע | ✅ FIXED (0.87.0): location → "קופת חולים בכפר סבא" (added קופת חולים to VENUE_HEAD; time never leaks) | ✅ |
| C1,C2,C3 | person+relday+time / place+relday+time / **בחצות→00:00** | ✅ correct | — | ✅ |
| MT | create→"כן"→readback→correction "לא בארבע" | ✅ saves 19:00, recallable, correction→16:00 | — | ✅ |

**Note:** the create→confirm→save→readback→modify chain WORKS in text (proven with a
localStorage mirror). A prior "לא נשמרה" reading was a node-env artifact (no localStorage),
NOT a product bug.

---

## Cycle 5/6 — ONLINE / current-info — ✅ cache-collapse FIXED (0.85.0); live grounding PREVIEW

Controller routing is clean: O1–O4 classify `online` and pass the ACTUAL question; a
2-turn probe (`onlineStaleAnswerProbe.test.ts`) confirms consecutive DIFFERENT online
turns each get their own answer.

**Root cause of "repeated identical answers" — FOUND + FIXED in CODE:** the provider's
stale-while-revalidate cache (`answerOnlineCurrentInfo`) was keyed by the COARSE
`queryKind` (general_current / news / sports / …), so two different questions of the same
kind within the 30-min TTL returned the SAME cached answer. Now keyed by
**kind + the specific query** — identical repeats still hit the cache; different questions
never share an answer. Regression: `onlineCacheCollapse.test.ts` 2/2.

**Still PREVIEW-class (cannot be proven with a mock):** end-to-end LIVE grounding — that a
real "current/latest/today" question returns a correct, sourced answer from the live
provider. Needs a real deployed call; do not upgrade the evidence class from CODE.

---

## Priority order (highest user-ROI × provability first)

1. **DATE** D4/D5 (confidently wrong) + D3/D6/D7/D12 (LLM punt) + D9 (hallucination risk) — Cycle 1.
2. **QUALITY** Q2 (knowledge Q misrouted to frustration) — Cycle 2.
3. **FAMILY** F4/M2/F3/F6 (Spanish + continuity + graph counts) — Cycle 3.
4. **CALENDAR** C4/C5 (title + dinner-time + location) — Cycle 4.
5. **ONLINE** provider-boundary stale-answer reproduction (PREVIEW class) — Cycle 5.

## Cycle 9 — DATE/TIME ARITHMETIC (from expanded probe 2) — ✅ FIXED (0.88.0)

`src/eval/intelligenceGapProbe2.test.ts` (harder corpus) surfaced that dateReasoner did
fixed offset WORDS but not ARITHMETIC. Fixed: `בעוד N ימים/יומיים/שבוע/שבועיים/N שבועות`
→ forward date; `בעוד N שעות/שעה/שעתיים` → clock + N hours. "בעוד שלושה ימים" → 18 ביולי
(was TODAY); "מה השעה בעוד שעתיים" → 12:00 (was 10:00). Regression:
`relativeDateArithmetic.test.ts` 6/6.

### Still-open gaps found by probe 2 (ranked for next cycles)
- ✅ **FAM-SIB** "מי אח/אחות של X" (siblings) — FIXED (0.89.0): `siblingsByGenderPublic` +
  brother/sister/plural rules. "מי אח של מור" → לאו. Regression: `familySiblings.test.ts` 3/3.
- 🟠 **mid-create person change** "לא, לא עם דני, עם מור" → falls to the LLM (day change works).
- 🟠 **ES-FAM/ES-CREATE** Spanish "la hija de X" relation + "agendá una cena …" create → LLM.
- 🟡 **next-weekday** "מתי יום ראשון הבא?" → LLM. **AGE** "בן כמה עדי?" → LLM (age may be absent).

Voice/audio dimensions: **DEFERRED, not done.**
