# What only Leo can test — bring a phone, not a debugger

Everything on this list needs **human ears on a real iPhone**. Nothing here is code-findable;
if a defect Leo finds is NOT on this list, the automated estate failed and that defect becomes a
test the same day (see docs/warroom/).

1. **Audibility** — does Martita actually hear Abu, and is the **full sentence** heard (no
   truncation, no cut-off tail)?
2. **Real transcription** — does STT understand a real **80+ Argentine-accented Hebrew** voice
   (and Rioplatense Spanish), not a clean synthetic one?
3. **Latency feel** — does the reply arrive fast enough to feel like a conversation, not a form
   submission? (board: ~20s observed on device is the standing failure.)
4. **Barge-in feel** — when she interrupts, does Abu stop and listen naturally (Realtime path),
   or talk over her (pipeline path)?
5. **Warmth** — does Abu *sound* warm and present, or robotic? Warmth is heard, not asserted.

Supporting device checks (also human, also not code-findable):
- Mic-permission walkthrough on a fresh PWA install; does Abu speak first on first launch?
- Does a new deployed version actually reach her device (SW update), never mid-conversation?
## New since the last build — test these on the device, riskiest first

1. **One voice engine (v0.236) — highest risk, it changed a screen.** In the יומן (calendar),
   tapping the gold mic ("דברי אליי") now opens **Abu AI** instead of recording inside the calendar —
   there is one voice engine, not two. Say an appointment or reminder to Abu ("תקבעי לי תור לרופא מחר
   בארבע") and confirm it (a) is created, (b) shows up in the calendar, and (c) can be changed by talking
   ("תעבירי לחמש"). Feel whether the jump-to-Abu is natural or jarring for her. The create/read/edit
   logic is proven in code; the *feel* is device-only.
2. **Idle lifecycle (v0.233) — does she feel abandoned or held?** Start a voice chat and go quiet.
   At ~25s Abu should ask once, warmly, "את שם?"; at ~45s a warm goodbye ("אני נחה רגע… תגעי במסך…")
   and the session closes. Tap the screen — it should resume with the conversation intact, never from
   scratch. Confirm Abu NEVER cuts off mid-answer or mid-appointment. (Cost saving from this is proven
   in the model; the *warmth* of the goodbye/resume is device-only.)
3. **Online depth (v0.238) — does "what's new" give a real briefing?** Ask "מה חדש היום?" — Abu should
   give **several distinct headlines** (Israel, world, culture, entertainment, society, health — not
   sports/economics), then offer "רוצה שאפרט על אחד מהם?"; pick one and confirm she elaborates. If the
   provider is not configured she should honestly say she cannot check — never invent. NOTE: needs a
   live search provider in prod (Tavily key is dead — set `ONLINE_PROVIDER=brave` or rotate the key).
   Ask about a movie — she should point you to the cinema, not recite made-up showtimes.

> Everything else — family facts, relationships, calendar continuity, online grounding honesty,
> invariants, RTL, overflow, no-billable-key — is proven (or provable) without a device and is
> owned by the automated war room, not by Leo.
