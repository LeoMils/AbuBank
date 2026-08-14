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
- **One voice engine (v0.236, NEW):** in the יומן (calendar), tapping the gold mic ("דברי אליי")
  now opens **Abu AI** instead of recording inside the calendar — there is one voice engine, not two.
  Say an appointment or reminder to Abu ("תקבעי לי תור לרופא מחר בארבע") and confirm it (a) is created,
  (b) shows up in the calendar, and (c) can be changed by talking ("תעבירי לחמש"). This is a screen
  change to feel for warmth/flow on a real device; the create/read/edit logic itself is proven in code.

> Everything else — family facts, relationships, calendar continuity, online grounding honesty,
> invariants, RTL, overflow, no-billable-key — is proven (or provable) without a device and is
> owned by the automated war room, not by Leo.
