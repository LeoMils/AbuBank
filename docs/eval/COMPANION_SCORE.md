# COMPANION SCORE — is she good company, beside golden correctness (Item 4)

Golden proves a session is CORRECT. It cannot fail a session that is correct and lifeless — the owner's
oldest complaint (the 18/18 film answer he rated 3/100). This measures warmth on real-model sessions,
reported BESIDE golden.

**Result (v0.281, `scripts/eval/companion-score.mjs`, real gpt-realtime):**
- **Golden (correctness): 18/18.**
- **Companion — heuristic: 100/100** (deterministic warmth markers: name, life/family reference, phrasing
  variety, stays-with-feeling, warm-not-robotic).
- **Companion — judge: 90/100** (gpt-4o-mini reading each transcript on the holistic "would an 81-year-old
  alone at home want to talk to her again": lonely session 95, family session 85).

Both are PROXIES, not a human ear. But they are no longer blind to coldness the way golden is, and the
transcripts read genuinely warm — a real change from the 3/100 film answer.

## What the transcripts show (warm, human)
- "אני איתך, מרתיטה… או שנישאר רגע ביחד" — stays WITH her instead of a task menu.
- "מבינה אותך, mi reina. פפי היה אהבה גדולה" — Rioplatense warmth, holds the feeling about Pepe.
- "זוכרת את הגפילטע פיש שלך? איך תמיד בסוף כולם ניגשים לקחת עוד חתיכה" — references HER life unprompted.
- Uses her name naturally (מרתיטה / מרתה / מותק), varies openers, no robotic/assistant phrasing.

## Honest soft spot (why family scored 85, not 95)
When a lookup returns nothing (she asked about Argentina, history_lookup had no detail), the decline is
FLAT — "אין לי מספיק פרטים על התקופה" — correct but a little cold. The warm move is to stay with the
memory and gently ask HER to tell it, not just report a gap. Logged as the next companion improvement
(D-COMPANION-01): an empty grounded result on a LIFE/FAMILY topic should turn back to her warmly, not
just state the miss. Not a correctness bug — a warmth one, which is exactly the class this metric exists
to catch.

## The rule
A build that is 18/18 and cold is not ready. Ship the companion score beside golden every time; a drop in
warmth is a regression even when correctness is green.
