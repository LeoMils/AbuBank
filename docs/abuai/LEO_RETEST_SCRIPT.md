# Leo / Martita — 3-minute final retest (non-mic + mic)

Run on a build with real provider keys configured (the deployment has them; locally
`export OPENAI_API_KEY=…` + `npx vercel dev`). Each line has a pass/fail criterion.

## A. History follow-up chain (continuity) — TEXT
| Say | Expect (PASS) | FAIL |
|-----|----------------|------|
| באיזה שנה הייתה המהפכה הצרפתית | a real answer (1789), warm, short | wrong/empty |
| עולמית | understands it's about world history | "?" / lost |
| על ההיסטוריה | **continues the history thread** (not a new topic, not family) | jumps topic / "לא הבנתי" |
| עליה | continues about it/history | resolves to a random person |
| תמשיכי | adds more on the same topic | restarts / repeats |

## B. Family follow-up chain — TEXT
| Say | Expect (PASS) | FAIL |
|-----|----------------|------|
| מי זאת מור | "מור, הבת **שלך**…" concise | "ל-Martita" / "שלי" / data dump |
| ומי ארי | "ארי, הנינה **שלך**…" (great-granddaughter) | wrong relation |
| עליה | continues about Ari | hijacks to Mor |
| ומי היא | clarifies/continues about Ari | lost |
| הנכד / הנכדים שלי | speaks to Martita: "הנכדים **שלך** — …" (no colon dump) | "הנכדים שלי" / "ל-Martita יש …:" |

## C. Calendar follow-up chain — TEXT
| Say | Expect (PASS) | FAIL |
|-----|----------------|------|
| איזה פגישות יש לי השבוע | real week events, or "שקט" honestly | invented events |
| ומה אחרי זה | continues to upcoming | lost |
| ומה ביום הבא | next day's events | wrong day |
| (create) תקבעי מחר בשלוש עם מוטי → כן | confirms, then "קבעתי …" only after readback | "קבעתי" with nothing saved (**fake-save = FAIL**) |

## D. Correction handling — TEXT
| Say | Expect (PASS) | FAIL |
|-----|----------------|------|
| (after any answer) לא לזה התכוונתי | warm "אז למה התכוונת?" — recovers | repeats wrongly / error |
| עזבי | "בסדר, עזבנו. על מה בא לך לדבר?" | ignores |

## E. Online / freshness — TEXT (needs network)
| Say | Expect (PASS) | FAIL |
|-----|----------------|------|
| מה מזג האוויר מחר | grounded, or honest "עכשיו אני לא מצליחה לבדוק" | **invented** temperature (FAIL) |
| מה חדש בעולם | grounded summary or honest can't-verify | fabricated headline (FAIL) |

## F. Voice / STT (mic — Leo device only)
| Action | Expect (PASS) | FAIL |
|--------|----------------|------|
| Tap voice, speak a Hebrew sentence | transcribes + answers; realtime connects OR falls back quietly | `404 sessions` / `401` shown / noisy retries / raw error text |
| (misconfig key) | "יש בעיה בהגדרת השירות. דברי עם לאו." | raw provider error leaks |

## Hard-fail (any = not ready)
fake save · invented current fact · wrong family relation · raw JSON/tool/provider output · "שלי"/"ל-Martita" to Martita · lost continuity on A/B/C · patronizing/robotic tone.

## Quick automated live gate (with a real key)
```bash
export OPENAI_API_KEY=sk-proj-<real>   # not "sk-..."
export RC7_ALLOW_NETWORK=1
npx vercel dev --listen 5176 &
npx tsx acceptance/rc7LiveAcceptance.harness.ts   # verifies key (200) then scores scenarios
```
