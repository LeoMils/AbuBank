# iPhone — Install the Latest Build + Verify Version (before mic testing)

The app shows its version in two places, both sourced from `src/version.ts`:
- **Home screen:** a small gold badge top-left — **`QA: v<version>`**.
- **Settings → About:** the full build label + version + branch + date.

Before testing the microphone, Leo MUST confirm the app shows the **latest** version.

## 1. Open the latest deployed PWA URL
- Get the newest deployment URL (ask Claude/Vercel, or use the link in
  `docs/FINAL_RELEASE_DECISION.md`). It looks like `https://abu-bank-XXXX-…vercel.app`.
- Confirm it is live: opening `…/api/health` in Safari shows `"buildVersion":"<version>"`.
- Open the app URL in **Safari** (not Chrome — iOS PWA install needs Safari).

## 2. Remove the OLD PWA from the Home Screen (if one exists)
An old installed PWA can serve a **cached** build. Remove it first:
1. Long-press the AbuBank icon on the Home Screen.
2. Tap **Remove App → Delete App** (this clears its cached bundle).
3. (Optional, thorough) Settings → Safari → Advanced → Website Data → swipe-delete the
   abu-bank entry to clear any cached bundle.

## 3. Add the latest PWA again
1. In Safari, open the newest deployment URL.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open the new icon from the Home Screen.

## 4. Verify the version shown in the app
- **Home:** read the top-left badge — it must say **`QA: v<version>`**.
- **Settings → About:** confirm the same version + the build label + branch.
- Both must match the `buildVersion` from `…/api/health` and the version in
  `docs/FINAL_RELEASE_DECISION.md`.

## 5. Confirm you are NOT on an old cached version
- If the Home badge version does **not** match the health `buildVersion`, you are on a
  cached build → repeat steps 2–3 (remove + re-add), then force-close and reopen the app.
- iOS sometimes needs the app fully closed (swipe up in the app switcher) once after install.

## 6. Version that MUST be shown before microphone testing
- The Home badge and Settings must show the version listed as current in
  `docs/FINAL_RELEASE_DECISION.md` (the latest committed/deployed build).
- ONLY when the shown version matches, proceed to the mic test in
  `docs/abuai/FINAL_HUMAN_ACCEPTANCE_TEST.md`.
- If it does not match, do NOT test the mic — you would be testing an old build.
