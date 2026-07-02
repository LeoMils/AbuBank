# Latest Real iPhone — Full Cognitive Runtime Report

**Build:** `0.13.0-cognitive-runtime-v2` · **Date:** 2026-07-02 · **Branch:** `rc5/cognitive-architecture-and-acceptance`

> Honesty note: no verbatim iPhone transcript file exists in the repo (the prior
> `REAL_IPHONE_FAILURE_TRANSCRIPT.md` is paraphrased *clusters*, not lines). The
> concrete lines replayed here are the ones **Leo supplied in the mission "Must
> pass" list** (איזה יום היום / מה התאריך / מתי יש לי פגישה עם מוטי / create
> דני·רוזלינדה·מתתיהו / Leo·Anabel·Yarden·Rafi·Ofir / continuation / frustration /
> online). Nothing was invented beyond that list.

---

## 1. Old runtime — replaced or repaired?

**Replaced (kill-switch), not patched.** Evidence for why repair was not viable:
- `understandingOrchestrator.orchestrate()` is **advisory only** — `handleSend`
  (index.tsx:449) computes `orchestration.intent`, logs it, then **ignores it**;
  control actually flows through a ~700-line `if`-cascade with ~20 independent
  answer-emit points. The voice handler is a **second copy** of the same cascade.
- `conversationOS` handles only continuation/repair — not intent, calendar,
  family, online, verification, or Hebrew composition.
- There was **no single chokepoint** every answer passed through → no Response
  Verifier, no single Hebrew Composer. That is exactly why unit tests were green
  while the deployed product failed in real conversation.

So a new **Cognitive Runtime v2** was built as the single pipeline; the old
modules are kept **as tools** underneath it.

## 2. Cognitive runtime files built

| File | Role |
|---|---|
| `src/screens/AbuAI/cognitiveRuntime.ts` | The 9-layer central pipeline: `runCognitiveTurn` (sync authority) + `finalizeExternalAnswer` (verifies+composes LLM/online output → **no direct LLM bypass**). Composes calendarCreate · meetingIntelligence · familyReasoning · familyGraph · tools · conversationOS · onlineIntent · AbuCalendar/service · responseShaper · spokenPersona. |
| `src/screens/AbuAI/cognitiveRuntime.test.ts` | 13 unit locks: intent planner, date reasoner, verifier, composer, no-bypass. |
| `src/eval/latestRealIphoneFullRuntimeReplay.ts` | Multi-turn replay driven through the **same** `runCognitiveTurn`/`finalizeExternalAnswer` the UI uses. |
| `src/eval/latestRealIphoneFullRuntimeReplay.test.ts` | Asserts the replay at **100%** (in-memory localStorage shim so the real save round-trip works in `node`). |
| `src/eval/fullRuntimeExpected.ts` | Independent recomputation of expected day/date (so the date assertion checks the runtime, not itself). |
| `src/screens/AbuAI/index.tsx` | **Live wire** (staged): `date_query` now routed through the runtime authority; import added. |
| `src/version.ts` · `api/health.ts` · `src/version.test.ts` | Version → `0.13.0-cognitive-runtime-v2`. |

The 9 layers are implemented inside `cognitiveRuntime.ts`: 1 Input Normalizer ·
2 Conversation State Manager (`RuntimeState`) · 3 Intent+Goal Planner
(`classifyIntent`) · 4 Tool/Reasoning Router · 5 Domain Reasoners (Date, Calendar
read/search, Family, Frustration, Continuation, Confirmation) · 6 Action Executor
(real `createAppointmentSafe` + read-back verify) · 7 Response Verifier
(`verifyAnswer`) · 8 Hebrew Composer (`composeHebrew`) · 9 TTS-safe chunks.

## 3. Failures reproduced from the supplied lines (LIVE, before fix)

Reproduced by running the lines through the runtime and observing wrong output:

