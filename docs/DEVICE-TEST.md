# Abu-ela — iPhone test script (for Leo)

For the build on the RC branch (check the QA version at the top-left of the home screen —
it should read **0.211.0** or higher). Do these **in order — riskiest first**. For each:
what to **say**, what **should happen**, and what the **trace** should show. To read the
trace: open Abu AI, tap **תיעוד ⤓** (bottom-left) after a few turns — it downloads a text
file; lines look like `👤 מרטיטה: …` (you), `🤖 אבו: …` (Abu), `🔧 tool(…) → …` (a tool).

No programming needed. If something is wrong, note the item number + what happened.

---

### 1. She hears you and answers, in Hebrew, out loud — and is NOT cut off  *(riskiest)*
- **Say:** "בוקר טוב אבו, מה שלומך?"
- **Should happen:** within ~2 seconds she answers warmly in Hebrew, **out loud**, 2–4
  sentences, and — critically — **speaks the whole sentence**. The bad behaviour we fixed
  was her saying one word ("מרתיטה…") and the rest appearing only as text, never heard.
  That must not happen: what you SEE as text you should also HEAR.
- **Trace:** `👤 מרטיטה: בוקר טוב…` then `🤖 אבו: …`. **No** `⚠️ SILENT TURN`, **no**
  `⚠️ POSSIBLE AUDIO TRUNCATION`.

### 2. She answers DIRECTLY — no "טוב, נבדוק", no repeating herself  *(preambles fix)*
- **Say:** "מה הקשר בין גלעד לעילי?" and, a few turns later, "מי הנכדים שלי?"
- **Should happen:** the **first words out of her mouth are the answer** — she does NOT
  say "טוב, נבדוק את הקשר ביניהם" or "רגע, אני בודקת" before looking it up. Across a longer
  chat she should not keep opening turns with the same word.
- **Trace:** the `🔧 people_lookup(…)` appears, and her spoken line is the answer itself —
  not a "let me check" line before the tool.

### 3. Her face is alive while she talks — the mouth MOVES  *(animated presence)*
- **Look:** the Abu AI screen shows a warm grandmother character, not a plain orb.
- **Should happen:** while she **speaks**, her **mouth moves** (this is the fix — before,
  only her eyes blinked and the mouth stayed shut on the iPhone). She blinks now and then
  and breathes gently. Glow by state: teal = מקשיבה, amber = חושבת, gold = מדברת, calm blue
  = מוכנה. Warm, **not** jerky or uncanny.
- **Note:** the art is an **interim** drawing (a nicer one is being commissioned). Judge
  that the **mouth moves with her voice** and it feels alive.

### 4. Room noise does NOT cut her off  *(barge-in)*
- **Do:** while she speaks a long answer, stay quiet but let normal room noise (TV low, a
  tap) happen.
- **Should happen:** she keeps talking; brief noise does not interrupt her. (We turned OFF
  the server-side "interrupt on any sound" so her own voice echoing in the room can't cut
  her. If you actually want her to stop, just start talking and then pause.)

### 5. A confirmed appointment is saved ONCE, reads back, and changes
- **Say:** "תקבעי לי תור לרופא שיניים ביום רביעי בתשע." → after she reads it back → "כן, תשמרי."
  Then: "מה יש לי ביום רביעי?" → "תעבירי את זה לעשר."
- **Should happen:** she confirms it is saved — **one** event; reads back the dentist at 9;
  confirms it moved to 10.
- **Trace:** one `🔧 confirm_calendar_event(…)` → `saved:true` (not three); `🔧 read_calendar`
  returns it; `🔧 update_calendar_event` → `status:updated`.

### 6. A meeting with SEVERAL people, including a non-contact  *(new)*
- **Say:** "תקבעי פגישה מחר בשש עם מור, אופיר ורבקה." → "כן."
- **Should happen:** she books it and reads back **all three** names — even רבקה, who is
  not in the contacts, is kept as a plain name on the event. She should NOT drop anyone.
- **Trace:** the saved event's participant shows "מור, אופיר, רבקה".

### 7. Family — the new, much bigger family, in correct Hebrew
- **Say:** "מי זה גלעד?" · "מי זאת סוזי רז?" · "מי זה חורחה?" · "מי הבת של רפי?"
- **Should happen:** Gilad is Ofir's husband; **Susi Raz** is a good friend (cosmetician,
  from the Kfar Saba Argentine circle); **Jorge** is her nephew in Argentina; "הבת של רפי"
  resolves to **Rafi's** actual child (or an honest "I'm not sure") — **never** his ex-wife.
  She never invents a relationship.
- **Trace:** `🔧 people_lookup(want:"who"/"relationship" …)` with the grounded answer.

