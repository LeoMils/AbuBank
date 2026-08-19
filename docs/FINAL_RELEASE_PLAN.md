# AbuAI — Final Release Plan

## Branch status [RUN]
- Branch: `rc5/cognitive-architecture-and-acceptance` · HEAD `baa6bb2` · version `0.8.9-knowledge-system`.
- NOT merged to `main`. All gates green (see FINAL_PRODUCTION_READINESS_REPORT.md).
- Live preview deploy healthy (Vercel `abu-bank`, root/chat/online 200).

## Pre-merge commands (run from repo root, all must pass)
```
npm run validate:family
npm run validate:knowledge
npm run typecheck
npm run test              # 5984 pass
npm run build             # exit 0 (runs prebuild: generate + validate)
npx vitest run src/eval/evalEngine.test.ts            # NORTH_STAR 100 + JUDGE 100
npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts   # 100%
npm run build && npm run preview   # then, another shell:
PREVIEW_URL=http://localhost:4173 npx playwright test e2e/abu-games-visual.spec.ts --project=mobile-chrome
PREVIEW_URL=http://localhost:4173 npx playwright test e2e/persistence.spec.ts --project=mobile-chrome
```

## Merge-to-main checklist (human-approved)
- [ ] Human acceptance test (`FINAL_HUMAN_ACCEPTANCE_TEST.md`) PASS on device.
- [ ] All pre-merge commands green.
- [ ] Version bumped + displayed.
- [ ] No secrets in diff (`git ls-files | grep .env` → only `.env.example`; no `sk-` in src/api).
- [ ] `git checkout main && git merge --no-ff rc5/cognitive-architecture-and-acceptance`
- [ ] `git push origin main`

## Vercel promotion checklist
- [ ] Confirm the main deployment builds (health `buildVersion` == committed version).
- [ ] Promote the main deployment to the production domain (Vercel dashboard → Promote to Production).
- [ ] Verify env: `OPENAI_API_KEY` present; (optional) Realtime key restored.
- [ ] Post-promote smoke: `curl <prod>/api/health` 200; chat 200; online 200.

## Final smoke tests (post-deploy)
- root 200 · `/api/health` buildVersion match · chat 200 · online 200.
- Open PWA on iPhone, run acceptance rows 1–5, 12, 18, 21.

## Device test checklist (Leo) — see FINAL_HUMAN_ACCEPTANCE_TEST.md
- Mic + STT (he/es) · TTS plays every answer · voice sounds natural · latency thresholds · offline fallback.

## Realtime provider checklist (account)
- `curl -X POST <deploy>/api/realtime-token` currently → `REALTIME_PROVIDER_FAILED`.
- To enable: restore OpenAI Realtime entitlement/key in Vercel env, redeploy, re-curl → expect `ephemeral` token.
- Until then: app uses the validated pipeline fallback (no user-facing failure).

## Rollback plan
- Vercel: each deploy is immutable; roll back = re-promote the previous healthy deployment
  (last known good: `0.8.8-eval-judge`; the platform keeps prior builds).
- Git: `git revert <sha>` the offending commit; never force-push main.
- Data: `memory/*` and `knowledge/family/people/*` are regenerated (`npm run generate:memory`,
  `npm run generate:knowledge`) — never a data-loss risk.

## GO / NO-GO decision rules
- **GO** only if: all pre-merge commands green AND acceptance test PASS on device AND no red row.
- **NO-GO** if: any gate fails, any red acceptance row, a secret in diff, or voice unusable on device.
- Realtime being down is **not** a NO-GO (fallback ships) — note it as a known limitation.
- Live LLM prose is **not** a code NO-GO — the deterministic companion layer is green; flag depth for the live judge.
```
```
