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

> Everything else — family facts, relationships, calendar continuity, online grounding honesty,
> invariants, RTL, overflow, no-billable-key — is proven (or provable) without a device and is
> owned by the automated war room, not by Leo.
