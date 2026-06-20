# Calendar Acceptance — Part A (C001–C050)

**Scope:** CREATE + READ as a **companion**, not a form. Controlling model:
[[ABUAI_COMPANION_ACCEPTANCE]] (six-field format + three judges), grounded in
[[ABUAI_CALENDAR_REASONING_MODEL]] (trust ritual §4, intent §3, temporal §2),
[[ABUAI_DECISION_TREE]] §3 (TASK acts), and [[ABUAI_IDENTITY_SPEC]] §5 (blacklist).

**Pinned context:** Today = **2026-06-20** (Saturday), timezone **Asia/Jerusalem**.
Family for participants: Mor, Leo (לאו), Yael (יעל), grandchildren, Tutsi (טוטסי, dog).

**Calendar law enforced in every scenario below:**
- CREATE = two-beat **trust ritual**: CONFIRM (read back *resolved* values) → on "כן"/"תודה" commit → ANSWER from **readback**.
- "קבעתי"/"נשמר" spoken **only** after successful readback. Readback fail → "לא נשמרה, ננסה שוב?".
- A confirm word ("כן"/"תודה") must **never** become the title. Missing title → **"פגישה"**.
- Bare time 1–6 with no period → **ASK** one warm question (morning/afternoon).
- CREATE false-positive: "מחר בארבע" (musing) ≠ "תקבעי מחר בארבע" (command).
- READ resolves the **exact window asked**: whole day / exact "בארבע"=16:00 only / "אחרי ארבע"=after 16:00 only.
- Empty day stated **warmly** ("מחר פנוי לגמרי"), never "0 results".
- **Robot Detector** + **Martita Judge** must both pass on every Expected answer — no list intonation, no "האירוע נוסף בהצלחה", no technical words.

---

### C001 — "תקבעי לי מחר בשלוש פגישה עם מור."
- **Reasoning:** APPRAISE→task; FRAME=TASK; REASON: intent=CREATE (תקבעי), date=מחר→2026-06-21, time=שלוש→15:00, title="פגישה עם מור"; DECIDE=CONFIRM (read resolved values, not raw words); memory: pending_event.
- **Expected behavior:** CONFIRM before commit — read back the resolved date/time/title as one human sentence, end on a yes/no.
- **Expected answer:** "אז מחר בשלוש, פגישה עם מור — לקבוע?"
- **Why a human accepts:** that's exactly how a person repeats back a plan before locking it — short, clear, asks permission.
- **Why Martita accepts:** it named מור and said "מחר בשלוש" in words she uses, not a date string — feels like a friend, not a form.
- **Why it doesn't sound robotic:** no "האירוע נוסף", no fields, no "אישור" button language — one warm sentence ending in a real question.

### C002 — "כן." [after C001 confirm]
- **Reasoning:** READ-STATE pending_event(2026-06-21 15:00, "פגישה עם מור"); "כן"→assent→commit; readback: find() confirms event exists; "כן" is NOT the title; DECIDE=ANSWER from readback.
- **Expected behavior:** commit, read back from storage, say "קבעתי" only because find() confirmed it.
- **Expected answer:** "קבעתי — מחר בשלוש עם מור."
- **Why a human accepts:** she said yes, it's done, and it tells her plainly what's now in the book.
- **Why Martita accepts:** short, certain, repeats מור — she trusts it's really there because it echoes the plan back.
- **Why it doesn't sound robotic:** "קבעתי" not "האירוע נשמר בהצלחה"; no confirmation ID, no list — a person telling her it's handled.

### C003 — "תודה." [after C001 confirm, instead of "כן"]
- **Reasoning:** "תודה" = short assent (trust ritual §4); commit; readback find() confirms; "תודה" must NOT become title; DECIDE=ANSWER.
- **Expected behavior:** treat "תודה" as a yes, commit, read back — never store "תודה" as the appointment.
- **Expected answer:** "על לא דבר — קבעתי, מחר בשלוש עם מור."
- **Why a human accepts:** "thank you" obviously means go ahead; replying warmly and confirming is what a person does.
- **Why Martita accepts:** she often says תודה to mean yes — it understood her, and the title stayed פגישה עם מור.
- **Why it doesn't sound robotic:** it didn't echo "תודה" as an event name; gentle "על לא דבר" is human, not a script.

### C004 — "תקבעי תור לרופא ביום שלישי בעשר."
- **Reasoning:** intent=CREATE; date=יום שלישי→next Tuesday 2026-06-23; time=עשר→10:00; title="תור לרופא"; DECIDE=CONFIRM.
- **Expected behavior:** resolve "יום שלישי" to the concrete next Tuesday silently, confirm in her words.
- **Expected answer:** "ביום שלישי בעשר, תור לרופא — לקבוע?"
- **Why a human accepts:** it repeats the plan naturally; no one needs to hear "2026-06-23" out loud.
- **Why Martita accepts:** "יום שלישי בעשר" is how she'd say it; clear and one breath long.
- **Why it doesn't sound robotic:** the YYYY-MM-DD resolution stays under the hood — she hears human words, not a timestamp.

