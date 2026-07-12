---
description: Engineering rules for build / release / deploy
globs: "api/**,vercel.json,vite.config.ts,.github/workflows/**,scripts/**,src/version.ts"
alwaysApply: false
---
# Rule: Deployment + release (engineering)

**Applies to:** API routes, build/deploy config, CI, version source.

- **Never deploy to Production without explicit human approval.** No autonomous merge to `main`.
- **`PREVIEW` is not `PRODUCTION`.** A green Vercel preview proves preview, not the deployed
  production build. Do not upgrade the evidence class.
- Run the `release-gate` skill before any release claim: scope + tests + privacy + version
  contract + preview proof + explicit unproven device limits.
- **Version contract:** bump `APP_VERSION` in `src/version.ts` AND the matching
  `BUILD_VERSION`/`BUILD_LABEL` in `api/health.ts` (kept in sync by `src/version.test.ts`).
  See `docs/engineering-os/VERSION_CONTRACT.md`.
- **Never set `VITE_OPENAI_API_KEY` / `VITE_AZURE_TTS_KEY` in a build env** (bakes a billable key
  into the bundle). `scripts/check-client-secret-leak.cjs` guards this.
- Build and the full test suite are run **sequentially, never simultaneously**.
