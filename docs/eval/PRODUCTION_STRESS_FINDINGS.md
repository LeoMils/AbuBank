# Production Stress / Fuzz Findings

**Harness:** `src/eval/productionStressHarness.ts` (+`.test.ts`). Drives the REAL
`ExecutiveCognitiveController` with randomized, mixed-domain, multi-turn conversations
(calendar create/read/search/delete + family + online + date + corrections +
interruptions + frustration + audio complaints + greetings + confirmations), asserting
hard production invariants on every turn. No mocks. Seeded PRNG → every failure is
reproducible by seed.

**Invariants:** never throws · always RUNTIME_FINALIZED · non-empty display · valid
source · no loop/robotic phrase ("תגידי מילה אחת", generic "אני כאן כדי לעזור",
"באיזה יום?") · never "ביטלתי" without an explicit cancel · no raw-transcript confirm
title · no same-answer-to-different-inputs stuck loop · pending create survives a
non-request interruption (frustration/audio) · no gratuitous greeting on a non-greeting
turn.

## Failures found (aggressive fuzzing) → fixed at root

| Cluster | Reproduced | Root cause | Fix |
|---|---|---|---|
| **False cancellation** | 21× — mid-create, a non-cancel input ("ספרי לי על המהפכה", "לא התכוונתי לזה, מה …") emitted **"בסדר, ביטלתי"** | off-topic branch in `resolvePendingMessage` cancelled the draft | off-topic → **keep the draft + answer** (`park_keep`), never a false cancel |
| **Stuck confirmation loop** | mid-create, family/date/greeting questions ("מה הקשר בין רפי ללאו", "מה השעה", "מה שלומך", "איך בדיוק", "בוקר טוב") looped **"רגע, את רוצה שאקבע את זה?"** forever | questions were guarded from off-topic but not a field → clarify loop | questions/greetings mid-create → answer + keep draft |
| **"באיזה יום?" on search/delete** | 15× — "מתי יש לי פגישה עם מוטי" mid-create → robotic "באיזה יום?" | search fell into the create machine (greedy "פגישה") | search checked BEFORE the create heuristic → answer + keep draft |
| **Venue mis-merge** | "מה הסרטים בכפר סבא" mid-create → "בכפר סבא" absorbed as the meeting venue, query ignored | location check ran before the question guard | question guard moved BEFORE the location merge |
| **Narrative not replacing** | "אופיר ביקשה שאבוא מחר בשלוש אליה הביתה" mid-create → clarify loop | a verb-less narrative didn't match `isCreateIntent` | full day+time+place narrative mid-create → re-run as a fresh create |

## Result

**0 invariant violations over ~16,000 randomized turns.** New behavior: a pending draft
**survives** every side-topic (online/family/emotional/greeting/off-topic) — the side
query is answered and a following "כן" still saves the meeting. Only an explicit cancel
cancels; a new full-meeting narrative replaces.

Permanent gate: `productionStressHarness.test.ts` (400 conversations, 0 violations).

## Honest limits

The harness exercises the runtime controller (text path). Physical mic/TTS and visual
UI (scroll, modal render) are device-only and not covered here.
