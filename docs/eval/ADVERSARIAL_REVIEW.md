# ADVERSARIAL REVIEW — what Abu could still do wrong that NOTHING here catches (overnight)

The 13,003 green tests are `CODE`/`MOCK` evidence. Real user/device/model behaviour overrides them.
This is the honest list of what remains uncaught, worst first.

## 1 · The credit wall IS the current product state — and CI cannot see it
The OpenAI project is at **zero credit** (proven tonight: mint 200, first inference 429
`credit_balance_exhausted`). If production serves from the same key, **realtime voice is degraded to the
fallback pipeline in production right now** — and no test catches it, because every test mocks the provider.
Tonight's fix makes the wall *graceful and loud in the app*, but the outage itself is invisible to the
gate. **Consequence for the ear check:** on a $0 account the owner would hear the FALLBACK voice (or an
error), not gpt-realtime — and could mistake a billing problem for an audio problem. That is the exact
three-session trap. **Add credit before any ear check.**

## 2 · All of Layer 3 (real model behaviour) is unobserved
gpt-realtime's ACTUAL behaviour has never been run at scale — the credit wall blocked it every session. So
every one of these is asserted at the INSTRUCTION level only, and the brief itself notes instruction-level
assertions have failed before in exactly this way:
- The 6 declines (taxi/email/med-alarm/money/navigate/games) — does she actually decline, warmly, in Hebrew?
- Spanish, and mid-conversation language switching both directions — never executed.
- 50+ turn drift: persona slippage, repeated sentences, self-contradiction, latency creep — never measured.
- Warmth on the emotional edges (Pepe memorial, loneliness) — a clinical or dismissive reply passes every
  deterministic test. Unheard.

## 3 · The two-response preamble fix is NOT wired — #5 will still fail
Tonight built + tested the DECISION CORE (`preambleTwoResponse.ts`) behind a flag. The live-session wiring
(per-response `output_modalities` + client-driven turns) is UNBUILT — it cannot be verified without credit,
and wiring an unverifiable change into the hot voice path is a regression risk. **So AUDIO_CHECK #5 (the ~4s
"אני בודקת" preamble) is still expected to FAIL even with the flag on** — the flag currently gates logic not
yet connected to the live path. The gap number the owner records feeds the wiring; it does not yet fix it.

## 4 · Idle-timeout tail — no absolute max-session cap
The 45s warm-goodbye+close is gated behind `!midTask`, and `midTask = responseLeased || hasActiveDraft`. If
`responseLeased` ever sticks true (a half-dead connection whose `response.done` never arrives), `midTask`
stays true and the session NEVER closes → unbounded open-session cost. The 5s AUDIO_TIMEOUT watchdog usually
releases the lease, so the window is small — but there is NO absolute ceiling independent of `midTask`. The
lifecycle tests drive clean clocks, so this tail is uncaught. A hard force-close at ~30 min would close it.

## 5 · Cost assumptions unverified until a real bill
The monthly estimate assumes the Realtime API auto-caches the ~1,900-token session prefix. If it does not,
real cost is the 2–5× re-processing multiplier — up to ~$225/mo for ONE user at 30 min/day. Uncaught until
the usage report (cached-token count) is read against a funded account.

## 6 · Fallback voice QUALITY is unheard
The fallback can hear (Groq STT, free) and speak (Azure → Gemini → Web Speech). But if the Azure AND Gemini
keys are also unfunded/invalid, TTS degrades to robotic Web Speech — a poor experience for Martita that no
test catches (they mock the providers). The fallback's *wiring* is proven; its *warmth* is not.

## 7 · Schema / contract drift
The mint ladder handles model AVAILABILITY (400/404 → next candidate), but not a new REQUIRED session field
or a renamed event that the normalizer does not yet know. A silent schema change would surface only as a
live-session failure, not in CI.

## 8 · Coverage gaps in the (unrunnable) harness
Even when credit returns, the text harness today has NO scenario for: mid-conversation language switching,
and 3 of the 6 declines (med-alarm, money-transfer, navigation, games — only email/taxi/reminder exist). These
must be ADDED before the harness can claim to probe item 3 — named here so they are not assumed covered.

## The single highest-leverage action
**Add OpenAI credit.** It unblocks the real voice (product), Layer 3 (the whole thin layer), the two-response
wiring validation, and the cost measurement. Everything expensive and unknown is downstream of that one step.

---

# ADDENDUM — credit-live run (v0.275.0). What is STILL uncaught after running the real model.
Credit is added; Layer 3 ran; a safety defect was found+fixed. New/updated risks, worst first:

1. **The medication guard is a regex — it will miss phrasings it does not enumerate.** It now catches generic
   pill/dose/insulin terms + common Israeli brands, but a drug it does not list, described obliquely ("my
   morning white one", a niche brand), would slip through and the model WILL set the reminder (proven behaviour).
   A regex is the right emergency fix; a durable fix is a small classifier or an allow-list-of-safe-reminder-
   categories. **Every un-listed medication name is a live gap.** Tests cover only the enumerated set.
2. **Two-response is wired but its BENEFIT is unproven** — the instrument showed the model speaks no preamble
   at all, so the fix targets a device-only behaviour I could not reproduce or measure. It could (a) do nothing
   if the ~4s is tool latency not speech, or (b) subtly break turn-taking on the device in a way no test caught
   (the flag is off by default, so production is safe, but the A/B could surprise).
3. **50+ turn drift / self-contradiction / latency-creep was NOT run.** Long-session degradation — the thing
   most likely to make Abu feel "off" over a real half-hour call — remains unmeasured.
4. **The Spanish calendar flow returned empty once** on the instrument. Whether that is a probe artifact or a
   real dropped-turn in Spanish is unresolved — a Spanish speaker relying on the calendar could hit silence.
5. **Cost is a lower bound.** ~$66/mo measured with TEXT input; a real mic session also bills audio-input
   (~$32/1M). A talkative user, or many short sessions each paying the cold-cache first turn, pushes it higher.
6. **The guard refuses via a tool RESULT the model must honour.** It creates no reminder (safe), but the model
   is only INSTRUCTED to decline — if a future prompt change made it ignore the result and improvise a
   confirmation, the user could THINK a medication reminder was set when none exists. The safe state (no
   reminder) holds; the spoken message is the model's, not guaranteed.
7. **Deploy is unverified.** No flagged Preview was produced (Vercel auth). The device build the owner tests
   must be confirmed to actually carry the four flags (the boot log now lists them — check it).

Highest-leverage next: run the 50+ turn drift probe, and broaden the medication block beyond a name list.
