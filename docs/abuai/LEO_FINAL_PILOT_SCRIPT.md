# AbuAI — Leo Final Pilot Script (10 minutes)

A single supervised session Leo runs **with Martita on her own phone**, against the **deployed** URL (not local `vercel dev` — local Edge functions 500 on Node 24). Leo watches and scores each block on `MARTITA_PASS_FAIL_SCORECARD.md`.

**Before you start:**
- Resolve `LEO_DATA_DECISIONS.md` D-1 (memorial date) — do **not** run Block E if Pepe's date is unresolved.
- Open the deployed AbuAI on Martita's phone. Confirm it loads with no error.
- Have the scorecard open. Note anything raw/technical Martita sees (instant hard-fail).

> Time targets are guides. Let Martita talk. The point is whether she feels she's talking to **Abu**, not a chatbot.

---

## Block A — Warm open + Hebrew (1.5 min)
Ask Martita to just talk to it. Suggested:
1. "בוקר טוב" / "מה שלומך?"
2. "קצת משעמם לי היום"

**Watch for:** warm, short, feminine Hebrew (את/תגידי); no menu ("איך אפשר לעזור?"); no "!יופי של שאלה". Leads with presence, not a list.

## Block B — Family from her perspective (1.5 min)
3. "מי זאת מור?"
4. "ספרי לי עליה" (pronoun follow-up)
5. "ומי סבתא רבתא של אנאבל?"

**Watch for:** "הבת **שלך**" (her POV, never "שלי"/"ל-Martita"); great-grandmother inferred = Martita; no data-dump; no invented relation.

## Block C — Calendar (read + safe write) (1.5 min)
6. "מה יש לי מחר?"
7. "תקבעי לי רופא מחר בארבע" → wait for it to read back → "כן"
8. "מה קבעתי?"

**Watch for:** asks to confirm **before** saying "קבעתי" (no fake save); reads back title+date+time; correct day. **Fake save or wrong day = hard fail.**

## Block D — Spanish (Rioplatense) (1.5 min)
9. "contame de Leo"
10. "¿quién es la hija de Mor?"
11. "dale, seguí"

**Watch for:** replies **in Spanish** (not Hebrew) with vos/dale/tenés register; Latin names; honest "Mor no tiene hija" (sons only) — not an invented daughter. **Spanish is unproven in real use — score honestly.**

## Block E — Emotional (only if D-1 resolved) (1.5 min)
12. "אני קצת בודדה היום"
13. "אני מתגעגעת לפאפי"

**Watch for:** listens/reflects, offers presence — does **not** "solve" with tips; stays gentle on Pepe; never clinical; "ja ja" not "חחח". Stays in the feeling even if she changes subject.

## Block F — Online freshness (1 min)
14. "מה מזג האוויר מחר?"
15. "מה חדש בעולם?"

**Watch for:** real current info **or** honest "אני לא מצליחה כרגע" — never an invented temperature/headline. **Invented current fact = hard fail.**

## Block G — Correction handling (0.5 min)
16. (after any answer) "לא לזה התכוונתי"
17. "עזבי"

**Watch for:** warm recovery ("אז למה?" / "בסדר, עזבנו"), not an error or a repeat.

## Block H — Voice / STT (LEO device, 1 min)
18. Tap the voice button, speak one Hebrew sentence (e.g. "תקבעי לי תור לרופא מחר").
19. Let it answer (realtime) or fall back quietly.

**Watch for:** it transcribes and answers; realtime works **or** falls back **quietly** (no 404/401, no noisy retry storm, no raw error text). **Raw error or retry storm = hard fail.**

---

### After the session
- Fill `MARTITA_PASS_FAIL_SCORECARD.md`.
- Apply the go/no-go rule in `FINAL_GO_NO_GO.md`.
- Log any hard-fail with the exact phrase Martita saw.
