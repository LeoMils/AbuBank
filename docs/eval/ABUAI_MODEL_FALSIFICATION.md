# AbuAI — Model Falsification (Phase 2)

Belief → where proven → where it can fail → what the autonomous gauntlet found.

| Subsystem | We believed | Proven in | Falsified by (real finding) |
|---|---|---|---|
| Confirmation | "כן/כן כן/תעשי את זה save the draft" | isConfirm unit tests | **FALSE** for any confirm carrying an extra word or trailing space/politeness ("בסדר גמור ", "כן נכון תקבעי את זה בבקשה"). 919 hits/5000. |
| Cancellation | "only explicit cancel cancels" | isCancel tests | **FALSE** — an *unrecognised* confirm fell through the off-topic heuristic and was SILENTLY CANCELLED ("כן נכון תקבעי את זה" → cancel). Trust damage. |
| Draft completeness | "a full create → confirming" | happy-path tests | **FALSE** — "בשבוע הבא" (bare next-week) never resolved to a date, so the draft stayed in `creating` and a later confirm could not save. |
| Person/Location | "עם/אצל X → the person" | person tests | **FALSE** — `extractPerson` took the LAST עם/אצל, so "עם מור אצל גבי" → person=גבי, and "אצל גבי"/"בבית" were dropped as location. |
| Audio complaint | "handled as audio_help" | Experience-1.0 gauntlet | **FALSE** under STT noise — a duplicated interior word ("למה את את לא מדברת") broke the multi-token regex → off-topic cancel. |
| Continuation | "continue/תמשיכי resumes" | conversationOS tests | **FALSE** for "מאיפה שעצרת" / "continue" (es/en) — not detected → topic lost. |
| Emotional interrupt | "parks warmly" | prior fix | mostly true; noisy variants slipped to clarify until normalization was shared. |

**Systemic conclusion (SYSTEMIC FAILURE RULE):** confirmation, audio, emotional and
cancellation were each failing on the SAME class — *one extra/duplicated/polite token
defeats the intent matcher, and a missed confirm silently cancels*. The fix was NOT
per-symptom: a shared `normalizeUtterance` (whitespace + consecutive-duplicate collapse +
trailing-politeness strip) feeds all pending-intent matchers, `isConfirm` accepts benign
filler, and an **affirmative-word guard** blocks the off-topic cancel. One layer, many
failures closed. Proven by 0 violations across 29,000 generated conversations.
