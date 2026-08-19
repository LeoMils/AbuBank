# FINAL SCOREBOARD — non-green → green

Measured by the 2,730-conversation Product Destruction Lab (real runtime) + the
Conversation Quality Judge + the Product Reality Corpus. 🟢 = code-testable green
(regression-locked). 🟡 = partially green / documented gap. 📱 = device-only.

| Area | Before | Failures found | Fix | After | Evidence |
|---|---|---|---|---|---|
| Forced menu / phone-tree | 🔴 | 99 conv | menu-free warm re-prompt | 🟢 | lab 0, corpus |
| Incremental calendar create | 🔴 P0 | "can never save" | resolveFollowUp gate + slot fold | 🟢 | corpus save proof |
| Reminder "לי" garbage | 🔴 P0 | fabricated save | reject empty/pronoun title | 🟢 | corpus |
| Time query ("מה השעה") | 🔴 P0-class | LLM/"03:00" | clock-grounded timeReasoner | 🟢 | corpus 20:00 |
| Family gender Hebrew | 🔴 P1 | "מור היה נשוי" | verb agrees w/ child subject | 🟢 | corpus |
| Online follow-up continuity | 🟡 | weather+sports hijack | online-context + focus-on-fail | 🟢 | lab 0 |
| Calendar property continuity | 🔴 | "באיזה שעה?"→LLM | calendar_event focus | 🟢 | lab, corpus |
| Currency / price routing | 🟡 | →LLM | ONLINE_HE_CURRENT | 🟢 | corpus |
| Transport routing | 🟡 | dead-end | tool-gate sync | 🟢 | corpus |
| Exit / context switch | 🟡 | draft not dropped | exit + switch regex | 🟢 | corpus |
| Memory recall | 🟡 | echoed meta-question | isNonTopicTurn | 🟢 | corpus |
| Conversation repair | 🟡 | 2 phrases→LLM | FRUSTRATION_EXTRA_RE | 🟢 | corpus |
| Broken / empty input | 🟡 | empty LLM prompt | degenerate guard | 🟢 | corpus |
| "עוד פגישה" create | 🔴 | create dropped | anchored continuation regex | 🟢 | full suite |
| Double-book awareness | 🟡 | silent | additive conflict warning | 🟢 | full suite |
| "מחרתיים" read | 🟡 | wrong day | added branch | 🟢 | full suite |
| Spoken decimals | 🟡 | "3. 65" | decimal mask | 🟢 | unit |
| Family grounding / no-hallucination | 🟢 | none | — | 🟢 | agent-verified |
| Online-failure honesty | 🟢 | none | — | 🟢 | agent-verified |
| Empty-calendar no-invention | 🟢 | none | — | 🟢 | agent-verified |
| Slot extraction (1-turn) | 🟢 | none | — | 🟢 | agent-verified |
| Stored-event edit after save | 🟡 | no-op/LLM punt | DEFERRED (data-mutation) | 🟡 | documented todo |
| "תמשיכי" resume of draft | 🟡 | misleading reply | DEFERRED (no data loss) | 🟡 | documented todo |
| Spelling variant "אנבל" | 🟡 | →LLM | DEFERRED (low impact) | 🟡 | documented todo |
| Physical mic / STT / TTS feel | 📱 | — | device-only | 📱 | needs iPhone |
| WebRTC / Realtime audio loop | 📱 | token mints server-side | device-only | 📱 | needs iPhone |

## Totals
- Code-testable areas turned GREEN this war room: **17**.
- Remaining code-side 🟡 (documented, deferred for data-safety / low-impact): **3**.
- Device-only 📱 (only Leo's iPhone can clear): **2**.

## Gates (this branch has concurrent version-bump activity from parallel agents;
version-pin tests are owned by that parallel flow, not this work)
- typecheck: clean · full suite: AbuAI changes green (9,323+ passing) · destruction
  lab: 2,730 conv, 0 code-side failures · reality corpus: 19/19 · quality judge:
  no P0, avg ≥ 4 on runtime-composed answers.
