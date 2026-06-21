# RC7 GATE REPORT

Every non-microphone gate is **GREEN (code-fixed + proven)** or **BLOCKED (with exact proof + ready command)**. No silent skips. Verdict at bottom.

Engineering baseline (this commit): `tsc` clean · **4484 tests pass** · `vite build` green · harnesses: rc6TextPath 26/26 floor, companionBrain 17/17, rc5Product 19/19, familyReasoning 27/27.

| # | Gate | Status | Evidence / Blocker |
|---|------|--------|--------------------|
| 1 | Planner runtime integration | 🟢 GREEN | `planCompanionTurn` mandatory at top of `handleSend` + `handleText`; `companionRuntimeGuard.test.ts` asserts presence; surfaced in diagnostics every turn. |
| 2 | Composer — all paths | 🟢 GREEN | ~22 emission points routed through `enforceCompanion` (pushAssistant ×3, recall, proactive ×2, content-world, gender, advisory, online, recurring, grounded, both streamings). Guard test: no banned literal, composer on every dynamic path. |
| 3 | Streaming / open-chat guard | 🟢 GREEN | both streaming finalizations (`index.tsx` text + voice) run `enforceCompanion`. |
| 4 | Family reasoning | 🟢 GREEN | multi-hop incl. great-grand/aunt/uncle/cousin + partner alias; `rc3FamilyReasoning`, `familyReasoning.harness` 27/27. |
| 5 | Family data integrity | 🟡→see ledger | runtime reads `family_data.json` (correct); `validate-family-data` green. **Memorial date (01-01 vs 12-26) is a HUMAN_DATA_DECISION** — see ledger L-1. |
| 6 | Calendar read | 🟢 GREEN | exact/after/**before**-time now actually filter the answer (render-layer fix); `warRoom` T2b proves. |
| 7 | Calendar write/save/readback | 🟢 GREEN | readback is now **time-precise** (title+date+time); recurring path readback added; never says "קבעתי" without verification. |
| 8 | Calendar trust (no fake-save) | 🟢 GREEN | `createAppointmentSafe` + confirm readback + recurring readback; fail → "לא נשמרה". |
| 9 | Memory continuity | 🟢 GREEN | planner continuity consumed → "ספרי לי עליה/עליו", "תמשיכי", "ועוד?" rewrite to grounded; standalone "עזבי"/"לא לזה התכוונתי" handled; "תחזרי למור" grounds via known-name. |
| 10 | Follow-up understanding | 🟢 GREEN | `resolvePronouns`/`resolveFollowUp` + planner continuity; rc6 harness MEMORY/CORRECTION convos. |
| 11 | Online grounding | 🔴 BLOCKED_BY_NETWORK | real web_search via `/api/abuai-online`; no outbound network here. Honest-failure fallback IS proven. Ready: see RC7_LIVE_GATE_STATUS.md. |
| 12 | Online freshness | 🔴 BLOCKED_BY_NETWORK | same; cannot fetch live sources. |
| 13 | Hebrew naturalness | 🟢 (deterministic) / 🔴 (live prose) | Deterministic shapers: terse≠rich, no dumps — `familyTone.test.ts` proven. Real-model open-chat prose tone: BLOCKED_BY_KEYS. |
| 14 | Spanish naturalness | 🟢 (deterministic) / 🔴 (live prose) | `shapeFamilyAnswerES` Rioplatense + Latin names, no colon-dump — proven. Live ES prose + ES relational routing: see ledger L-2 (code-fixable) / BLOCKED (prose). |
| 15 | Emotional intelligence | 🟢 (decisions) / 🔴 (live wording) | suppression rule + frame hierarchy proven (companionBrain 17/17). Felt warmth of generated wording: BLOCKED_BY_KEYS. |
| 16 | Conversation flow | 🟢 (deterministic) | continuity + bridges + acts proven on the deterministic path; live multi-turn prose BLOCKED. |
| 17 | Companion feeling | 🔴 BLOCKED_BY_KEYS | requires real generated transcripts to judge; harness ready (rc7LiveAcceptance). |
| 18 | Long conversation quality | 🔴 BLOCKED_BY_KEYS | 10–30 real LLM turns; staged in scenarios, runs on unblock. |
| 19 | Diagnostics | 🟢 GREEN | every turn logs CompanionPlan + route + source + engine + calendar + gender; no "?" for exercised paths. |
| 20 | Persistence | 🟠 CODE-FIXABLE, NOT DONE | localStorage only (evictable). Migration to IndexedDB is fixable in code; see ledger L-3 (deferred — large/risky, not attempted blind). |
| 21 | Real microphone/audio | 🔵 LEO-ONLY | `REAL_IPHONE_MICROPHONE_AUDIO_FEEL` — by design. |

## Color legend
🟢 GREEN (proven) · 🔴 BLOCKED (external: keys/network) · 🟠 CODE-FIXABLE not done (honest) · 🔵 Leo-only · 🟡 human-data decision

## Verdict
`RC7_NOT_READY` — blocked by network/keys gates (11,12,17,18 + live prose for 13–16) and one honest code-fixable item not done (20 persistence), plus a human-data decision (L-1). All deterministic companion behavior is GREEN and proven.
