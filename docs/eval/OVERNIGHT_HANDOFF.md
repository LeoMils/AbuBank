# MORNING HANDOFF — 5 minutes (overnight run, v0.272.0)

## ⚠ STEP 0 — DO THIS FIRST, or the rest is untestable (2 min)
The OpenAI project is at **ZERO credit**. Proven tonight: the realtime session OPENS (mint is free) then the
first reply returns `credit_balance_exhausted`. **That — not a transport bug — is why the last three sessions
spent ~$0 and Layer 3 never ran.** Until you add credit, Abu's voice falls back to the backup pipeline (or
errors), so an ear check would test the FALLBACK, not the real voice.

→ **Go to platform.openai.com → Billing → add credit.** Then everything below becomes real.

## THE EAR CHECK — 5 things, one link, Hebrew, speakerphone (3 min)
Open Abu AI on your phone, out loud. One line each: what you heard + OK / NOT.
Link (audio flags baked in): **https://abu-bank-m6a90tdhe-leos-projects-d3c04c09.vercel.app**

1. **Full sentence audible** — ask "מה שלומך היום?" · PASS: the whole reply plays, matching the screen.
2. **One clean voice** as she greets · PASS: never doubled / echoey.
3. **She stops when you talk over her** · PASS: stops cleanly. FAIL: one word then silence (tell me).
4. **Silence while she looks up** — ask "כמה עולה הבושם בלו דה שאנל?" · PASS: first words are the answer.
5. **No "אני בודקת" first** — ask "מה יש לי מחר" · **STILL EXPECTED TO FAIL.** Just tell me roughly how many
   seconds of "רגע, אני בודקת…" you hear before the real answer — that number feeds the fix (below).

## WHAT LANDED TONIGHT (no action needed — context only)
- **Credit exhaustion is now loud, not silent**: plain-Hebrew fallback to Martita (never raw English), a
  distinct operator signal, graceful fallback — so this never burns another mystery session.
- **Flag promotion ledger**: audio-tune / barge-in / prefetch / preamble-two-response can no longer be
  silently dropped after your ear confirms them — a boot assertion hard-fails if one is confirmed-but-off.
- **Two-response preamble fix (#5)**: the decision core is built + tested behind a flag, but the live wiring
  is NOT done (it can't be verified without credit). So #5 is expected to still fail — your seconds-count
  from the ear check is exactly what validates the wiring next.
- **Cost**: ~$45/mo base (realistically ~$90–225/mo) for one user at 30 min/day on gpt-realtime; the idle
  timeout that stops the "empty room" bleed already ships. Full detail in COST_ANALYSIS.md.

## MERGE READINESS
Do NOT merge (production serves Aug 5). Every non-device row is green (13,003 tests pass). The only
outstanding work is the ear check above + the model-behaviour that needs credit to observe. After you add
credit and the ear passes 1–4, the remaining items are: wire the two-response fix (#5), and run Layer 3.
