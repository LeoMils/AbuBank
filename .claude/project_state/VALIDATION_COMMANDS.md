# VALIDATION_COMMANDS (real repo commands only)

## Gates (all must pass)
- `npm run typecheck`   # tsc --noEmit — PASS (clean)
- `npm run test`        # vitest run — PASS (5971/5971)
- `npm run build`       # tsc && vite build — PASS (exit 0)
- `npm run check`       # typecheck + test combined — PASS

## E2E (needs a server; use a FRESH preview, not a stale dev server)
```
npm run build && npm run preview        # then, in another shell:
PREVIEW_URL=http://localhost:4173 npx playwright test e2e/abu-games-visual.spec.ts --project=mobile-chrome   # PASS
PREVIEW_URL=http://localhost:4173 npx playwright test e2e/persistence.spec.ts --project=mobile-chrome         # PASS
```

## Data integrity (auto via prebuild)
- `npm run validate:family`   # family_data.json consistency — PASS
- `npm run generate:memory`   # regenerate memory/* from knowledge (NEVER hand-edit memory/)

## Deploy health (manual)
- `curl <deploy>/api/health`  → buildVersion, OPENAI_API_KEY present
- `curl -X POST <deploy>/api/abuai-chat ...`   → 200
- `curl -X POST <deploy>/api/abuai-online ...`  → 200
- `curl -X POST <deploy>/api/realtime-token`   → currently REALTIME_PROVIDER_FAILED

## MISSING / NOT PRESENT
- `npm run lint` → DOES NOT EXIST (no eslint config). Do not claim a lint gate.