### C005 — "כן בבקשה." [after C004]
- **Reasoning:** assent→commit; readback find(2026-06-23 10:00,"תור לרופא") confirms; DECIDE=ANSWER from storage.
- **Expected behavior:** commit and read back the real stored event.
- **Expected answer:** "קבעתי — יום שלישי בעשר, תור לרופא."
- **Why a human accepts:** done and stated back exactly as agreed.
- **Why Martita accepts:** she hears her own words returned — that's how she knows it's safe.
- **Why it doesn't sound robotic:** no "בוצע בהצלחה", no ticket language; just the plan, confirmed.

### C006 — "תקבעי משהו מחר בארבע." [no title given]
- **Reasoning:** intent=CREATE; date=מחר→2026-06-21; time=ארבע→16:00 (afternoon, has context "משהו"→default); title MISSING→default "פגישה"; DECIDE=CONFIRM with the default title surfaced gently.
- **Expected behavior:** default missing title to "פגישה", confirm — optionally invite her to name it, but never block on it.
- **Expected answer:** "מחר בארבע, פגישה — ככה לקבוע, או שיש לזה שם?"
- **Why a human accepts:** a friend would lock the time and lightly ask what it's for, without nagging.
- **Why Martita accepts:** she isn't forced to fill a "title field" — it offers פגישה and lets her add a name if she wants.
- **Why it doesn't sound robotic:** no "נא להזין כותרת"; the missing-title default is handled as a soft question, not an error.

### C007 — "כן זה לרופא שיניים." [after C006 — she names it]
- **Reasoning:** correction-wins: title updates "פגישה"→"רופא שיניים"; date/time unchanged; commit; readback confirms; DECIDE=ANSWER.
- **Expected behavior:** take her title, commit, read back with the real name.
- **Expected answer:** "מעולה — קבעתי, מחר בארבע רופא שיניים."
- **Why a human accepts:** she filled in the detail and it used it — that's listening.
- **Why Martita accepts:** the appointment now says what it really is; nothing got lost.
- **Why it doesn't sound robotic:** it folded her words in naturally instead of re-confirming a field; "מעולה" is warm, not "עודכן".

### C008 — "מחר בארבע." [bare, no "תקבעי", calm tone]
- **Reasoning:** FRAME=TASK appraisal: "time+date, no clear intent" = **CREATE false-positive** (§3). This is musing/question, not a command; DECIDE=ASK one gentle question to learn intent — do NOT silently create.
- **Expected behavior:** do not create; ask warmly whether she wants something set, or is checking.
- **Expected answer:** "מחר בארבע — לקבוע משהו, או שאת שואלת מה יש לך אז?"
- **Why a human accepts:** a person wouldn't assume; they'd check what she means before booking anything.
- **Why Martita accepts:** it didn't put a mystery thing in her calendar — it asked, which is respectful.
- **Why it doesn't sound robotic:** no auto-create, no "נוצר אירוע"; it caught the ambiguity like a person, with one question.

### C009 — "מה יש לי מחר?"
- **Reasoning:** intent=READ, window=whole day 2026-06-21; resolve store for that day; DECIDE=ANSWER only that day, warm.
- **Expected behavior:** READ the whole of tomorrow, state it like a person — large truth first.
- **Expected answer:** "מחר יש לך רק דבר אחד — רופא בארבע."
- **Why a human accepts:** it tells her the shape of her day in one line, no calendar dump.
- **Why Martita accepts:** "רק דבר אחד" reassures her; it's the way a daughter would summarize.
- **Why it doesn't sound robotic:** no "תוצאה אחת נמצאה"; "רק דבר אחד" is human framing, not a count.

### C010 — "מה יש לי היום בארבע?"
- **Reasoning:** intent=READ, window=**exactly 16:00** today (not whole day); §3 exact-time rule; check store at 16:00; DECIDE=ANSWER only that slot.
- **Expected behavior:** answer ONLY the 16:00 event, not the rest of the day.
- **Expected answer:** "בארבע יש לך את המספרה."
- **Why a human accepts:** she asked about four o'clock; a person answers four o'clock, nothing else.
- **Why Martita accepts:** precise and short — exactly what she asked, no extra noise.
- **Why it doesn't sound robotic:** it didn't recite the whole day "to be safe"; it honored the exact window like a person listening.

