# AUDIO_CHECK — 5 minutes on your phone, out loud, in Hebrew

Open BOTH links (v0.259.0):
- **OFF** (audio flags off): https://abu-bank-fylxol5mz-leos-projects-d3c04c09.vercel.app
- **ON**  (audio flags on):  https://abu-bank-hsej28ty2-leos-projects-d3c04c09.vercel.app

The ON build has the two audio flags enabled (far-field noise reduction + barge-in truncate).
Do each step on OFF, then the SAME step on ON, and note which sounds better.

Speakerphone, not the earpiece — this is a speakerphone fix.

---

1. **No second voice at the start.** Open Abu AI and just listen for the first 3 seconds.
   · Listen: is there ever a doubled / echoey / overlapping voice as she greets? ·
   PASS: exactly one clean voice. (This is what far-field noise reduction should fix.)

2. **She stops when you talk over her.** While she is speaking a sentence, start talking.
   · Listen: does she stop cleanly and listen — not keep going, not cut to one word then go
   silent? · PASS on ON: she yields and hears you. (If ON cuts her to one word and then silence,
   that is the echo returning — note it, that is the key thing to tell me.)

3. **The WHOLE answer is audible.** Ask: "מה שלומך היום?"
   · Listen: does the full reply play start to finish, matching the text on screen — or does only
   the first sentence play while more text appears? · PASS: the audio matches the whole text.

4. **Silence while she looks something up.** Ask: "כמה עולה הבושם בלו דה שאנל?"
   · Listen: the first WORDS you hear should be the answer. A soft tone while she looks is fine.
   Words like "רגע, אני אבדוק" before the answer are a FAIL — note it.

5. **She does not talk to herself.** Have a normal 4–5 turn chat, then stay quiet for 10 seconds.
   · Listen: in the quiet, does she start talking on her own / repeat a greeting? ·
   PASS: she stays quiet until you speak.

---
For each: was OFF or ON better, and one line of what you heard. Any FAIL on ON step 2 (one word
then silence) is the most important line — it tells me the echo needs more taming before this ships.
