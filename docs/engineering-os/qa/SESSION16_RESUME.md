# §16 Acceptance — Deterministic Resume Handoff

**Resume from EVIDENCE (JSON artifacts + git + this file), not recollection. Do NOT reset claims or
redo proven work.** Branch: `rc5/cognitive-architecture-and-acceptance` (never merge main; never deploy
production without explicit owner authorization).

## CLEAN RC IDENTITY (certification candidate)
- **CURRENT clean RC (with the live-fact GROUNDED+FRESH architecture):**
  `https://abu-bank-eiyl4n2r7-leos-projects-d3c04c09.vercel.app` · build `0.286.0-earonly` · Preview.
  Secret-clean: 27 chunks crawled, 0 credential tokens, 0 CONFIRMED_SECRET_EXPOSED (only VITE_APP_VERSION
  / VITE_COMMIT_SHA public config). NOTE: `scripts/scan-deployed-secrets.ts` has HARDCODED targets
  (abu-bank-f3dpms0ta + canonical alias abu-ela-rc.vercel.app) and IGNORES its URL arg — the "3 exposed"
  it prints is the OLD canonical alias (owner-side block), NOT this RC. Scan a new RC by crawling the
  chunk graph (`assets/*.js`) + `scanBundleForCredentialMaterial` directly (see milestone log).
- Prior clean RC (pre-freshness): `https://abu-bank-4jtx4wp7b-leos-projects-d3c04c09.vercel.app`
  · build `0.286.0-earonly` · Preview.
- To (re)create a clean RC from the current tree: `npx vercel deploy --force --yes` (the `.vercelignore`
  now excludes local `.env`, so the build uses ONLY the clean Vercel env). Preview env has: OPENAI_API_KEY,
  BRAVE_API_KEY, TAVILY_API_KEY, ONLINE_PROVIDER, ONLINE_DEEP_FETCH, VITE_AZURE_TTS_REGION (public).
- Authoritative secret check = `scanBundleForCredentialMaterial` (raw token shapes; NOT VITE_ names).
  Clean RC verified: 0 credential tokens + 0 secret-name refs across all ~27 chunks.

## SECURITY (RELEASE_STATE = BLOCKED_P0_SECURITY — owner-side)
- PRODUCTION `abu-bank.vercel.app` (build `0.5.0-production-candidate`) STILL ships OLD keys:
  OpenAI `fp:e39ef3b7`, Gemini `fp:69150fc4`, Groq `fp:a2f25d13`. (Azure key proven DEAD — no action.)
- Owner is revoking the 3 keys independently. CREDENTIAL_REVOKED (owner, provider) closes SECURITY.
  CLEAN_PRODUCTION_DEPLOYMENT (owner-authorized redeploy) closes the SHIPPED-BUNDLE exposure. Separate.
- Production PRIMARY chat uses OPENAI_API_KEY (new key) at runtime → verified working. Revoking old keys =
  NO_IMPACT to primary (only client-direct fallback tiers degrade). Production redeploy REQUIRED to stop
  shipping the old bundle. Do NOT deploy production without explicit authorization.

## RESUME PROGRESS (this context — commits 17ebe37 → 2eeac25, branch unchanged; RC NOT redeployed)
- **Step A DONE** (17ebe37): `temporalFreshness` registered as a control-plane component + identity
  re-frozen (33/33 adversarial). `api/abuai-online.ts` surfaces `diag.temporalIntent`; recency
  directive added to the OpenAI web_search path. **CAVEAT/finding:** the deployed clean RC answers
  current-info via the deep/judge path (`answerPath=deep/snippet`), NOT the OpenAI path — so this
  recency wiring does NOT change deployed temporal behavior. Freshness on the deployed path is
  unchanged (see temporal matrix). Step A is therefore PARTIAL for the deployed capability.
- **Calendar acceptance DONE** (76d8b00): `scripts/rc-acceptance-calendar.mjs` — 7/7 PROVEN_PASS on
  the deployed clean RC. Real UI write→readback→modify→readback→full-reload; real IndexedDB round-trip.
  Closes the historical physical write-can't-be-read-back failure at PREVIEW class.
- **WhatsApp acceptance DONE** (6217728): `scripts/rc-acceptance-whatsapp.mjs` — 5/5 PROVEN_PASS.
  Deployed compose (gpt-4o via proxy) + real verifyDraft fact-preservation (+ sensitivity control) +
  safe send boundary (real buildWhatsAppPersonUrl, MOCK phone, wa.me prefill-only, zero real send).
- **Temporal matrix DONE** (2eeac25): `scripts/rc-acceptance-temporal.mjs` — honest 2-dimensional grade:
  GROUNDING honesty = PROVEN_PASS; FRESHNESS certification = NOT_CERTIFIED (0/5 temporal rows; no
  source dates). Deterministic findings: super-bowl now "Philadelphia Eagles" (documented Seahawks
  marker gone; still uncertifiable); **decline→answer DRIFT** — weather (+28°) & USD/ILS (2.96) now
  ANSWER with freshness-uncertified values instead of declining; **2.96 accuracy-watch** (implausible).