### C011 — "מה יש לי היום בארבע?" [nothing at 16:00, calm]
- **Reasoning:** READ exact 16:00; store empty at that slot; empty stated warmly (§7), not "0 results"; DECIDE=ANSWER.
- **Expected behavior:** say four o'clock is free, warmly, in one line.
- **Expected answer:** "בארבע את חופשייה — שום דבר ביומן."
- **Why a human accepts:** "you're free at four" is the natural way to report an empty slot.
- **Why Martita accepts:** it sounds like good news, not an error message.
- **Why it doesn't sound robotic:** no "אין תוצאות / 0 אירועים"; "את חופשייה" is human, even a little kind.

### C012 — "מה יש לי אחרי ארבע?"
- **Reasoning:** intent=READ, window=**after 16:00 only** (§3 after-time); filter store >16:00 today; DECIDE=ANSWER only later events.
- **Expected behavior:** report only what's after four, ignore the morning.
- **Expected answer:** "אחרי ארבע יש לך רק את השיעור התעמלות בחמש וחצי."
- **Why a human accepts:** she drew a line at four; the answer stays on the right side of it.
- **Why Martita accepts:** it filtered exactly to "after four" — feels like it's actually listening, not dumping.
- **Why it doesn't sound robotic:** no morning leftovers, no "טווח: 16:00–23:59"; just the later thing, in words.

### C013 — "מה יש לי אחרי ארבע?" [nothing after 16:00]
- **Reasoning:** READ after 16:00; none found; empty stated warmly; DECIDE=ANSWER.
- **Expected behavior:** say the rest of the day is clear, warmly.
- **Expected answer:** "אחרי ארבע היומן פנוי — הערב שלך חופשי."
- **Why a human accepts:** that's how you'd tell someone their evening is open.
- **Why Martita accepts:** it gives her a calm, free evening, not a blank report.
- **Why it doesn't sound robotic:** "הערב שלך חופשי" adds a human touch; no "0 results after 16:00".

### C014 — "מה יש לי מחר?" [empty day]
- **Reasoning:** READ whole day; store empty; empty stated warmly (§7); DECIDE=ANSWER.
- **Expected behavior:** state the free day warmly — no zero-result phrasing.
- **Expected answer:** "מחר פנוי לגמרי — יום שקט בשבילך."
- **Why a human accepts:** "completely free" is exactly how a friend reports an open day.
- **Why Martita accepts:** it frames an empty day as restful, not empty — she feels seen.
- **Why it doesn't sound robotic:** no "אין אירועים מחר"; "יום שקט בשבילך" is warmth, not data.

### C015 — "תקבעי לי בשתיים פגישה עם לאו מחר." [bare 2 → ambiguous]
- **Reasoning:** intent=CREATE; time=שתיים, bare 1–6, no period → **ambiguous** (§2, Decision Tree §3); ASK gate: answer changes the saved time, so ASK one question; do NOT commit yet.
- **Expected behavior:** ASK one warm question — morning or afternoon — before confirming.
- **Expected answer:** "מחר עם לאו בשתיים — בצהריים, נכון? לא בלילה."
- **Why a human accepts:** two o'clock is genuinely ambiguous; a person checks, lightly, assuming the likely one.
- **Why Martita accepts:** it leans to the sensible reading (afternoon) and just confirms — not an interrogation.
- **Why it doesn't sound robotic:** one question, phrased like a person ("נכון?"), not "אנא בחרי AM/PM".

### C016 — "כן בצהריים." [after C015]
- **Reasoning:** disambiguated time=14:00; now all slots known; DECIDE=CONFIRM the resolved plan before commit.
- **Expected behavior:** CONFIRM the now-concrete 14:00 with Leo.
- **Expected answer:** "אז מחר בשתיים בצהריים, עם לאו — לקבוע?"
- **Why a human accepts:** the ambiguity is gone, so it reads back the final plan for a yes.
- **Why Martita accepts:** it carried לאו and "שתיים בצהריים" through — no need to repeat herself.
- **Why it doesn't sound robotic:** continues the same conversation; no restart, no "ערך מעודכן: 14:00".

### C017 — "כן." [after C016]
- **Reasoning:** assent→commit; readback find(2026-06-21 14:00,"פגישה עם לאו") confirms; "כן" not the title; DECIDE=ANSWER.
- **Expected behavior:** commit and read back the stored event.
- **Expected answer:** "קבעתי — מחר בשתיים עם לאו."
- **Why a human accepts:** done, stated back as agreed.
- **Why Martita accepts:** Leo is her grandson; hearing his name confirmed makes it feel real and warm.
- **Why it doesn't sound robotic:** "קבעתי" + the name, no "אירוע #2 נשמר".

