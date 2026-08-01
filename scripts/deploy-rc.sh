#!/usr/bin/env bash
# Deploy a Preview and re-alias it to the CANONICAL stable RC origin so contacts
# persist across RC updates (same origin every time). Never deploys production.
set -euo pipefail
STABLE="abu-ela-rc.vercel.app"
echo "→ building"; npm run build >/dev/null
echo "→ deploying preview"
DEP=$(npx vercel deploy --yes 2>&1 | grep -Eo "https://[a-z0-9-]+\.vercel\.app" | head -1)
echo "  deployment: $DEP"
echo "→ re-aliasing $STABLE → $DEP"
npx vercel alias set "$DEP" "$STABLE" 2>&1 | tail -2
echo "→ verifying https://$STABLE/api/health"
curl -s "https://$STABLE/api/health" | tr ',' '\n' | grep -iE "buildVersion"
echo "DONE. Canonical RC: https://$STABLE"
