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
1. DONE (67e7505 oracle · 17ebe37 register+freeze+partial-wire). Freshness oracle is a frozen
   control-plane component. Deployed-path wiring is PARTIAL (recency only on the unused OpenAI path).
2. **P1 · CURRENT-INFO FRESHNESS on the DEPLOYED deep/judge path** (the real open item). Two coupled
   problems, both PROVEN on the deployed RC by the temporal matrix:
   (a) FRESHNESS NOT CERTIFIABLE — the deep/judge path exposes no source publication dates, so no
       temporal answer can be certified current (0/5). Real capability gap (owner correction #1).
   (b) DECLINE→ANSWER DRIFT + accuracy — weather/exchange now ANSWER with freshness-uncertified
       values (USD/ILS 2.96 is implausible) instead of the documented honest decline. This is closer
       to a fabrication-risk than an honest miss.
   FIX DIRECTION (needs a product-policy steer + is a medium-risk change to the SHARED online answer
   path → deploy-gated): either (i) for temporal live-data classes the judge must STATE the timeframe/
   date (transparency, keeps answers) and/or (ii) decline when freshness can't be verified, and/or
   (iii) adopt a dated provider (Tavily include_answer + published dates) so evaluateFreshness has a
   real signal. Extend recency/date instruction to `src/services/online/synthesize.ts` (gated to
   temporal) — NOT just the OpenAI path. Then redeploy a NEW clean RC and re-run the temporal matrix.
3. DONE (76d8b00) · Calendar write→readback→modify — 7/7 PROVEN_PASS (deployed RC, real IndexedDB).
4. DONE (6217728) · WhatsApp compose + fact-preservation + safe send boundary — 5/5 PROVEN_PASS.
5. DONE (2eeac25) · Temporal acceptance matrix — grounding-honest, freshness-not-certified (see #2).

## EXACT NEXT EXECUTABLE ACTION (for the resuming context)
Machine-closable ACCEPTANCE for Calendar / WhatsApp / temporal is COMPLETE. The remaining substantive
work is defect-queue #2 (deployed current-info freshness), which is (a) a medium-risk change to the
shared online answer path, (b) deploy-gated (new certification candidate → must re-run calendar +
whatsapp + temporal + secret-scan on it), and (c) entangled with a PRODUCT-POLICY decision the owner
previously documented (weather/exchange = honest decline) that deployed reality now contradicts.
NEXT: (1) get the owner's steer on live-data current-info policy (decline vs dated/timeframed answer);
(2) implement the chosen freshness treatment in `src/services/online/{synthesize,generalSearch}.ts`
gated to temporal queries; (3) redeploy a clean RC via `npx vercel deploy --force --yes`; (4) re-run
all four deployed acceptances + `scripts/scan-deployed-secrets.ts` on the new candidate; (5) close #2.
Do not merge main / deploy production without owner authorization.

## KEY TOOLING (all committed)
- Deploy: `npx vercel deploy --force --yes`  · Secret scan: `npx tsx scripts/scan-deployed-secrets.ts`
- AbuAI accept: `node scripts/rc-acceptance-abuai.mjs <rc>` · Honest-failure: `node scripts/honest-failure-probe.mjs <rc>`
- Online probe pattern: POST `<rc>/api/abuai-online` `{query,lang}` → read `diag.answerPath/answerDetail`.
- Control plane: `npx tsx scripts/control-plane-identity.ts --freeze` ; `npx tsx scripts/control-plane-live.ts`.

## NOTE
`api/abuai-online.ts` has a temp non-secret `diag.answerDetail` (deep/snippet sub-path status) used to
root-cause from evidence — keep until the online capability gap is closed, then trim.