## OWNER ADDITIONS (2) — DONE this context
- **ADD-1 · replacement-path proofs** (4a4a528): the Gemini/Groq CLIENT removal REROUTED live paths; a
  STALE-test disposition is not CLOSED without proving the REPLACEMENT at runtime-visible class.
  `scripts/rc-acceptance-replacement-paths.mjs` on RC eiyl4n2r7 (PREVIEW) — 4/4: TTS (/api/abuai-tts
  gpt-4o-mini-tts) → STT (/api/abuai-stt whisper-1) TTS→STT ROUND-TRIP transcribed the Hebrew back;
  CHAT (/api/abuai-chat gpt-4o) correct; WhatsApp compose proven separately (5/5).
- **ADD-2 · tool-backed interaction contract from RAW EVENT ORDERING** (e3e8ff9): the most-reported
  device defect (spoken "רגע אני בודקת" filler around a lookup; pending-after-result; repeated
  sentences). `src/services/toolSequencingOracle.ts` grades tool_call → silence → tool_result → answer
  from the FlightRecorder raw stream: INTERLEAVE_SEMANTIC / SPOKEN_PREAMBLE / PENDING_AFTER_RESULT /
  REPEATED_SENTENCE / MASKED_FALLBACK. 14 tests (synthetic + REAL FlightRecorder; sensitivity proven).
  Real gpt-realtime golden corroboration: 12 tool-turns, 0 preamble, 0 repeats. Oracle is DEVICE-ready
  when a downloaded device FlightRecorder trace is supplied (raw-event class > transcript).

## OWNER ADDITION (3) — historical-corpus replay + PATH-EQUIVALENCE (94eefed)
`scripts/rc-acceptance-historical-corpus.mjs` replays the real device transcript turn-structures
against the clean RC and scores the escape corpus with a hard path-equivalence guard (a clean replay
closes a defect ONLY on the same material path). docs/eval/RC_HISTORICAL_CORPUS.json:
  ESCAPES=9 · DETECTABLE=9 · REPLAYED_AND_CLOSED=5 (text-cognition + online) ·
  NOT_REPLAYABLE_WITH_REASON=3 (voice-audio: preamble/barge-in/truncation — realtime audio+VAD path not
  exercised headlessly; detectors exist + DEVICE-ready; a text replay is NOT accepted as closure) ·
  STILL_OPEN=1 → AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO=1.
NORTH-STAR WORKING: machine reproduced a real escape without Leo — "מי זאת ירדן" (documented כלה/אשת
עילי; alias Yarden.yaml) is DECLINED 2/2 while רפי→מור, אופיר→גלעד resolve. Mechanism: grandchild's-
spouse relation surfaced only inside עילי's notes, not first-class resolvable. NEXT ROI fix (task).
CAVEAT: replay entry is ?legacy=1 (text). Leo's sessions were VOICE; text is material-equivalent for
COGNITION only (parity mandate) — voice-audio closure remains NOT_PROVEN without a real realtime trace.

## SECURITY RESTATEMENT (owner corrected me — no evidence of revocation)
- The 3 old keys are NOT proven revoked (I had implied "safe"; I have no evidence). CREDENTIAL_REVOKED =
  OWNER_ACTION_OPEN. Production/canonical (abu-ela-rc.vercel.app) STILL ships OpenAI fp:e39ef3b7 /
  Gemini fp:69150fc4 / Groq fp:a2f25d13 (re-confirmed by scan). **Deleting them at the provider consoles
  is the most urgent open item — only deletion makes the shipped bundle worthless.** Owner-only action.

## ACCEPTANCE CLAIMS — PASS / FAIL / UNKNOWN (with owner's 2 semantic corrections applied)
PROVEN_PASS (deployed, transcript-read; see rc-acceptance-evaluated.json + rc-acceptance-abuai.json):
- AbuAI general-knowledge, family-truth, STATEFUL follow-up (she→Mor + refused to invent age),
  honest-failure (0 direct provider calls when server blocked), calendar READ (honest empty), TTS.
- Online GROUNDING-HONESTY = PROVEN_PASS. Online STATIC/DOCUMENTED current facts (US president, Ben-Gurion
  HE, Everest HE+EN, super-bowl-grounded) answered with sources.
- Online SPECIFICITY: "my grandson's dream" still BLOCKED_PERSONAL (isPersonal fix keeps real blocks).
- NO_FABRICATION_WHEN_LIVE_DATA_UNAVAILABLE = PROVEN_PASS (weather/exchange decline honestly).

