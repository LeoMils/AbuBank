# §16 Acceptance — Deterministic Resume Handoff

**Resume from EVIDENCE (JSON artifacts + git + this file), not recollection. Do NOT reset claims or
redo proven work.** Branch: `rc5/cognitive-architecture-and-acceptance` (never merge main; never deploy
production without explicit owner authorization).

## CLEAN RC IDENTITY (certification candidate)
- Latest clean RC (with the online isPersonal fix): `https://abu-bank-4jtx4wp7b-leos-projects-d3c04c09.vercel.app`
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

## ACTIVE DEFECT QUEUE (priority order)
1. P1 · LIVE_CURRENT_DATA_CAPABILITY gap — weather/exchange unanswerable (needs a supported live-data
   path within the EXISTING architecture; do not add unnecessary providers). Root cause: live JS-rendered
   data not in fetchPageText output; Brave snippets lack it. Investigate ONLINE_PROVIDER=tavily path +
   whether Tavily's include_answer gives live data; or a supported structured source.
2. P1 · CURRENT-INFO FRESHNESS — add freshness semantics to the acceptance oracle + the online answer
   path: for temporal queries (current/latest/last/today/now/this week/most recent), require temporal
   relevance, not just grounding. Re-evaluate super-bowl as FAIL.
3. Calendar write→readback→modify machine acceptance (AbuCalendar UI).
4. WhatsApp compose machine acceptance (+ mocked send).
5. Build the bounded TEMPORAL acceptance matrix: current office-holder / latest major event / current
   weather / current exchange rate / recent news / static-fact control / insufficient-evidence case.

## EXACT NEXT EXECUTABLE ACTION
Build `scripts/rc-acceptance-calendar.mjs` (Playwright, deployed clean RC): open AbuCalendar, create an
event, verify readback, modify it, verify — a write→readback→modify round-trip on IndexedDB. Then
`scripts/rc-acceptance-whatsapp.mjs` (compose via UI; assert message generated + fact-preserving; mock
send). Then the temporal matrix + freshness oracle. Run the full defect-closure loop for each.

## KEY TOOLING (all committed)
- Deploy: `npx vercel deploy --force --yes`  · Secret scan: `npx tsx scripts/scan-deployed-secrets.ts`
- AbuAI accept: `node scripts/rc-acceptance-abuai.mjs <rc>` · Honest-failure: `node scripts/honest-failure-probe.mjs <rc>`
- Online probe pattern: POST `<rc>/api/abuai-online` `{query,lang}` → read `diag.answerPath/answerDetail`.
- Control plane: `npx tsx scripts/control-plane-identity.ts --freeze` ; `npx tsx scripts/control-plane-live.ts`.

## NOTE
`api/abuai-online.ts` has a temp non-secret `diag.answerDetail` (deep/snippet sub-path status) used to
root-cause from evidence — keep until the online capability gap is closed, then trim.
