# Adversarial review — what could still go wrong that the Golden Session would NOT catch?

The Golden Session is real progress, but it is not omniscient. Honest list of its blind spots so the
next reader does not mistake a green golden run for "the product works on her phone."

## Biggest gaps (by severity)

1. **AUDIO PATH — the instrument is TEXT-only (CODE/MOCK, never PHYSICAL_DEVICE).** It proves tool
   routing, language, groundedness, refusals — NOT that Martita HEARS warm, natural audio, that there
   is no echo/self-interruption, no barge-in collision, acceptable latency, or that the two-response
   audio timing is right. Every one of tonight's most painful failures was audio-shaped. A green
   golden run must NEVER be reported as "voice works." Only the owner's ear closes those rows.
2. **Online endpoint staleness (#5) is MOCKED.** The runner injects a clean get_current_info result,
   so it cannot catch the real `/api/abuai-online` returning a stale 4–10-day-old snippet or a query
   that ends in "ציין מקור". That is a LIVE-endpoint test we still owe (hit the deployed online route
   with a known-fresh query and assert freshness + no source-echo). OPEN.
3. **Enforcement repair UX is unproven on device.** Part 4 turns a foreign-language leak into a
   next-turn Hebrew re-speak. That ends her in Hebrew (good) but she still HEARD the leak first, and
   the audible double-utterance could feel odd. Proven in wiring, not in the ear. Watch on device.
4. **Tool-result watchdog could double-speak.** If a grounded response is merely SLOW (>4s) rather
   than dead, the 4s watchdog forces a second response. Safe (never silent) but could overlap. The
   deterministic test only covers the clean cases; device timing is unverified.
5. **Calendar corrections mid-draft are untested.** The arc does create→confirm→readback but not
   correct_calendar_field mid-draft, cancel, or the "אח של מור" participant-relationship resolution —
   exactly where the 20-min device trace showed the model getting tangled. ADD to the arc next.
6. **Model variance.** 17/18 is ONE sample of a stochastic model. Confidence needs several runs; a
   single green run is not a guarantee. (online_followup already flips between deflect/offer.)
7. **Verbosity (the owner's #1 complaint) is only loosely gated.** maxWords=45 is generous; a
   rambling-but-under-45 answer passes. Length enforcement was deliberately left off (an audible
   re-speak worsens it). This is a product-tuning gap, not a bug the golden session will flag.

## Closed tonight from this review
- **#4 identity** — added `detectAsksIdentity` + the greeting turn now forbids asking who she is
  (a greeting saying "מה שמך?"/"עם מי אני מדבר?" now FAILS the golden session). Previously the
  greeting check only covered menu/preamble and would have passed tonight's #4.

## Standing rule
Report the golden session as CODE/MOCK evidence of cognition + wiring. It OVERRIDES nothing about
audio. The Acceptance Board voice rows stay red/yellow until the owner hears them.
