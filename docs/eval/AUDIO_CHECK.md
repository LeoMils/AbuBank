# AUDIO_CHECK — 5 minutes, one link, one pass

ONE link, every audio flag already enabled (far-field noise reduction + barge-in truncate + prefetch):

  https://abu-bank-m6a90tdhe-leos-projects-d3c04c09.vercel.app   (v0.266.0)

Open Abu AI on your phone, speakerphone (not the earpiece), out loud, in Hebrew. Five things to
listen for. For each: one line of what you heard, and OK or NOT.

---

1. **Full sentence audible.** Ask: "מה שלומך היום?"
   · PASS: the WHOLE reply plays start to finish, matching the text on screen — not just the first
   sentence while more text appears.

2. **No second voice.** Open Abu AI and listen to the first few seconds as she greets.
   · PASS: exactly one clean voice — never a doubled / echoey / overlapping voice.

3. **She stops when you talk.** While she is speaking, start talking over her.
   · PASS: she stops cleanly and listens. FAIL (important — tell me): she cuts to one word then goes
   silent (that is the echo returning; note it).

4. **Silence while she looks something up.** Ask: "כמה עולה הבושם בלו דה שאנל?"
   · PASS: the first WORDS you hear are the answer. A soft tone while she looks is fine.

5. **No "אני בודקת" before an answer.** Ask anything that makes her look something up
   (a price, the weather, "מה יש לי מחר"). Listen to her FIRST words.
   · PASS: she goes straight to the answer. FAIL: she says "רגע, אני בודקת" / "שנייה, אני מבררת"
   first. **This one is expected to still FAIL** — it is not fixed yet; your report of HOW LONG she
   talks before the answer is exactly the measurement we need (the app also logs it). Just note
   roughly how many seconds of "אני בודקת…" you hear before the real answer.

---
Items 1–4 test the audio flags that are now on. Item 5 is the preamble — not yet fixed; your ear on
it feeds the fix. One line each is enough.
