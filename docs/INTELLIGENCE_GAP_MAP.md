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

Still open: **F6** count queries ("כמה נכדים יש למרטיטה?" → count from the graph).


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
| C4 | קבעי ארוחת ערב עם אנבל ביום שישי בשמונה | title→"פגישה עם אנבל" (lost "ארוחת ערב"); time→08:00 בבוקר | title "ארוחת ערב עם אנבל"; dinner ⇒ 20:00 | 🟠 |
| C5 | ...בקופת חולים בכפר סבא בתשע | location→"כפר סבא" (dropped "קופת חולים") | full location | 🟡 |
| C1,C2,C3 | person+relday+time / place+relday+time / **בחצות→00:00** | ✅ correct | — | ✅ |
| MT | create→"כן"→readback→correction "לא בארבע" | ✅ saves 19:00, recallable, correction→16:00 | — | ✅ |

**Note:** the create→confirm→save→readback→modify chain WORKS in text (proven with a
localStorage mirror). A prior "לא נשמרה" reading was a node-env artifact (no localStorage),
NOT a product bug.

---

## Cycle 5 — ONLINE / current-info (routing ✅ with mock; grounding needs live)

Routing is correct: O1–O4 all classify `online` and pass the ACTUAL question to the tool
(no cross-question collapse observed at the controller boundary). The reported
"repeated identical answers / stale" symptom lives in the REAL provider path and is a
`PREVIEW`-class reproduction (needs a live provider call) — it cannot be reproduced with a
mock at the controller. Deferred to a provider-boundary cycle; not falsely closed here.

---

## Priority order (highest user-ROI × provability first)

1. **DATE** D4/D5 (confidently wrong) + D3/D6/D7/D12 (LLM punt) + D9 (hallucination risk) — Cycle 1.
2. **QUALITY** Q2 (knowledge Q misrouted to frustration) — Cycle 2.
3. **FAMILY** F4/M2/F3/F6 (Spanish + continuity + graph counts) — Cycle 3.
4. **CALENDAR** C4/C5 (title + dinner-time + location) — Cycle 4.
5. **ONLINE** provider-boundary stale-answer reproduction (PREVIEW class) — Cycle 5.

Voice/audio dimensions: **DEFERRED, not done.**