| Line | Wrong behaviour (before) | Layer at fault |
|---|---|---|
| איזה יום היום / מה התאריך היום | classified `general` → **no answer** (fell to LLM long text) | 3 — `\b` word-boundary never matches Hebrew, so the date regex was dead |
| מתי יש לי פגישה עם מוטי | classified `calendar_create` → asked **"באיזה יום?"** | 3 — `isCreateIntent` is greedy; no search-precedence for "מתי יש לי" |
| מתי האוטובוס הבא לתל אביב | classified `general`, **not routed online** | 3 — `onlineIntent` doesn't cover transport |
| create דני/רוזלינדה/מתתיהו → כן | **save_failed**, 0 appointments | test harness — `node` env has no `localStorage`; save round-trip silently failed |
| הפגישה באצלי בבית | verifier **passed** a double-preposition | 7 — `DOUBLE_PREP` used `\b` (dead against Hebrew) |

## 4. Root causes

1. **`\b` (ASCII word boundary) never matches at a Hebrew/space boundary.** It
   silently killed the date-query regex (Layer 3) AND the double-preposition guard
   (Layer 7). Fixed by removing `\b` and anchoring on the Hebrew literals.
2. **Greedy create intent** ate "מתי יש לי פגישה עם X". Fixed with a
   search-precedence rule before `isCreateIntent`.
3. **Online classifier gap** for buses/trains/weather. Fixed with an
   `ONLINE_EXTRA_RE` in the planner (no edit to the shared `onlineIntent`).
4. **Test-env storage:** the calendar save round-trips through `localStorage`,
   absent in the default `node` vitest env. Fixed with an in-memory shim in the
   test (no `jsdom` dependency, no `package.json` change).

## 5. Fixes by layer

- **Layer 3 (Intent Planner):** removed `\b`; added `SEARCH_WHEN_RE`,
  `ONLINE_EXTRA_RE`; tightened `calendar_read` so "מה יש בקולנוע היום" routes
  online, not to the calendar.
- **Layer 7 (Verifier):** fixed `DOUBLE_PREP`; guards now catch promise-without-
  result, "can't check" when data exists, generic fallback, date-query-asks-back,
  search-asks-which-day, broken fragments/URLs, double prepositions.
- **Harness:** in-memory `localStorage` shim + fixed clock for determinism.

## 6. Full-transcript replay result

`src/eval/latestRealIphoneFullRuntimeReplay.test.ts` → **17/17 lines PASS (100%)**
through `runCognitiveTurn`/`finalizeExternalAnswer`: date×2, calendar read×2,
search, create+save ×3 (verified in real storage), confirm-variants ×4, audio
complaint (draft kept), family pairs ×4, unknown-relation (no guess), online
routing ×3 + honest provider-fail, continuation ×2, frustration ×2 (distinct),
Hebrew-guard. Evidence level: **HIGH** (executed, real save round-trip).

## 7. Tests / build

- `npm run typecheck` → **clean**.
- `npx vitest run` (full suite) → **6042 passed / 6042** (6027 pre-existing + 15
  new). **Zero regressions** from the live wire.
- `npm run build` → **clean** (prebuild knowledge validation + generate ran).

## 8. Preview URL

**Not deployed this turn — not verified.** No fresh preview was produced.
- `gh` is not authenticated in this environment (the earlier PR/auth attempt
  failed), and there is no verified Vercel deploy path from here.
- The last known live preview `https://abu-bank-l7ct0ux3x-leos-projects-d3c04c09.vercel.app`
  still serves **`0.12.1`** — it does **NOT** contain this runtime. Do not treat it
  as verifying v2.

## 9. buildVersion

`0.13.0-cognitive-runtime-v2` in `src/version.ts` and `api/health.ts` (code). The
**live** `/api/health` will keep reporting `0.12.1` until Leo deploys.

## 10. Should Leo retest?

**Yes — and a device retest is the only way to accept this.** Remaining NON-CODE
and honest gaps:
- **Deploy required first** — this build is not deployed; the live iPhone still
  runs 0.12.1.
- **Physical iPhone mic/audio/TTS** — not exercised by a headless replay.
- **UI cutover is STAGED, not complete.** Only `date_query` is wired live in the
  **text** path. Calendar/family/online/continuation still run through the legacy
  cascade in the live UI (they are proven in the runtime, but not yet the sole
  authority in `handleSend`, and the **voice** handler is untouched). Full cutover
  (replacing `createState`/`conversationOSRef`/the ~20 emit points + voice with the
  single runtime authority) is the next change and must be gated by the full suite.

**Not claimed:** production readiness, deployed verification, or full UI cutover.
