# Final iPhone Acceptance Script

**Preview:** https://abu-bank-i0ha4vc7m-leos-projects-d3c04c09.vercel.app
**Expected build badge:** `0.32.0-final-code-side-complete` (Settings → bottom: "…· build 0.32.0-final-code-side-complete").

Run each step on the real iPhone (Safari, add to Home Screen for full-screen). For each,
note ✅ pass / ❌ fail. On any ❌, follow the one-click debug flow at the bottom.

## 0. Pre-flight
- [ ] Open Settings → confirm the badge reads **build 0.32.0-final-code-side-complete**.
- [ ] Settings shows a visible **"העתקת 20 השיחות האחרונות (לתמיכה)"** button.

## 1. Calendar create (natural speech)
- [ ] Say: **"אני צריך להיפגש מחר עם מוטי בקפה מורנו בשלוש"** → confirm shows *פגישה עם מוטי · מחר · 15:00 · קפה מורנו*, then say **"כן"** → saved once.
- [ ] Say: **"אופיר ביקשה שאבוא מחר בשלוש אליה הביתה. גלעד יגיע כנראה רק בחמש"** → *פגישה עם אופיר · אצל אופיר · פרטים חשובים: גלעד…*, **"כן"** → saved. Title is NOT the raw sentence.

## 2. Calendar read / search
- [ ] **"מה יש לי מחר"** → lists tomorrow's events (or "אין"), never invents.
- [ ] **"מה יש לי השבוע"** → the whole week (not just today).
- [ ] **"מתי יש לי פגישה עם מוטי"** → finds it (never "באיזה יום?").
- [ ] **"יש לי משהו עם מור"** → searches (never a generic reply).

## 3. Family (Ofir / Anabel / Ari)
- [ ] **"מה לאו עבור אופיר"** → *דוד*.
- [ ] **"מי זה נועם"** → correct role, never "won't remember".
- [ ] **"מה אופיר עבור אנאבל"** → *אמא* (Ofir is female).
- [ ] **"מה ארי עבור ירדן"** then **"איך בדיוק"** → relation + the graph path (אופיר → מור → עילי → ירדן).
- [ ] Ask an unknown relation → **"לא אנחש"**, never a guess.

## 4. Online (movies / bus / sports)
- [ ] **"מה הסרטים בכפר סבא"** → live movie info OR a clear failure ("…נפל… שננסה שוב?"), never a made-up listing.
- [ ] **"מתי האוטובוס מרעננה להוד השרון"** → live info or clear failure.
- [ ] **"מי ניצח במונדיאל אתמול"** → live result or clear failure; never a fabricated score.
- [ ] **"מה השעה"** / **"איזה יום היום"** → correct from the phone clock (not "online").

## 5. Long answer scroll
- [ ] **"ספרי לי על המהפכה הצרפתית"** → long answer; the answer area **scrolls**, nothing clipped at the edges.

## 6. Speech continue / repeat
- [ ] During a long spoken answer say **"תמשיכי"** → continues from where it stopped.
- [ ] Say **"לא שמעתי"** → calm audio help, thread not lost.
- [ ] Say **"תשלימי"** → continues to the next part.

## 7. Error copy details
- [ ] If any screen shows **"משהו לא עבד"** → it shows a reason line + **"העתקת פרטים לתמיכה"**; tap it → details copied.

## 8. Hebrew quality
- [ ] Every answer sounds like a natural adult Israeli — short, direct, answer-first. No "אני תבדוק", "תקבילי", "אחורה צהריים", no robotic "אני כאן כדי לעזור".

## 9. Repeated greeting check
- [ ] Say **"בוקר טוב"**, then ask 3 unrelated things → the assistant does NOT greet again on the non-greeting turns.

## 10. Confirmation loop check
- [ ] Start a create, then mid-way ask **"מה השעה"** and **"מי זה נועם"** → each is answered AND the pending meeting stays alive; then **"כן"** saves it. No "רגע, את רוצה שאקבע?" loop, no false "ביטלתי".

---

## ONE-CLICK DEBUG FLOW (do this for EVERY ❌)
Send Leo → Claude, per failure:
1. **Last 20 turns** — Settings → "העתקת 20 השיחות האחרונות (לתמיכה)" (or on an error screen, "העתקת פרטים לתמיכה"). Paste it.
2. **Screenshot** of the screen at the moment of failure.
3. **Exact spoken/typed sentence** (verbatim Hebrew).
4. **Expected result** (what should have happened).

Each reported failure is handled by `IPHONE_FAILURE_TRIAGE_PROTOCOL.md`.
