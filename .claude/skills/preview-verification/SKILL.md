---
name: preview-verification
description: Verify a deployed Vercel Preview (root, health, version, routes, bundle freshness, service worker, provider health, console errors) and classify the result as PREVIEW evidence — never Production. Use before a release claim.
---

# Preview Verification

Prove the preview, and label it PREVIEW — not PRODUCTION.

## Purpose
Confirm a deployed Preview environment is actually wired and fresh, producing honest PREVIEW-class
evidence for the Acceptance Board / release gate.

## Trigger
Pre-release; after a deploy to a Preview URL; when a PREVIEW row on the board needs refreshing.

## Inputs
- The Preview URL.
- The expected `APP_VERSION.version` (from `src/version.ts`).

## Evidence classes
PREVIEW only. Explicitly NOT PRODUCTION and NOT PHYSICAL_DEVICE.

## Process (ordered)
1. Root loads (200) and renders the app shell.
2. `/api/health` returns `ok:true`; `buildVersion` == expected `APP_VERSION.version` (fresh bundle).
3. Required routes respond: `/api/abuai-chat`, `/api/abuai-online`, `/api/abuai-tts`,
   `/api/realtime-token`, `/api/abuai-stt` (status + shape, not secrets).
4. Service worker / PWA does not serve a stale bundle (version matches).
5. Provider health (keys present server-side per `/api/health` presence booleans).
6. No console/page errors on load.
7. Record each as PREVIEW evidence with the URL + timestamp.

## Tools
Bash/PowerShell (curl the URL + routes), Read, and the Preview MCP / Playwright when available.

## Forbidden
- Calling any of this Production proof.
- Reporting green if the health version mismatches the expected build (that is a stale bundle).
- Printing any secret value (health returns presence booleans only).

## Output schema
```
{ url, checkedAt, root:200, health:{ok,buildVersion,matchesExpected}, routes:{...},
  serviceWorkerFresh:boolean, consoleErrors[], evidenceClass:"PREVIEW", verdict:"pass"|"fail" }
```

## Stop conditions
- Preview URL unreachable or health missing → verdict fail; do not infer from CODE.

## Completion criteria
Every check above recorded with PREVIEW class; version freshness confirmed.

## Context policy
Isolated context (network checks) or current for a quick curl.