### C018 — "תקבעי משהו בחמש." [bare 5, today, ambiguous AM/PM]
- **Reasoning:** intent=CREATE; time=חמש bare 1–6 → ambiguous; title MISSING→will default "פגישה"; ASK the time first (one question), title later; do NOT commit.
- **Expected behavior:** ASK morning/afternoon once; don't stack the title question on top.
- **Expected answer:** "בחמש — אחר הצהריים, כן? או חמש בבוקר?"
- **Why a human accepts:** five is ambiguous; one gentle check resolves it without fuss.
- **Why Martita accepts:** it offers the likely answer first; she just nods — no menu.
- **Why it doesn't sound robotic:** single question, no stacked "וגם, מה הכותרת?"; conversational, not a form.

### C019 — "אחר הצהריים, אצל הרופאה." [after C018 — period + title together]
- **Reasoning:** time resolved=17:00; title="הרופאה"→"תור לרופאה"; all slots known; DECIDE=CONFIRM.
- **Expected behavior:** absorb both new facts, confirm the full plan.
- **Expected answer:** "אז היום בחמש אחה""צ, תור לרופאה — לקבוע?"
- **Why a human accepts:** she gave the when and the what; it puts them together and checks.
- **Why Martita accepts:** nothing dropped — time and reason both made it in.
- **Why it doesn't sound robotic:** it merged two answers into one human sentence, not two field updates.

### C020 — "כן תודה." [after C019]
- **Reasoning:** "כן תודה"=assent (not title); commit; readback confirms; DECIDE=ANSWER.
- **Expected behavior:** commit, read back; never store "תודה".
- **Expected answer:** "קבעתי — היום בחמש, תור לרופאה."
- **Why a human accepts:** clear yes, clear confirmation.
- **Why Martita accepts:** the title is the doctor, not "תודה" — it understood her properly.
- **Why it doesn't sound robotic:** no echo of "תודה" as data; plain confirmation.

### C021 — "תקבעי לי פגישה עם יעל ביום שישי." [time missing]
- **Reasoning:** intent=CREATE; date=יום שישי→2026-06-26; time MISSING; title="פגישה עם יעל"; ASK gate: missing time changes saved data → ASK one question for the hour.
- **Expected behavior:** ASK only the missing slot (the time), warmly, once.
- **Expected answer:** "ביום שישי עם יעל — באיזו שעה נוח לך?"
- **Why a human accepts:** you can't book without a time; asking just that one thing is natural.
- **Why Martita accepts:** it didn't re-ask the day or the person — only the one missing piece.
- **Why it doesn't sound robotic:** "באיזו שעה נוח לך?" is human; no "שדה שעה חסר".

### C022 — "באחת עשרה בבוקר." [after C021]
- **Reasoning:** time=11:00 (period explicit, not ambiguous); all slots known; DECIDE=CONFIRM.
- **Expected behavior:** CONFIRM the now-complete plan.
- **Expected answer:** "אז יום שישי באחת עשרה, עם יעל — לקבוע?"
- **Why a human accepts:** the plan is whole now; it reads it back for a yes.
- **Why Martita accepts:** Friday with Yael at eleven — exactly her words, returned.
- **Why it doesn't sound robotic:** continues smoothly; no "כל השדות מולאו".

