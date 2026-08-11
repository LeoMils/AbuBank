# Abu-ela — iPhone test script (for Leo)

For the build on the RC branch (see the QA version at the top-left of the home
screen). Do these **in order — riskiest first**. For each: what to **say**, what
**should happen**, and what the **trace** should show. To read the trace: open Abu AI,
tap **תיעוד ⤓** (bottom-left) after a few turns — it downloads a text file; the lines
look like `👤 מרטיטה: …` (you), `🤖 אבו: …` (Abu), `🔧 tool(…) → …` (a tool).

No programming needed. If something is wrong, note the item number + what happened.

---

### 1. She hears you and answers, in Hebrew, out loud  *(riskiest)*
- **Say:** "בוקר טוב אבו, מה שלומך?"
- **Should happen:** within ~2 seconds she answers warmly in Hebrew, **out loud**, 2–4
  sentences, and does not get cut off mid-sentence.
- **Trace:** `👤 מרטיטה: בוקר טוב…` then `🤖 אבו: …`. **No** `⚠️ SILENT TURN`, **no**
  `⚠️ POSSIBLE AUDIO TRUNCATION`.

### 1a. Her face is alive while she talks  *(new — animated presence)*
- **Look:** the Abu AI screen now shows a warm grandmother character, not a plain orb.
- **Should happen:** while she **speaks**, her **mouth moves in time with her voice**
  (open on louder sounds, closed when silent); she **blinks** now and then and breathes
  gently. The glow around her changes by state: teal = מקשיבה, amber = חושבת, gold =
  מדברת, calm blue = מוכנה. It should feel warm, **not** jerky or uncanny.
- **Note:** the character art is an **interim** drawing (a nicer illustration is being
  commissioned); what to judge here is that the movement feels alive and matches her voice.

### 2. Room noise does NOT cut her off  *(barge-in)*
- **Do:** while she is speaking a long answer, stay quiet but let normal room noise
  (a TV low, a tap) happen.
- **Should happen:** she keeps talking; brief noise does not interrupt her. If YOU
  actually speak, she stops and listens.
- **Trace:** while she speaks, no `POSSIBLE AUDIO TRUNCATION` from mere noise.

### 3. A confirmed appointment is saved ONCE  *(no duplicates)*
- **Say:** "תקבעי לי תור לרופא שיניים ביום רביעי בתשע." then, after she reads it back,
  "כן, תשמרי."
- **Should happen:** she confirms it is saved — **one** event, not several.
- **Trace:** one `🔧 confirm_calendar_event(…)` with `[confirmed by: voice]`, and the
  result shows `saved:true`. You should NOT see the same tool three times with results.

### 4. What she saved can be read back and changed
- **Say:** "מה יש לי ביום רביעי?" then "תעבירי את זה לעשר."
- **Should happen:** she reads back the dentist at 9, then confirms it moved to 10.
- **Trace:** `🔧 read_calendar` returns the event; `🔧 update_calendar_event` returns
  `status:updated`.

### 5. Family — who is who, in correct Hebrew
- **Say:** "מי זה גלעד?" · "מה הקשר בין גלעד לעילי?" · "מי הנכדים שלי?"
- **Should happen:** Gilad is Ofir's husband; **Gilad is Eili's גיס**; the six
  grandchildren are named. She never invents a relationship.
- **Trace:** `🔧 people_lookup(want:"relationship" …) → "גלעד גיס של עילי"`.

### 6. Call someone by their relationship
- **Say:** "תתקשרי לבת שלי."
- **Should happen:** she resolves it to **Mor** and shows a call card with a big
  button (she does NOT read a phone number aloud). "תתקשרי לנכד שלי" should make her
  ask **which** grandson.
- **Trace:** `🔧 people_lookup(want:"contact", person:"הבת שלי") → resolved … מור`. No
  phone number anywhere in the trace.

### 7. Names are said the Spanish way
- **Say:** "ספרי לי על לאו."
- **Should happen:** she says "Leo" as **"LEH-oh"** (two syllables), not English
  "LEE-oh"; other family names sound natural, not anglicised.
- **Trace:** n/a (this is about how she *sounds* — listen).

### 8. Current info — honest, never invented
- **Say:** "מה מזג האוויר עכשיו בכפר סבא?"
- **Should happen:** the online provider is now **chosen** (Tavily won the real bake-off:
  100% sourced, clean Hebrew, ~2s). If it has been **activated in the server env**
  (`ONLINE_PROVIDER=tavily` on Vercel — a one-line deploy setting), she answers with a
  real forecast **and a source**, in ~1–2 seconds. If it has NOT been activated yet, she
  still behaves as before — honestly says she **could not check** rather than guessing.
  Either way she must **never** invent a forecast or a fake source.
- **Trace:** `🔧 get_current_info(…)`; either a grounded answer **with a source**, or
  `status:"no_result"` → she says she could not check. Never a confident answer with
  no source. (Family / calendar questions are **never** sent online — verified.)

### 9. Abu News screen
- **Do:** from the home hub, open **Abu News**.
- **Should happen (today):** either real headlines each with a **source and a time**,
  or an honest "I could not bring the news now" — **never** blank half-cards or
  stale/made-up stories.

### 10. The hub, and always a way back
- **Do:** from home, open each app (Abu AI, Bank, יומן, WhatsApp, Games, מזג אוויר,
  News) and come back.
- **Should happen:** every app opens and has an obvious **back** control that returns
  to the home hub. Text is large and readable at arm's length. Abu AI opens the live
  conversation (not an old text screen).

---

**What is NOT expected to be perfect yet (do not report as bugs):**
- Real current-info / news: the winner (Tavily) is chosen and wired, but only goes live
  once `ONLINE_PROVIDER=tavily` is set in the Vercel server env. Until then she honestly
  says she could not check (never guesses). Tavily is fast (~2s) but a few queries can
  take ~3s — a brief "checking…" is expected, not a freeze.
- The Abu AI character is now **animated** (mouth follows her voice, blink, breathing,
  state glow) but the art is an **interim** drawing; a nicer illustration is being
  commissioned. Judge the *movement/warmth*, not the drawing polish.
- Design migration so far: the home hub, Abu Bank, Abu News **and the Abu AI screen** are
  in the Night-Garden design. **Weather, Games, Calendar and WhatsApp are NOT re-themed
  yet** — they keep their current look; that migration is the next task.
