# Latest iPhone Repro — Final Result

**Run type:** Multi-turn reproduction against the **deployed** runtime (the path the iPhone
actually uses), not internal functions.
**Deployed buildVersion at run time:** `0.12.1-recall-topic-guard` (confirmed live via `/api/health`).
**Repro result file:** `docs/eval/LATEST_IPHONE_REPRO_RESULTS.json` — **17 turns, 0 failures**.
**Repro harness:** `e2e/latest-iphone-transcript-repro.spec.ts` (Playwright, `--project=mobile-chrome`, one session per conversation, reproduction mode: never hard-fails, writes JSON evidence).

> Honesty note: no verbatim iPhone transcript file was provided. The run is driven by the
> reported failure categories (calendar create+yes+readback, today/tomorrow, Leo/Anabel/Yarden/
> Rafi/Ofir relations, online cinema/world-cup/bus, continue + "do you remember", repeated
> frustration), each turned into a multi-turn flow against the live preview UI.

---

## 1. Exact failures reproduced

Reproduced LIVE on the previous deploy (`buildVersion 0.11.0`), multi-turn, before the fix:

| # | Multi-turn flow | Live answer (BEFORE) | Category |
|---|---|---|---|
| 1 | "ספרי לי על המהפכה הצרפתית" → **"תמשיכי"** | Continuation answered about **Ofir (family)**, not the topic | continue/memory broken |
| 2 | … → **"על מה דיברנו"** | **"אופיר, הנכד שלך…"** — no topic memory | continue/memory broken |
| 3 | **"מי זה רפי"** | **"רפי, הנכד שלך"** (wrong — Rafi is Mor's ex-husband) | family relation mislabel |
| 4 | calendar create readback | "פגישה… **באצלי בבית**. **בנושא פגישה**." (double preposition + redundant subject) | calendar grammar |
| 5 | online cinema / world-cup | **"רגע, בודקת אונליין…"** placeholder captured (interim state) | online latency (not a text-logic bug) |

**Explicitly NOT bugs (the earlier test was too strict):**
- Calendar confirm "כן כן" → "קבוע — פגישה עם אורית…" **is** a real save (readback turn 3 shows the event).
- Leo / Anabel / Yarden / Ofir relations were already correct.

---

## 2. Exact root causes

1. **TEXT path and VOICE path diverged.** `conversationOS` (continuation, topic memory,
   challenge-repair) was wired ONLY into the voice handler. The TEXT path (`handleSend`) never
   called `handleConversationTurn` and never called `recordAnswer`, so "תמשיכי" and "על מה
   דיברנו" fell through to the LLM with no thread → answered about an unrelated person.
2. **`responseShaper` role match was a substring test.** `rel.includes('נכד')` matched the
   phrase "אבא של ה**נכד**ים" (father of the grandchildren), so Rafi (Mor's ex) was labelled
   "הנכד שלך".
3. **Blind location prefixing.** Readback did `ב${location}` unconditionally → "באצלי בבית"
   when the location already carried a preposition; and it echoed a generic subject → "בנושא פגישה".
4. **Conversation-meta phrases were rewritten too early** (the `0.12.0` → `0.12.1` follow-up):
   the continuity resolver rewrote "על מה דיברנו" / "תמשיכי" into "ספרי לי על <person>" BEFORE
   the conversation-OS intercept, re-introducing the wrong-person answer.

---

## 3. Files changed

Across the two fix commits `01e54c5` (v0.12.0) and `e3eb1ac` (v0.12.1):

| File | Change |
|---|---|
| `src/screens/AbuAI/index.tsx` | Wire `handleConversationTurn` + `recordAnswer` into `handleSend`; add "what did we talk about" topic recall on the text path; guard person-rewrite against conversation-meta phrases so recall/continuation reach the conversation-OS intercept |
| `src/screens/AbuAI/responseShaper.ts` | Add preposition-aware `locPhrase()`; anchor role words at the START of the relation string; ex-spouse / in-law guard; skip generic/duplicate subject |
| `api/health.ts` | Bump hardcoded `BUILD_VERSION` to `0.12.1-recall-topic-guard` |
| `src/version.ts` | Bump `version` + `buildLabel` |
| `src/version.test.ts` | Update version assertion |
| `docs/eval/LATEST_REAL_IPHONE_FAILURE_ANALYSIS.md` | New — failure analysis |
| `e2e/latest-iphone-transcript-repro.spec.ts` | New — multi-turn live repro harness |
| `src/screens/AbuAI/latestIphoneReproFixes.test.ts` | New — regression locks |

---

## 4. Tests added

- **`e2e/latest-iphone-transcript-repro.spec.ts`** — multi-turn Playwright repro against the
  deployed UI; captures each on-screen answer + pass/fail to
  `docs/eval/LATEST_IPHONE_REPRO_RESULTS.json`.
- **`src/screens/AbuAI/latestIphoneReproFixes.test.ts`** — unit regression locks:
  - "מי זה רפי" → matches `גרוש|מור`, never "הנכד שלך".
  - `locPhrase()` — no double preposition (`אצלי בבית` stays, `הוד השרון` → `בהוד השרון`).
  - `shapeCreateConfirm(...)` — no "באצלי", no "בנושא פגישה".

---

## 5. Before / after

| Flow | BEFORE (v0.11.0, live) | AFTER (v0.12.1, live) |
|---|---|---|
| "תמשיכי" after French-Revolution answer | answered about Ofir | continues the French Revolution topic |
| "על מה דיברנו" | "אופיר, הנכד שלך…" | "דיברנו על המהפכה הצרפתית." |
| "מי זה רפי" | "רפי, הנכד שלך" | "רפי — הגרוש של מור, אבא של הנכדים." |
| calendar readback | "…באצלי בבית. בנושא פגישה." | "פגישה עם אורית היום בשמונה בערב. אצלי בבית. נכון?" |
| confirm "כן כן" | (test called it broken) | "קבוע — פגישה עם אורית היום בשמונה בערב." (real save) |
| "מה יש לי היום" | — | "היום יש לך פגישה עם אורית. בשמונה בערב. אצלי בבית." |
| "מה יש לי מחר" (empty) | — | "מחר אין כלום. יום שקט." (no hallucination) |
| repeated "את לא מבינה אותי" | risk of identical robotic repeat | two distinct empathetic replies |

**Repro tally: 17 / 17 turns pass, 0 failures.**

---

## 6. Commands run and results

| Command | Result |
|---|---|
| `PREVIEW_URL=$(cat /tmp/simurl.txt) npx playwright test e2e/latest-iphone-transcript-repro.spec.ts --project=mobile-chrome` | 17 turns · **0 FAILURES** → `LATEST_IPHONE_REPRO_RESULTS.json` (written 2026-07-02T10:49) |
| `curl -s https://abu-bank-l7ct0ux3x-…/api/health` | `ok:true`, `buildVersion:"0.12.1-recall-topic-guard"`, `OPENAI_API_KEY:"present"` (re-verified now) |
| `npx vitest run src/screens/AbuAI/latestIphoneReproFixes.test.ts` | **3 passed (3)** — re-verified now, 10:57 |
| Full suite / typecheck / build (commit-recorded at fix time) | **6027 tests green; `tsc` clean; `npm run build` clean** — as recorded in commit `01e54c5`; not re-run in this write-up |

Evidence levels (per repo rules): the repro JSON, live `/api/health`, and the 3-assertion
regression lock are **HIGH** (re-executed / live). The 6027-test full-suite figure is **commit-recorded**, not re-run in this session — treat as MEDIUM until re-executed.

---

## 7. Preview URL

```
https://abu-bank-l7ct0ux3x-leos-projects-d3c04c09.vercel.app
```

(Vercel deploy under `leos-projects-d3c04c09`; may require Leo's Vercel auth to open in a browser.)

---

## 8. buildVersion

```
0.12.1-recall-topic-guard
```
buildLabel: `AbuBank — Multi-turn continuity (text-path conversationOS)` · buildDate `2026-07-01`
(`src/version.ts` and `api/health.ts` in sync; confirmed live).

---

## 9. Remaining blockers

- **Physical iPhone mic / audio / TTS** — NON-CODE. Not exercised by this repro (headless
  mobile-chrome text path). Requires a real device to accept.
- **Online path latency** — the "רגע, בודקת אונליין…" placeholder is an interim state; the
  live-search provider can be slow on preview. The repro treats a non-empty answer or an honest
  fallback as pass; sustained latency is a provider concern, not a text-logic bug.
- **Full-suite re-execution** — the 6027-green figure is from the fix commit, not re-run in
  this write-up. Re-run `npm run check && npm run build` for a fresh HIGH gate.
- **Human acceptance** — Leo's own multi-turn pass on the physical device is the final gate.

---

## 10. Exact retest script for Leo

```bash
# 1. Confirm the deployed build is the fixed one
curl -s https://abu-bank-l7ct0ux3x-leos-projects-d3c04c09.vercel.app/api/health
#    expect: "buildVersion":"0.12.1-recall-topic-guard", "ok":true

# 2. Re-run the multi-turn live repro against that deploy
cd C:/Users/Lmilstein/ClaudeCode/Abu-Bank
PREVIEW_URL=https://abu-bank-l7ct0ux3x-leos-projects-d3c04c09.vercel.app \
  npx playwright test e2e/latest-iphone-transcript-repro.spec.ts --project=mobile-chrome --reporter=line
#    expect: "[REPRO] 17 turns · 0 FAILURES"
cat docs/eval/LATEST_IPHONE_REPRO_RESULTS.json    # "failures": 0

# 3. Unit regression locks
npx vitest run src/screens/AbuAI/latestIphoneReproFixes.test.ts   # 3 passed

# 4. Full code gate (fresh HIGH evidence)
npm run typecheck && npm run test && npm run build

# 5. Physical device (NON-CODE — only Leo can accept):
#    Open the preview URL on the iPhone → Abu AI → run each flow by voice/text:
#    a) "תקבעי לי פגישה עם אורית היום בשמונה בערב אצלי בבית" → "כן כן" → "מה יש לי היום"
#    b) "ספרי לי על המהפכה הצרפתית" → "תמשיכי" → "על מה דיברנו"
#    c) "מי זה רפי"   (expect: ex of Mor, NOT "הנכד שלך")
#    d) "מה יש לי מחר" (expect: no invented events)
```
