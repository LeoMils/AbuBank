# AbuAI — Final Go / No-Go

The honest boundary between "the code is as ready as code can make it" and "only Martita can tell us if it's a companion."

> **Run-3 update (2026-06-22): deep-review release blockers closed.** Memorial-date contradiction removed from the live prompt (defers to data/tool; `memorialDatePromptContract.test.ts`); billable OpenAI key removed from all client code → server-proxied (`clientProviderKeyContract.test.ts`, `ENV_CONTRACT.md`); version sync test-locked. Spend-cap enforcement + Open-Meteo confirmed contract-only/unwired (not live defects). Suite **4585/0**, build+PWA green, harnesses pass. Remaining: D-1 soft confirmation (Leo), device/voice (Leo), real-use quality (Martita).

## What is GREEN (proven by executed evidence — code-side closed)
- **Engineering:** tsc clean · **4570 tests pass** · vite build + PWA green.
- **Persistence:** IndexedDB durable store + localStorage mirror; migrate→evict→restore e2e passed.
- **Family (facts):** kinship/aliases/inference + Martita-POV phrasing; **unknown relations decline (no invention)** — `unknownRelationSafety.test.ts`.
- **Calendar:** read/write/reminders/week/previous-week/before-after (incl. bare-word `אחרי ארבע` reads — `boundaryTimeQuery.test.ts`); readback before "קבעתי"; no fake-save; no wrong-day.
- **Conversation continuity (deterministic):** 20-turn pronoun/topic-switch/תמשיכי/עליה chain — `continuity20.harness.ts` 12/12 + `longContext` 20/0.
- **Spanish shaping (deterministic):** resolver + shapers emit well-formed Rioplatense, no Hebrew leakage — `spanishScenarios.harness.ts` 11/11.
- **Online:** grounding + freshness live-proven on deployed Edge (real sources).
- **Trust:** no fake-save / no raw JSON / no raw tool / **provider error → safe localized message** (`providerErrorMapping.test.ts`) / no invented relations / no wrong-day.
- **Summary memory bug fixed:** `generateLLMSummary` now uses the real proxy contract — `summaryProxyContract.test.ts`.
- **Voice code-path safety (no device):** placeholder/invalid key → quiet fallback, bounded retries — `voiceKeySafety.test.ts`.

## What ONLY LEO can validate (device / environment)
- Real microphone capture, realtime session, and TTS playback on Martita's phone (Block H).
- Behavior against the **deployed** URL end-to-end (local `vercel dev` Edge emulation is broken on Node 24 — not a code defect).

## What ONLY MARTITA can validate (real-user quality)
- Whether the **real-model** Hebrew warmth, Rioplatense Spanish, and emotional prose feel like Abu (Blocks A, D, E).
- Companion feeling, non-robotic tone in real use, and her own willingness to keep using it.

## Decisions required from Leo before pilot
- `LEO_DATA_DECISIONS.md` **D-1** (memorial date) — blocks Block E.
- `LEO_DATA_DECISIONS.md` **D-2** (Yarden label) — fix before relying on birthday reminders.

## The Go / No-Go rule
Run the 10-minute pilot and fill the scorecard. Then:

**GO → READY_FOR_MARTITA_FINAL_PILOT confirmed as production** only if ALL hold:
1. **0 hard-fails** in the whole session.
2. **Average block score ≥ 3.5 / 5.**
3. **No single block below 3.**
4. **Spanish (D) ≥ 3 AND Voice (H) ≥ 3** individually (the previously-unproven areas).
5. Martita, unprompted, indicates she would use it again.
6. D-1 resolved (and D-2 if birthday reminders are in scope).

**NO-GO** if any of the above fails → log the exact failure, fix the specific blocker, re-run only the affected block(s).

## Honest status line
- **Code-side: closed** to the highest level achievable without a device or a real user.
- **Product-side: unproven** until the pilot. Full production may NOT be declared before a passing pilot.
- Current standing: **READY_EXCEPT_LEO_AND_MARTITA_ONLY.**