### 8. She does NOT guess, and never mixes up two people with the same name
- **Say:** "מי זה בוריס?" then "מי זה אריאל?"
- **Should happen:** for Boris she says plainly she **doesn't know** (no guessing). For
  Ariel — there are **two** Ariels in the family (Bobby's son who drowned, and Tavela's son
  in Vancouver) — she must **not** confidently pick one; "I'm not sure which Ariel" is the
  right answer.
- **Trace:** `🔧 people_lookup(…) → not_found` → an honest "I don't know" line.

### 9. Reaching someone who has passed — gently, never a call card  *(new)*
- **Say:** "תתקשרי לפפי."
- **Should happen:** she gently says Papi is **no longer with us**, so there's no way to
  call him — she does **not** create a call card and does **not** wander into some other
  family fact. (Asking "מי זה פפי?" still works — she can talk about him with love.)
- **Trace:** `🔧 people_lookup(want:"contact", person:"פפי") → deceased`. No call card.

### 10. What she knows about YOU — food, drink, routine  *(new knowledge)*
- **Say:** "חשבתי להכין סלט עם הרבה כוסברה." · "בא לי לשתות משהו, מה מתאים לי?" ·
  "שנפתח יין אדום?" · "מה אני עושה בימי שלישי?"
- **Should happen:** she knows you **hate כוסברה** (and cinnamon) and steers you off it;
  for a drink she offers your **sweet white wine (blue bottle)** or **shandy** — and if you
  suggest **red wine she declines it** (you don't drink red — that's the rest of the
  family's drink); she knows **Tuesday you're at Mor's**.
- **Trace:** n/a — this is about what she *says*; it comes from her profile, no tool needed.

### 11. Call someone by their relationship — no number read aloud
- **Say:** "תתקשרי לבת שלי." then "תתקשרי לנכד שלי."
- **Should happen:** "הבת שלי" → **Mor** with a call card (a big button; she never reads a
  phone number aloud). "הנכד שלי" → she asks **which** grandson (there are several).
- **Trace:** `🔧 people_lookup(want:"contact", person:"הבת שלי") → resolved … מור`. No phone
  number anywhere.

### 12. Names are said the Spanish way
- **Say:** "ספרי לי על לאו." and "מי זה חורחה?"
- **Should happen:** "Leo" as **"LEH-oh"** (not English "LEE-oh"); Jorge, José, Achi and the
  rest sound Spanish, not anglicised.
- **Trace:** n/a — listen.

### 13. Current info — honest, sourced, and now self-diagnosing
- **Say:** "מה מזג האוויר עכשיו בכפר סבא?" and "כמה עולה דולר היום?"
- **Should happen:** if the online provider is **activated in the server env**
  (`ONLINE_PROVIDER=tavily` + `TAVILY_API_KEY` on Vercel), she answers with a real forecast/
  rate **and a source**, in ~1–2s. If NOT activated, she honestly says she **could not
  check** — never invents a forecast or a fake source. Family/calendar questions are
  **never** sent online.
- **Trace:** `🔧 get_current_info(…)`. The endpoint now returns a **diag** — if online
  misbehaves, the trace/console shows `[abuai-online-diag] {provider, providerKeyPresent,
  reached, sourceCount, outcome}`, which says exactly whether it's the provider setting, the
  key, or a genuinely empty search. (Verified working locally against real Tavily: provider
  = tavily, key present, reached, 6 sources.)

### 14. The hub — every app opens, is re-themed, and has a way back
- **Do:** from home open each app — **Abu AI, Bank, יומן (Calendar), WhatsApp, Games, מזג
  אוויר (Weather), News** — and come back.
- **Should happen:** every app opens with an obvious **back** control to the home hub. All
  seven now carry the shared **Abu logo** and the Night-Garden look (Games keeps its bright
  terrace by design; Weather keeps its sky + starfield). Text large and readable at arm's
  length. Abu AI opens the **live conversation** (not an old text screen).

---

**What is NOT expected to be perfect yet (do not report as bugs):**
- **Online in production:** the code path is proven (real Tavily works locally — provider/
  key/reached/6 sources). Going live only needs `ONLINE_PROVIDER=tavily` set in the Vercel
  server env for the Preview/Production environment **and a redeploy**. Until then she
  honestly says she could not check. A few queries can take ~3s — a brief "checking…" is
  expected, not a freeze.
- **The Abu AI character** is animated (mouth follows voice, blink, breathing, state glow)
  but the art is an **interim** drawing; a nicer illustration is being commissioned. Judge
  movement/warmth, not drawing polish.
- **Open family facts** still being filled in over time (exact company names, a few spellings,
  how Martita & Papi met). She says she doesn't know these rather than guessing.
- **Two small phrasing nuances** seen in the automated real-model harness: she sometimes
  says a preference in the first person ("I don't drink red wine") — the behaviour is right
  (no red wine for you), only the wording is loose; and for two same-named people she says
  "I'm not sure which" rather than listing both. Neither is a bug.