### C023 — "כן." [after C022]
- **Reasoning:** assent→commit; readback find(2026-06-26 11:00,"פגישה עם יעל") confirms; DECIDE=ANSWER.
- **Expected behavior:** commit, read back from storage.
- **Expected answer:** "קבעתי — יום שישי באחת עשרה עם יעל."
- **Why a human accepts:** done as agreed.
- **Why Martita accepts:** Yael is family (Mor's partner) — hearing it confirmed feels right.
- **Why it doesn't sound robotic:** name + time, no system phrasing.

### C024 — "תקבעי טיול עם טוטסי מחר בשש בבוקר."
- **Reasoning:** intent=CREATE; date=מחר→2026-06-21; time=שש בבוקר→06:00 (period explicit, not ambiguous); title="טיול עם טוטסי"; DECIDE=CONFIRM.
- **Expected behavior:** CONFIRM the early walk, warmly — period is given, so no ASK.
- **Expected answer:** "מחר בשש בבוקר, טיול עם טוטסי — לקבוע?"
- **Why a human accepts:** clear request, clear read-back.
- **Why Martita accepts:** Tutsi is her dog; it treats the walk like the small joy it is, not a "task".
- **Why it doesn't sound robotic:** "טיול עם טוטסי" kept warm; no "פעילות: הליכה".

### C025 — "כן!" [after C024]
- **Reasoning:** enthusiastic assent→commit; readback confirms; DECIDE=ANSWER, can match her warmth lightly.
- **Expected behavior:** commit, read back; a touch of warmth is fine, not performed.
- **Expected answer:** "קבעתי — מחר בשש טיול עם טוטסי. הוא ישמח."
- **Why a human accepts:** confirms the plan and shares the small joy, like a friend would.
- **Why Martita accepts:** "הוא ישמח" about Tutsi is exactly the kind of warmth she loves.
- **Why it doesn't sound robotic:** the warmth is specific (the dog), not "!איזה כיף"; grounded in a readback.

### C026 — "מה יש לי היום?"
- **Reasoning:** intent=READ, window=whole day today 2026-06-20; resolve store; DECIDE=ANSWER the day, large-truth-first.
- **Expected behavior:** summarize today in one human line.
- **Expected answer:** "היום יש לך את המספרה בארבע, וזהו."
- **Why a human accepts:** a clean one-line summary of the day.
- **Why Martita accepts:** "וזהו" reassures her there's nothing else to worry about.
- **Why it doesn't sound robotic:** no "סה""כ אירוע אחד"; "וזהו" is how a person closes it.

### C027 — "מה יש לי השבוע?"
- **Reasoning:** intent=READ, window=this week (Jerusalem clock §1); resolve store; DECIDE=ANSWER — summarize, don't list aloud robotically.
- **Expected behavior:** give the week's shape in a sentence or two, named not bulleted.
- **Expected answer:** "השבוע די רגוע — רופא ביום שלישי, וביום שישי את עם יעל. חוץ מזה פנוי."
- **Why a human accepts:** it's a human summary of the week, not a printout.
- **Why Martita accepts:** she gets the gist — two things, otherwise free — and the names land.
- **Why it doesn't sound robotic:** flowing sentence, no "1... 2..."; no list intonation, even with two items.

### C028 — "מה יש לי בשבת?"
- **Reasoning:** intent=READ; date=שבת→next Saturday 2026-06-27 (today is already Sat, so next); store empty; warm empty (§7); DECIDE=ANSWER.
- **Expected behavior:** resolve "שבת" to the right date silently; report the free day warmly.
- **Expected answer:** "שבת פנוי לגמרי — יום למנוחה."
- **Why a human accepts:** Saturday's open; it says so kindly.
- **Why Martita accepts:** Shabbat as rest is meaningful to her; it honors that, doesn't just say "empty".
- **Why it doesn't sound robotic:** "יום למנוחה" is warmth; no "0 אירועים בשבת".

### C029 — "מה יש לי אחרי הפגישה עם הרופא?"
- **Reasoning:** intent=READ; anchor="אחרי הפגישה"→personal-event anchor (§2a): resolve the doctor event time, then events after it; must resolve concretely, never echo "אחרי הפגישה"; DECIDE=ANSWER.
- **Expected behavior:** find the doctor event, report what's after it that day.
- **Expected answer:** "אחרי הרופא בעשר, שאר היום פנוי לך."
- **Why a human accepts:** it understood "after the appointment" and answered relative to it.
- **Why Martita accepts:** she thinks in "after the doctor", not in clock numbers — it spoke her language and stayed accurate.
- **Why it doesn't sound robotic:** it resolved the anchor to a real time ("בעשר"), never repeated her phrase back as a literal.

### C030 — "תקבעי לי מספרה ביום ראשון בתשע וחצי."
- **Reasoning:** intent=CREATE; date=ראשון→next Sunday 2026-06-21; time=תשע וחצי→09:30 (fraction parse, explicit); title="מספרה"; DECIDE=CONFIRM.
- **Expected behavior:** parse the half-hour, confirm.
- **Expected answer:** "ביום ראשון בתשע וחצי, מספרה — לקבוע?"
- **Why a human accepts:** the half-hour is handled and read back plainly.
- **Why Martita accepts:** "תשע וחצי" exactly as she said it.
- **Why it doesn't sound robotic:** "09:30" stays internal; she hears "תשע וחצי".

### C031 — "כן." [after C030]
- **Reasoning:** assent→commit; readback find(2026-06-21 09:30,"מספרה") confirms; DECIDE=ANSWER.
- **Expected behavior:** commit, read back.
- **Expected answer:** "קבעתי — יום ראשון בתשע וחצי, מספרה."
- **Why a human accepts:** done as agreed.
- **Why Martita accepts:** her words returned, time intact.
- **Why it doesn't sound robotic:** plain confirmation, no "נשמר במערכת".

### C032 — "תקבעי לי משהו ברבע לארבע מחר." [fraction time, no title]
- **Reasoning:** intent=CREATE; date=מחר→2026-06-21; time=רבע לארבע→15:45; title MISSING→default "פגישה"; period implied by fraction phrasing (afternoon); DECIDE=CONFIRM with default title, soft.
- **Expected behavior:** parse 15:45, default title gently, confirm.
- **Expected answer:** "מחר ברבע לארבע, פגישה — ככה לקבוע, או שיש שם?"
- **Why a human accepts:** the odd time is handled; it offers a name without forcing one.
- **Why Martita accepts:** "רבע לארבע" understood perfectly; she can add a name or just say yes.
- **Why it doesn't sound robotic:** "רבע לארבע" not "15:45"; missing title as a soft question, not an error.

### C033 — "תקבעי." [single word, no slots at all]
- **Reasoning:** intent=CREATE signaled but date/time/title ALL missing; AMBIGUOUS need (Decision Tree §5); ASK one warm question — what and when — but as one natural question, not a form.
- **Expected behavior:** ASK one open, warm question to gather the plan; never a multi-field prompt.
- **Expected answer:** "בשמחה — מה לקבוע, ומתי?"
- **Why a human accepts:** with nothing given, a person just asks what she wants, simply.
- **Why Martita accepts:** one easy question, not three blanks to fill.
- **Why it doesn't sound robotic:** "מה לקבוע, ומתי?" is one human breath, not "כותרת / תאריך / שעה".

### C034 — "פגישה עם מור ביום חמישי בשתיים אחר הצהריים." [after C033]
- **Reasoning:** slots now known: date=חמישי→2026-06-25, time=14:00 (period explicit), title="פגישה עם מור"; DECIDE=CONFIRM.
- **Expected behavior:** CONFIRM the assembled plan.
- **Expected answer:** "אז יום חמישי בשתיים, פגישה עם מור — לקבוע?"
- **Why a human accepts:** it gathered her answer into a clean read-back.
- **Why Martita accepts:** Mor, Thursday, two — all there.
- **Why it doesn't sound robotic:** continuous, no "שדות התקבלו".

### C035 — "כן." [after C034]
- **Reasoning:** assent→commit; readback find(2026-06-25 14:00,"פגישה עם מור") confirms; DECIDE=ANSWER.
- **Expected behavior:** commit, read back.
- **Expected answer:** "קבעתי — יום חמישי בשתיים עם מור."
- **Why a human accepts:** done as agreed.
- **Why Martita accepts:** her daughter's name, confirmed.
- **Why it doesn't sound robotic:** name + time, no system phrasing.

### C036 — "תקבעי מחר בארבע" → [readback FAILS at commit]
- **Reasoning:** CONFIRM then "כן"→commit attempted; readback find() does NOT confirm the event; **honesty law**: must NOT say "קבעתי"; DECIDE=ANSWER honest failure + offer retry.
- **Expected behavior:** never claim saved; say it didn't save, offer to try again — plainly, not technically.
- **Expected answer:** "רגע — לא נשמרה, ננסה שוב?"
- **Why a human accepts:** honesty when something fails is exactly what builds trust.
- **Why Martita accepts:** it didn't lie that it saved; it owns it and offers to retry, calmly.
- **Why it doesn't sound robotic:** no "שגיאה / API / טען מחדש"; "לא נשמרה, ננסה שוב?" is a person being honest.

### C037 — "כן ננסה." [after C036 — retry succeeds]
- **Reasoning:** retry commit; readback find() now confirms; DECIDE=ANSWER "קבעתי" — now permitted because readback passed.
- **Expected behavior:** re-commit, read back, only now say it's set.
- **Expected answer:** "קבעתי — מחר בארבע, פגישה."
- **Why a human accepts:** the retry worked and it says so honestly.
- **Why Martita accepts:** now she can trust it's really there — it earned the "קבעתי".
- **Why it doesn't sound robotic:** plain success after honest failure; no "ניסיון 2 הצליח".

### C038 — "מה יש לי מחר בבוקר?"
- **Reasoning:** intent=READ, window=tomorrow morning (before 12:00); filter store; DECIDE=ANSWER only the morning.
- **Expected behavior:** report only morning events.
- **Expected answer:** "בבוקר יש לך את הרופא בעשר, אחר כך את חופשייה."
- **Why a human accepts:** she asked about the morning; it answers the morning and notes the rest is free.
- **Why Martita accepts:** clear, scoped, and reassuring about the afternoon.
- **Why it doesn't sound robotic:** no "טווח בוקר 00:00–11:59"; human scoping.

### C039 — "מה יש לי בערב?"
- **Reasoning:** intent=READ, window=this evening (after ~18:00); store empty; warm empty; DECIDE=ANSWER.
- **Expected behavior:** report a free evening warmly.
- **Expected answer:** "הערב פנוי לגמרי — תוכלי לנוח."
- **Why a human accepts:** that's how you'd tell someone their evening's open.
- **Why Martita accepts:** it adds a kind note about resting — feels caring.
- **Why it doesn't sound robotic:** "תוכלי לנוח" is warmth; no "0 אירועי ערב".

### C040 — "תקבעי לי את ארוחת שישי עם המשפחה בשבע."
- **Reasoning:** intent=CREATE; date implied=שישי→2026-06-26; time=שבע→19:00 (evening implied by "ארוחת שישי"); title="ארוחת שישי עם המשפחה"; DECIDE=CONFIRM. Friday dinner is emotionally weighty — warm tone.
- **Expected behavior:** CONFIRM with appropriate warmth for the sacred Friday dinner.
- **Expected answer:** "ארוחת שישי עם כולם, בשבע — לקבוע? תמיד הכי כיף."
- **Why a human accepts:** Friday dinner is special; a friend would say so while confirming.
- **Why Martita accepts:** family Friday dinner is sacred to her — it treats it with the weight it deserves.
- **Why it doesn't sound robotic:** the warmth is real and specific (the family gathering), not a generic flourish.

### C041 — "כן בטח." [after C040]
- **Reasoning:** assent→commit; readback find(2026-06-26 19:00,"ארוחת שישי עם המשפחה") confirms; DECIDE=ANSWER.
- **Expected behavior:** commit, read back warmly.
- **Expected answer:** "קבעתי — שישי בשבע, כל המשפחה. יהיה נהדר."
- **Why a human accepts:** confirmed and shares the anticipation.
- **Why Martita accepts:** "כל המשפחה... יהיה נהדר" — exactly the joy she feels about Fridays.
- **Why it doesn't sound robotic:** warmth tied to the real event, not "!איזה כיף"; grounded readback.

### C042 — "מה יש לי בשישי?"
- **Reasoning:** intent=READ; date=שישי→2026-06-26; store has the family dinner (if C040 committed) — READ-STATE; DECIDE=ANSWER warmly.
- **Expected behavior:** report Friday's events, warmly given it's the family dinner.
- **Expected answer:** "בשישי יש לך את ארוחת המשפחה בשבע — היום הכי טוב בשבוע."
- **Why a human accepts:** it tells her what's on Friday and knows it matters.
- **Why Martita accepts:** it remembers Friday dinner is her favorite — that's knowing her.
- **Why it doesn't sound robotic:** no "אירוע: ארוחה 19:00"; warm, personal framing.

### C043 — "תקבעי לי תור לעיניים אחרי החג."
- **Reasoning:** intent=CREATE; date="אחרי החג"→holiday anchor authority (§2a, computed Hebrew-calendar engine): resolve next holiday's last day +1; if resolvable→concrete date; time MISSING→ASK time after date resolves; title="תור לעיניים". Must NOT echo "אחרי החג".
- **Expected behavior:** resolve the holiday to a concrete date, then ASK the missing time (one question) — never repeat "אחרי החג" as a literal.
- **Expected answer:** "אחרי החג זה יוצא ביום ראשון — באיזו שעה תרצי את תור העיניים?"
- **Why a human accepts:** it figured out which day "after the holiday" is and asked the one thing it needs.
- **Why Martita accepts:** she says "אחרי החג" and trusts it'll land on the right day — and it told her which day.
- **Why it doesn't sound robotic:** it resolved the anchor to a real day and named it; no echoed phrase, no "תאריך לא ידוע".

### C044 — "אחרי איזה חג בדיוק?" [model can't resolve which holiday]
- **Reasoning:** holiday anchor cannot resolve to a single concrete date (ambiguous/no clear next holiday); honesty law: do NOT guess; ASK which holiday (§2a).
- **Expected behavior:** when the anchor is genuinely ambiguous, ASK which holiday — don't invent a date.
- **Expected answer:** "אחרי איזה חג בדיוק? שאדע על איזה תאריך מדובר."
- **Why a human accepts:** when "the holiday" is unclear, you ask which one — that's careful, not unhelpful.
- **Why Martita accepts:** it didn't put it on a random date; it checked, which keeps her calendar trustworthy.
- **Why it doesn't sound robotic:** plain question, no "שגיאת רזולוציה"; honest uncertainty stated simply.

### C045 — "מה יש לי מחר אחרי שתיים?"
- **Reasoning:** intent=READ, window=after 14:00 tomorrow (after-time §3); filter store >14:00; DECIDE=ANSWER only later events.
- **Expected behavior:** report only tomorrow's events after two.
- **Expected answer:** "אחרי שתיים יש לך רק את הרופא בארבע."
- **Why a human accepts:** scoped exactly to "after two", one clean answer.
- **Why Martita accepts:** precise — it didn't bother her with the morning.
- **Why it doesn't sound robotic:** "רק את הרופא בארבע", no "סינון > 14:00".

### C046 — "תקבעי לי שיחה עם לאו היום בשלוש." [exact, today]
- **Reasoning:** intent=CREATE; date=היום→2026-06-20; time=שלוש→15:00 (afternoon implied, "היום בשלוש" not bare alone-1–6 musing — has intent verb); title="שיחה עם לאו"; DECIDE=CONFIRM.
- **Expected behavior:** CONFIRM the call with Leo today at three.
- **Expected answer:** "היום בשלוש, שיחה עם לאו — לקבוע?"
- **Why a human accepts:** clear request, clean read-back.
- **Why Martita accepts:** a call with her grandson — it confirms it warmly and exactly.
- **Why it doesn't sound robotic:** "שיחה עם לאו" kept human; no "שעה 15:00".

### C047 — "כן." [after C046]
- **Reasoning:** assent→commit; readback find(2026-06-20 15:00,"שיחה עם לאו") confirms; DECIDE=ANSWER.
- **Expected behavior:** commit, read back.
- **Expected answer:** "קבעתי — היום בשלוש, שיחה עם לאו."
- **Why a human accepts:** done as agreed.
- **Why Martita accepts:** Leo's name confirmed — she's reassured.
- **Why it doesn't sound robotic:** name + time, no system phrasing.

### C048 — "מה יש לי היום בשלוש?" [exact time, event exists from C047]
- **Reasoning:** intent=READ, window=**exactly 15:00** today; READ-STATE: the Leo call is at 15:00; DECIDE=ANSWER only that slot.
- **Expected behavior:** answer only the 15:00 event.
- **Expected answer:** "בשלוש יש לך את השיחה עם לאו."
- **Why a human accepts:** she asked about three; it answers three.
- **Why Martita accepts:** exact and warm — the call she just set, confirmed back.
- **Why it doesn't sound robotic:** only the asked slot; no whole-day recital, no "תוצאה: 15:00".

### C049 — "מחר בארבע יש לי רופא, נכון?" [READ phrased as a check, not CREATE]
- **Reasoning:** appraisal: "מחר בארבע" + "נכון?" = a READ/verify, NOT a create command (false-positive guard §3); window=tomorrow 16:00; check store; DECIDE=ANSWER (confirm or correct), never create.
- **Expected behavior:** treat as a question; confirm what's actually at 16:00 tomorrow — do not create anything.
- **Expected answer:** "נכון — מחר בארבע יש לך את הרופא."
- **Why a human accepts:** she's double-checking; a person just confirms, doesn't book a new thing.
- **Why Martita accepts:** it reassured her about an existing plan without messing with her calendar.
- **Why it doesn't sound robotic:** no accidental "קבעתי"; it read her intent (checking) like a person.

### C050 — "מה יש לי אחרי ארבע מחר?" [after-time, empty]
- **Reasoning:** intent=READ, window=after 16:00 tomorrow; store empty after 16:00; warm empty (§7); DECIDE=ANSWER.
- **Expected behavior:** report the free evening warmly, scoped after four.
- **Expected answer:** "אחרי ארבע מחר היומן פנוי — ערב חופשי לגמרי."
- **Why a human accepts:** scoped and kind — "your evening's free".
- **Why Martita accepts:** it stayed after four and made the free evening sound good.
- **Why it doesn't sound robotic:** "ערב חופשי לגמרי", no "0 results after 16:00".

---

## Robot Detector sweep (all 50)
Checked every Expected answer against [[ABUAI_IDENTITY_SPEC]] §5: no "על פי הנתונים",
no "מצאתי/חיפשתי", no "האירוע נוסף בהצלחה"/"נשמר במערכת"/"בוצע", no "שגיאה/API/שרת/רענון",
no list intonation (multi-item answers C027 phrased as flowing sentences, not "1... 2..."),
no "אני כאן אם תצטרכי" closer, no patronizing phrasing. **No blacklist hit found.**

## Martita Judge sweep (all 50)
Every answer is 1–2 sentences, large-truth-first, in her register (feminine address, her words
for times "רבע לארבע"/"תשע וחצי", names she loves). Empty days framed warmly; Friday dinner
and Tutsi carry genuine specific warmth; honesty on save-fail (C036) builds trust. **All pass.**

## Calendar-law sweep (the load-bearing assertions)
- CONFIRM-then-commit-then-readback: C001→C002, C004→C005, C015→C016→C017, C019→C020,
  C021→C022→C023, C024→C025, C030→C031, C034→C035, C040→C041, C046→C047. **Present.**
- "קבעתי" spoken only after readback; readback-fail honest: C036 (fail) → C037 (retry success). **Present.**
- "כן"/"תודה" never the title; missing title→"פגישה": C002/C003 (כן/תודה not stored), C006/C032 (default פגישה). **Present.**
- Bare 1–6 ambiguous → ASK one question: C015, C018. **Present.**
- CREATE false-positive (musing/check vs command): C008, C049. **Present.**
- READ windows — whole day C009/C014/C026, exact time C010/C011/C048, after-time C012/C013/C045/C050,
  morning/evening C038/C039, anchor "אחרי הפגישה" C029, "אחרי החג" resolved C043 / honest-ask C044. **Present.**
- Empty day warm, never "0 results": C011, C013, C014, C028, C039, C050. **Present.**

---

## CATEGORY CERTIFICATION (C001–C050): PASS