NOT_PROVEN / CAPABILITY_GAP (owner correction #1 — do NOT collapse into honest-failure):
- LIVE_CURRENT_DATA_CAPABILITY = NOT_PROVEN. Weather + live exchange rate are NOT answerable (live
  JS-rendered data not in extractable evidence). This is a real capability gap, not "benign".

PROVEN_FAIL (owner correction #2 — GROUNDED ≠ CURRENT / freshness):
- CURRENT-INFO FRESHNESS: "who won the LAST super bowl" → "Seattle Seahawks" is STALE relative to the
  temporal intent ("last"). Grounded but not current → a real current-info defect, NOT a benign P2.

UNKNOWN / machine-closable-NEXT (NOT device boundaries — owner item #9):
- Calendar WRITE→readback→modify (via AbuCalendar screen UI + IndexedDB round-trip).
- WhatsApp COMPOSE (deployed proxy) + mocked SEND boundary (§12). Real SEND/phone = safe-env.

HUMAN_RESIDUAL: voice audible/perceptual quality (device/ear only).

## ACTIVE DEFECT QUEUE (priority order) — updated
1. DONE (67e7505 oracle · 17ebe37 register+freeze). Freshness oracle is a frozen control-plane component.
2. **CLOSED (87675e7 architecture · a-fx-fallback · deployed-proven on RC eiyl4n2r7)** · CURRENT-INFO
   FRESHNESS. Owner directive implemented as a GENERAL live-fact architecture (TEMPORAL = GROUNDED +
   FRESH): `src/services/online/liveFacts.ts` routes fast-changing current-VALUE domains to dedicated
   DATED authoritative sources — weather → Open-Meteo (obs time), fx → frankfurter/ECB + open.er-api
   fallback (rate date). `api/abuai-online.ts` freshness gate certifies via evaluateFreshness or
   declines honestly; the FX page mis-extraction class is structurally impossible (value from the rate
   API, never a scraped page). DEPLOYED PROOF (temporal matrix on eiyl4n2r7): weather + exchange =
   FRESH_CERTIFIED (observedAt today / 2026-08-14); super-bowl = HONEST_DECLINE (no dated source →
   never stale); 0 fabrication, 0 honest-behaviour fails. RETRACTION: the earlier "2.96 implausible"
   flag was stale-cutoff bias — ECB confirms USD/ILS≈2.95 on 2026-08-14 (the "2.96" was correct).
   REMAINING (tracked, lower priority): office-holder + news/results are NOT date-certifiable at the
   endpoint (office-holder = grounded slow-fact, acceptable; results/news decline honestly). A dated-
   SEARCH resolver (Tavily published_date / Brave page_age, captured through generalSearch→synthesize)
   is the next extension that would let results/news ANSWER freshly — the LiveFactEvidence interface is
   the seam. adapters.ts currently drops those dates.
3. DONE (76d8b00 · re-proven on eiyl4n2r7) · Calendar write→readback→modify — 7/7 PROVEN_PASS.
4. DONE (6217728 · re-proven on eiyl4n2r7) · WhatsApp compose + fact-preservation + safe send — 5/5.
5. DONE (2eeac25 · updated) · Temporal acceptance matrix — grounding-honest; weather/fx FRESH_CERTIFIED.

## EXACT NEXT EXECUTABLE ACTION (for the resuming context)
All requested §16 machine-closable acceptance is COMPLETE and re-proven on the current clean RC
(eiyl4n2r7): Calendar 7/7, WhatsApp 5/5, temporal matrix (weather/fx FRESH_CERTIFIED, results/news
decline, grounding-honest, no fabrication), bundle secret-clean (27 chunks / 0 tokens). Remaining work
is NOT blocking and is either owner-side or an optional capability extension:
  • (owner) SECURITY: revoke the 3 old keys + authorize a clean PRODUCTION redeploy (abu-bank.vercel.app
    / abu-ela-rc still ship old keys). Do NOT deploy production without authorization.
  • (optional capability) dated-SEARCH resolver so news/latest-results can ANSWER freshly (capture
    Tavily published_date / Brave page_age through generalSearch→synthesize; plug into LiveFactEvidence).
  • (human residual) voice audible/perceptual quality — device/ear only.
  • (pre-existing branch debt, NOT §16) 13 red static-source grep tests in AbuAI voice/STT/instruction
    files (productionAutoProof / realityAudit / sttResilience / voicePipelineP0 / intentInstructions) —
    present at HEAD independent of this work; out of scope (voice edits discouraged during this work).
Do not merge main / deploy production without owner authorization.

## KEY TOOLING (all committed)
- Deploy: `npx vercel deploy --force --yes`  · Secret scan: `npx tsx scripts/scan-deployed-secrets.ts`
- AbuAI accept: `node scripts/rc-acceptance-abuai.mjs <rc>` · Honest-failure: `node scripts/honest-failure-probe.mjs <rc>`
- Online probe pattern: POST `<rc>/api/abuai-online` `{query,lang}` → read `diag.answerPath/answerDetail`.
- Control plane: `npx tsx scripts/control-plane-identity.ts --freeze` ; `npx tsx scripts/control-plane-live.ts`.

## NOTE
`api/abuai-online.ts` has a temp non-secret `diag.answerDetail` (deep/snippet sub-path status) used to
root-cause from evidence — keep until the online capability gap is closed, then trim.
